import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError
from backend.app.data.models.contact import Contact
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError
from backend.app.application.permissions import PermissionService


class ContactService:
    """Service for customer contacts with relationship-based access scoping."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.contact_repo = ContactRepository(session)
        self.account_repo = AccountRepository(session)
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def _get_authorized_account_ids_for_caller(self, ctx: RequestContext) -> Optional[List[uuid.UUID]]:
        if ctx.is_owner:
            return None

        user_ids = [ctx.user_uuid]
        if ctx.is_manager:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if mgr_team:
                team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
                user_ids = [u.id for u in team_users] + [ctx.user_uuid]

        return await self.account_repo.get_authorized_account_ids_for_users(ctx.tenant_id, user_ids)

    async def get_contact(self, ctx: RequestContext, contact_id: str | uuid.UUID) -> Contact:
        try:
            contact = await self.contact_repo.get_by_id_scoped(contact_id, ctx.tenant_id)
            if ctx.is_owner:
                return contact

            authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_account_ids is not None and contact.account_id not in authorized_account_ids:
                raise ForbiddenError("You are not authorized to access this contact")
            return contact
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

        if ctx.is_owner:
            return await self.contact_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
            )

        authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
        if authorized_account_ids is None:
            return await self.contact_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
            )

        if account_id:
            req_acc_id = uuid.UUID(str(account_id))
            if req_acc_id not in authorized_account_ids:
                return [], 0
            return await self.contact_repo.list_scoped_by_accounts(
                tenant_id=ctx.tenant_id, account_ids=[req_acc_id], skip=skip, limit=limit, filters=filters
            )

        return await self.contact_repo.list_scoped_by_accounts(
            tenant_id=ctx.tenant_id, account_ids=authorized_account_ids, skip=skip, limit=limit, filters=filters
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

        # Validate access to parent account
        if not ctx.is_owner:
            authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_account_ids is not None and account.id not in authorized_account_ids:
                raise ForbiddenError("You are not authorized to create contacts for this account")

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

    async def delete_contact(self, ctx: RequestContext, contact_id: str | uuid.UUID) -> bool:
        contact = await self.get_contact(ctx, contact_id)
        is_team_contact = False
        if ctx.is_manager:
            authorized_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_ids is None or contact.account_id in authorized_ids:
                is_team_contact = True

        PermissionService.check_can_delete_contact(
            ctx=ctx,
            contact_tenant_id=str(ctx.tenant_id),
            is_team_contact=is_team_contact,
        )

        from datetime import datetime, timezone
        contact.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="contact",
            resource_id=contact.id,
            old_values={"first_name": contact.first_name, "last_name": contact.last_name},
        )
        return True

