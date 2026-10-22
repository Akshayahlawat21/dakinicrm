import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, NotFoundError
from backend.app.data.models.deal import Deal
from backend.app.data.repositories.deal_repository import DealRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError

VALID_STAGES = ["Qualified", "Proposal", "Negotiation", "Won", "Lost"]


class DealService:
    """Deal pipeline service with Kanban stage validation and analytics."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.deal_repo = DealRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_deal(self, ctx: RequestContext, deal_id: str | uuid.UUID) -> Deal:
        try:
            return await self.deal_repo.get_by_id_scoped(deal_id, ctx.tenant_id)
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
        if stage not in VALID_STAGES:
            raise BadRequestError(f"Stage '{stage}' is invalid. Allowed: {', '.join(VALID_STAGES)}")

        deal = Deal(
            organization_id=ctx.tenant_uuid,
            account_id=uuid.UUID(str(account_id)),
            opportunity_id=uuid.UUID(str(opportunity_id)) if opportunity_id else None,
            name=name.strip(),
            amount=amount,
            stage=stage,
            currency=currency,
            status="won" if stage == "Won" else ("lost" if stage == "Lost" else "open"),
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
        if new_stage not in VALID_STAGES:
            raise BadRequestError(f"Invalid stage '{new_stage}'. Allowed: {', '.join(VALID_STAGES)}")

        deal = await self.get_deal(ctx, deal_id)
        old_stage = deal.stage
        new_status = "won" if new_stage == "Won" else ("lost" if new_stage == "Lost" else "open")

        updated = await self.deal_repo.update_scoped(
            deal_id,
            ctx.tenant_id,
            {"stage": new_stage, "status": new_status},
        )
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
        await self.deal_repo.delete_scoped(deal.id, ctx.tenant_id, soft_delete=True)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="deal",
            resource_id=deal.id,
        )
        return True
