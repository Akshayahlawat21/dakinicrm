import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, NotFoundError
from backend.app.data.models.deal import Deal
from backend.app.data.repositories.deal_repository import DealRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError

VALID_STAGES = ["Qualified", "Proposal", "Negotiation", "Won", "Lost"]
STAGE_MAPPING = {
    "discovery": "Qualified",
    "qualification": "Qualified",
    "qualified": "Qualified",
    "proposal": "Proposal",
    "negotiation": "Negotiation",
    "won": "Won",
    "closed won": "Won",
    "closed_won": "Won",
    "lost": "Lost",
    "closed lost": "Lost",
    "closed_lost": "Lost",
}
STAGE_PROBABILITIES = {
    "discovery": 40,
    "qualification": 50,
    "qualified": 50,
    "proposal": 75,
    "negotiation": 85,
    "won": 100,
    "lost": 0,
}


class DealService:
    """Deal pipeline service with Kanban stage validation and analytics."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.deal_repo = DealRepository(session)
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_deal(self, ctx: RequestContext, deal_id: str | uuid.UUID) -> Deal:
        try:
            deal = await self.deal_repo.get_by_id_scoped(deal_id, ctx.tenant_id)
            eff_owner = await self.deal_repo.get_effective_owner_id(deal)

            is_team_deal = False
            if ctx.is_manager and eff_owner:
                mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
                if mgr_team:
                    is_team_deal = await self.team_repo.is_user_in_team(eff_owner, mgr_team.id, ctx.tenant_id)

            PermissionService.check_deal_access(
                ctx=ctx,
                deal_tenant_id=str(deal.organization_id),
                owner_id=str(eff_owner) if eff_owner else None,
                is_team_deal=is_team_deal,
            )
            return deal
        except RecordNotFoundError:
            raise NotFoundError(f"Deal '{deal_id}' was not found in this organization")

    async def list_deals(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        stage: Optional[str] = None,
    ) -> tuple[List[Deal], int]:
        filters = {}
        if stage and stage.lower() != "all":
            filters["stage"] = stage

        if ctx.is_salesperson:
            # Salespersons only see deals they own or are assigned to
            return await self.deal_repo.list_scoped_by_owners(
                tenant_id=ctx.tenant_id,
                owner_ids=[ctx.user_uuid],
                skip=skip,
                limit=limit,
                filters=filters,
            )

        if ctx.is_manager:
            # Managers see deals owned by members of their active team
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                return [], 0
            team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
            owner_ids = [u.id for u in team_users] + [ctx.user_uuid]
            return await self.deal_repo.list_scoped_by_owners(
                tenant_id=ctx.tenant_id,
                owner_ids=owner_ids,
                skip=skip,
                limit=limit,
                filters=filters,
            )

        # Owner: all organization deals
        return await self.deal_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
        )

    async def create_deal(
        self,
        ctx: RequestContext,
        account_id: str | uuid.UUID,
        name: str,
        amount: float,
        stage: str = "Qualified",
        currency: str = "USD",
        opportunity_id: Optional[str | uuid.UUID] = None,
    ) -> Deal:
        if not name or not name.strip():
            raise BadRequestError("Deal name is required")
        if amount < 0:
            raise BadRequestError("Deal amount cannot be negative")
        normalized_stage = STAGE_MAPPING.get(stage.lower().strip() if stage else "", stage)
        if normalized_stage not in VALID_STAGES:
            raise BadRequestError(f"Stage '{stage}' is invalid. Allowed: {', '.join(VALID_STAGES)}")
        stage = normalized_stage

        from datetime import datetime, timezone
        from backend.app.data.models.deal import Opportunity

        opp_id = uuid.UUID(str(opportunity_id)) if opportunity_id else None
        if not opp_id:
            opp = Opportunity(
                organization_id=ctx.tenant_uuid,
                account_id=uuid.UUID(str(account_id)),
                owner_id=ctx.user_uuid,
                name=name.strip(),
                amount=amount,
                stage=stage.lower(),
                probability=STAGE_PROBABILITIES.get(stage.lower(), 50),
            )
            self.session.add(opp)
            await self.session.flush()
            opp_id = opp.id
        else:
            opp = await self.session.get(Opportunity, opp_id)
            if opp:
                opp.stage = stage.lower()
                opp.probability = STAGE_PROBABILITIES.get(stage.lower(), opp.probability)
                await self.session.flush()

        deal = Deal(
            organization_id=ctx.tenant_uuid,
            account_id=uuid.UUID(str(account_id)),
            opportunity_id=opp_id,
            owner_id=ctx.user_uuid,
            name=name.strip(),
            amount=amount,
            stage=stage,
            currency=currency,
            status="won" if stage == "Won" else ("lost" if stage == "Lost" else "open"),
            close_date=datetime.now(timezone.utc).date() if stage == "Won" else None,
        )
        created = await self.deal_repo.create(deal, ctx.tenant_id)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="deal",
            resource_id=created.id,
            new_values={"name": name, "amount": amount, "stage": stage},
        )
        return created

    async def update_stage(
        self, ctx: RequestContext, deal_id: str | uuid.UUID, new_stage: str
    ) -> Deal:
        normalized_stage = STAGE_MAPPING.get(new_stage.lower().strip() if new_stage else "", new_stage)
        if normalized_stage not in VALID_STAGES:
            raise BadRequestError(f"Invalid stage '{new_stage}'. Allowed: {', '.join(VALID_STAGES)}")
        new_stage = normalized_stage

        deal = await self.get_deal(ctx, deal_id)
        old_stage = deal.stage
        new_status = "won" if new_stage == "Won" else ("lost" if new_stage == "Lost" else "open")

        update_fields: Dict[str, Any] = {"stage": new_stage, "status": new_status}
        if new_stage == "Won":
            from datetime import datetime, timezone
            update_fields["close_date"] = datetime.now(timezone.utc).date()

        updated = await self.deal_repo.update_scoped(
            deal_id,
            ctx.tenant_id,
            update_fields,
        )

        if deal.opportunity_id:
            from backend.app.data.models.deal import Opportunity
            opp = await self.session.get(Opportunity, deal.opportunity_id)
            if opp:
                opp.stage = new_stage.lower()
                opp.probability = STAGE_PROBABILITIES.get(new_stage.lower(), opp.probability)
                await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="UPDATE_STAGE",
            resource_type="deal",
            resource_id=deal_id,
            old_values={"stage": old_stage},
            new_values={"stage": new_stage, "status": new_status},
        )
        return updated

    async def get_pipeline_summary(self, ctx: RequestContext) -> Dict[str, Any]:
        return await self.deal_repo.get_pipeline_summary(ctx.tenant_id)

    async def delete_deal(self, ctx: RequestContext, deal_id: str | uuid.UUID) -> bool:
        deal = await self.get_deal(ctx, deal_id)
        eff_owner = await self.deal_repo.get_effective_owner_id(deal)

        is_team_deal = False
        if ctx.is_manager and eff_owner:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if mgr_team:
                is_team_deal = await self.team_repo.is_user_in_team(eff_owner, mgr_team.id, ctx.tenant_id)

        PermissionService.check_can_delete_deal(
            ctx=ctx,
            deal_tenant_id=str(deal.organization_id),
            is_team_deal=is_team_deal,
        )

        await self.deal_repo.delete_scoped(deal.id, ctx.tenant_id, soft_delete=True)

        if deal.opportunity_id:
            from datetime import datetime, timezone
            from backend.app.data.models.deal import Opportunity
            opp = await self.session.get(Opportunity, deal.opportunity_id)
            if opp:
                opp.deleted_at = datetime.now(timezone.utc)
                await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="deal",
            resource_id=deal.id,
        )
        return True

    async def check_duplicate_deal(
        self,
        ctx: RequestContext,
        account_id: Optional[str | uuid.UUID] = None,
        company: Optional[str] = None,
        name: Optional[str] = None,
        opportunity_reference: Optional[str] = None,
        product_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Duplicate Deal Advisor (Warn, Don't Automatically Block).
        1. Checks for an existing Deal with the same Account and an ACTIVE sales opportunity.
        2. Status must be 'open' (stages like Qualified, Proposal, Negotiation).
        3. Historical deals (Closed Won / Closed Lost) represent past purchases or previous lost cycles;
           they NEVER trigger duplicate warnings, preserving full history and permitting legitimate repeat purchases!
        4. If a distinct opportunity_reference or separate purchase indicator is present, duplicates are not flagged.
        5. RBAC Protection: Redacts sensitive details if caller is unauthorized to view the matched deal.
        """
        if opportunity_reference and opportunity_reference.strip():
            # Reliable business identifier provided to denote a distinct opportunity/order
            return {
                "is_duplicate_warning": False,
                "is_distinct_opportunity": True,
            }

        acc_uuid = None
        if account_id:
            try:
                acc_uuid = uuid.UUID(str(account_id))
            except (ValueError, TypeError):
                acc_uuid = None

        if not acc_uuid and company:
            from backend.app.data.repositories.account_repository import AccountRepository
            acc_repo = AccountRepository(self.session)
            acc = await acc_repo.get_by_name(company, ctx.tenant_id)
            if acc:
                acc_uuid = acc.id

        if not acc_uuid:
            return None

        from sqlalchemy import select
        from backend.app.data.models.user import User

        # Query active, open deals for this account in this tenant
        stmt = (
            select(Deal)
            .where(
                Deal.organization_id == ctx.tenant_uuid,
                Deal.account_id == acc_uuid,
                Deal.deleted_at.is_(None),
                Deal.status == "open",
                ~Deal.stage.in_(["Won", "Lost", "Closed Won", "Closed Lost"]),
            )
            .order_by(Deal.created_at.desc())
        )
        res = await self.session.execute(stmt)
        active_deals = list(res.scalars().all())

        if not active_deals:
            return None

        target_name = (name or product_name or "").strip().lower()
        target_words = [w for w in target_name.split() if len(w) > 3]

        for d in active_deals:
            d_name = d.name.lower()
            is_match = (
                d_name == target_name
                or any(w in d_name for w in target_words)
                or (product_name and product_name.lower().strip() in d_name)
                or len(active_deals) == 1
            )
            if is_match:
                # Check RBAC visibility for caller
                eff_owner = await self.deal_repo.get_effective_owner_id(d)
                is_authorized = False

                if ctx.is_owner:
                    is_authorized = True
                elif ctx.is_manager:
                    if not eff_owner or eff_owner == ctx.user_uuid:
                        is_authorized = True
                    else:
                        mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
                        if mgr_team:
                            is_authorized = await self.team_repo.is_user_in_team(
                                eff_owner, mgr_team.id, ctx.tenant_id
                            )
                elif ctx.is_salesperson:
                    is_authorized = (eff_owner == ctx.user_uuid)

                # If unauthorized user (e.g. salesperson probing another rep's deal), do not leak details
                if not is_authorized:
                    return {
                        "is_duplicate_warning": True,
                        "is_restricted": True,
                        "warning_message": (
                            "An active deal already exists for this account under another sales representative. "
                            "Contact your sales manager to coordinate or confirm a separate opportunity."
                        ),
                    }

                owner_user = await self.session.get(User, eff_owner) if eff_owner else None
                owner_name = owner_user.name if owner_user else "Unassigned"

                return {
                    "is_duplicate_warning": True,
                    "is_restricted": False,
                    "existing_deal_id": str(d.id),
                    "existing_deal_name": d.name,
                    "existing_stage": d.stage,
                    "existing_amount": float(d.amount),
                    "existing_owner": owner_name,
                    "existing_created_at": d.created_at.isoformat() if d.created_at else None,
                    "warning_message": (
                        f"An active Deal '{d.name}' (${float(d.amount):,.0f}, Stage: {d.stage}, Owner: {owner_name}) "
                        f"already exists for this account. If this is a legitimate repeat purchase, "
                        f"separate subscription, or add-on license, confirm as a separate opportunity to proceed."
                    ),
                }

        return None
