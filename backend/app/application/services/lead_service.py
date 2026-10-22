import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ConflictError, NotFoundError
from backend.app.data.models.lead import Lead, LeadConversion
from backend.app.data.models.user import User
from backend.app.data.models.account import Account
from backend.app.data.models.contact import Contact
from backend.app.data.models.deal import Deal
from backend.app.data.repositories.lead_repository import LeadRepository
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.data.repositories.deal_repository import DealRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class LeadService:
    """
    Lead Management Service.
    Enforces duplicate checking, assignment validation, and atomic multi-entity
    lead conversion transactions.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.lead_repo = LeadRepository(session)
        self.account_repo = AccountRepository(session)
        self.contact_repo = ContactRepository(session)
        self.deal_repo = DealRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_lead(self, ctx: RequestContext, lead_id: str | uuid.UUID) -> Lead:
        try:
            lead = await self.lead_repo.get_by_id_scoped(lead_id, ctx.tenant_id)
            PermissionService.check_record_access(
                ctx=ctx,
                record_tenant_id=str(lead.organization_id),
                assigned_to_id=str(lead.assigned_to) if lead.assigned_to else None,
            )
            return lead
        except RecordNotFoundError:
            raise NotFoundError(f"Lead '{lead_id}' was not found in this organization")

    async def list_leads(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> tuple[List[Lead], int]:
        filters = {}
        if status and status.lower() != "all":
            filters["status"] = status
        if ctx.is_salesperson:
            filters["assigned_to"] = ctx.user_uuid

        return await self.lead_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
        )

    async def create_lead(
        self,
        ctx: RequestContext,
        name: str,
        company: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        industry: Optional[str] = None,
        source: Optional[str] = "Manual",
        score: int = 50,
        assigned_to: Optional[str | uuid.UUID] = None,
    ) -> Lead:
        if not name or not name.strip():
            raise BadRequestError("Lead name is required")

        clean_email = email.lower().strip() if email else None
        if clean_email:
            existing = await self.lead_repo.get_by_email(clean_email, ctx.tenant_id)
            if existing:
                raise ConflictError(f"A lead with email '{clean_email}' already exists in this organization")

        assign_uuid = None
        candidate_id = assigned_to or ctx.user_uuid
        if candidate_id:
            try:
                candidate_uuid = candidate_id if isinstance(candidate_id, uuid.UUID) else uuid.UUID(str(candidate_id))
                user_exists = await self.session.get(User, candidate_uuid)
                if user_exists:
                    assign_uuid = candidate_uuid
            except (ValueError, TypeError):
                assign_uuid = None

        lead = Lead(
            organization_id=ctx.tenant_uuid,
            name=name.strip(),
            email=clean_email,
            phone=phone,
            industry=industry,
            source=source,
            score=score,
            status="New",
            assigned_to=assign_uuid,
        )
        created = await self.lead_repo.create(lead, ctx.tenant_id)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="lead",
            resource_id=created.id,
            new_values={"name": name, "company": company, "email": clean_email},
        )
        return created

    async def convert_lead(
        self,
        ctx: RequestContext,
        lead_id: str | uuid.UUID,
        deal_name: Optional[str] = None,
        deal_amount: float = 50000.0,
        company_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Atomic multi-record lead conversion:
        1. Validates lead existence & access
        2. Creates or links Account
        3. Creates Contact
        4. Creates Deal in pipeline
        5. Marks Lead as 'Converted'
        6. Writes to lead_conversions and audit_logs
        """
        lead = await self.get_lead(ctx, lead_id)
        if lead.status == "Converted":
            raise ConflictError("This lead has already been converted")

        target_company = (company_name or getattr(lead, "industry", None) or "Enterprise Account").strip()

        # 1. Account (find existing or create)
        account = await self.account_repo.get_by_name(target_company, ctx.tenant_id)
        if not account:
            account = Account(
                organization_id=ctx.tenant_uuid,
                name=target_company,
                industry=lead.industry,
                phone=lead.phone,
                status="active",
            )
            account = await self.account_repo.create(account, ctx.tenant_id)

        # 2. Contact
        name_parts = lead.name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else "Contact"

        contact = Contact(
            account_id=account.id,
            first_name=first_name,
            last_name=last_name,
            email=lead.email,
            phone=lead.phone,
            title="Decision Maker",
        )
        self.session.add(contact)
        await self.session.flush()

        # 3. Deal
        deal_title = deal_name or f"{target_company} - Strategic Expansion"
        deal = Deal(
            organization_id=ctx.tenant_uuid,
            account_id=account.id,
            name=deal_title,
            amount=deal_amount,
            stage="Qualified",
            status="open",
        )
        deal = await self.deal_repo.create(deal, ctx.tenant_id)

        # 4. Mark lead as Converted
        await self.lead_repo.update_scoped(
            record_id=lead.id,
            tenant_id=ctx.tenant_id,
            update_data={"status": "Converted"},
        )

        # 5. Conversion record
        conversion = await self.lead_repo.record_conversion(
            lead_id=lead.id,
            account_id=account.id,
            opportunity_id=None,
            conversion_type="standard",
            notes=f"Converted by user {ctx.user_id}",
        )

        # 6. Audit log
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CONVERT",
            resource_type="lead",
            resource_id=lead.id,
            new_values={
                "account_id": str(account.id),
                "deal_id": str(deal.id),
                "amount": deal_amount,
            },
        )

        return {
            "status": "success",
            "message": "Lead converted successfully",
            "lead_id": str(lead.id),
            "account_id": str(account.id),
            "contact_id": str(contact.id),
            "deal_id": str(deal.id),
            "conversion_id": str(conversion.id),
        }
