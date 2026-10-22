import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError
from backend.app.data.models.contact import Contact
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class ContactService:
    """Service for customer contacts."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.contact_repo = ContactRepository(session)
        self.account_repo = AccountRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_contact(self, ctx: RequestContext, contact_id: str | uuid.UUID) -> Contact:
        try:
            return await self.contact_repo.get_by_id_scoped(contact_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Contact '{contact_id}' was not found in this organization")

    async def list_contacts(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        account_id: Optional[str | uuid.UUID] = None,
    ) -> tuple[List[Contact], int]:
        filters = {}
        if account_id:
            filters["account_id"] = uuid.UUID(str(account_id))
        return await self.contact_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
        )

    async def create_contact(
        self,
        ctx: RequestContext,
        account_id: str | uuid.UUID,
        first_name: str,
        last_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        title: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Contact:
        if not first_name or not first_name.strip():
            raise BadRequestError("First name is required")

        # Verify parent account belongs to caller's tenant
        try:
            account = await self.account_repo.get_by_id_scoped(account_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Account '{account_id}' does not exist in this organization")

        contact = Contact(
            account_id=account.id,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            email=email.lower().strip() if email else None,
            phone=phone,
            title=title,
            department=department,
        )
        self.session.add(contact)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="contact",
            resource_id=contact.id,
            new_values={"name": f"{first_name} {last_name}", "account_id": str(account.id)},
        )
        return contact
