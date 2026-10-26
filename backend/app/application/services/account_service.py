import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError
from backend.app.data.models.account import Account
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class AccountService:
    """Service for managing enterprise client accounts with relationship-based access scoping."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.account_repo = AccountRepository(session)
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def _get_authorized_users_for_caller(self, ctx: RequestContext) -> List[uuid.UUID]:
        if ctx.is_salesperson:
            return [ctx.user_uuid]
        if ctx.is_manager:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                return [ctx.user_uuid]
            team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
            return [u.id for u in team_users] + [ctx.user_uuid]
        return []

    async def get_account(self, ctx: RequestContext, account_id: str | uuid.UUID) -> Account:
        try:
            account = await self.account_repo.get_by_id_scoped(account_id, ctx.tenant_id)
            if ctx.is_owner:
                return account

            user_ids = await self._get_authorized_users_for_caller(ctx)
            accessible_ids = await self.account_repo.get_authorized_account_ids_for_users(
                ctx.tenant_id, user_ids
            )
            if account.id not in accessible_ids:
                raise ForbiddenError("You are not authorized to access this account")
            return account
        except RecordNotFoundError:
            raise NotFoundError(f"Account '{account_id}' was not found in this organization")

    async def list_accounts(
        self, ctx: RequestContext, skip: int = 0, limit: int = 50
    ) -> tuple[List[Account], int]:
        if ctx.is_owner:
            return await self.account_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit
            )

        user_ids = await self._get_authorized_users_for_caller(ctx)
        accessible_ids = await self.account_repo.get_authorized_account_ids_for_users(
            ctx.tenant_id, user_ids
        )
        return await self.account_repo.list_scoped_by_ids(
            tenant_id=ctx.tenant_id, account_ids=accessible_ids, skip=skip, limit=limit
        )

    async def create_account(
        self,
        ctx: RequestContext,
        name: str,
        industry: Optional[str] = None,
        website: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
    ) -> Account:
        if not name or not name.strip():
            raise BadRequestError("Account name is required")

        account = Account(
            organization_id=ctx.tenant_uuid,
            name=name.strip(),
            industry=industry,
            website=website,
            phone=phone,
            address=address,
            status="active",
        )
        created = await self.account_repo.create(account, ctx.tenant_id)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="account",
            resource_id=created.id,
            new_values={"name": name, "industry": industry},
        )
        return created

    async def delete_account(self, ctx: RequestContext, account_id: str | uuid.UUID) -> bool:
        # Strictly restrict account deletion to organization Owners
        PermissionService.check_can_delete_account(ctx, str(ctx.tenant_id))

        try:
            account = await self.get_account(ctx, account_id)
        except NotFoundError:
            account = await self.account_repo.get_by_name(str(account_id), ctx.tenant_id)
            if not account:
                raise NotFoundError(f"Account '{account_id}' was not found in this organization")

        from datetime import datetime, timezone
        account.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="account",
            resource_id=account.id,
            old_values={"name": account.name},
        )
        return True

