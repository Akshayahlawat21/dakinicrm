import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError
from backend.app.data.models.account import Account
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class AccountService:
    """Service for managing enterprise client accounts."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.account_repo = AccountRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_account(self, ctx: RequestContext, account_id: str | uuid.UUID) -> Account:
        try:
            return await self.account_repo.get_by_id_scoped(account_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Account '{account_id}' was not found in this organization")

    async def list_accounts(
        self, ctx: RequestContext, skip: int = 0, limit: int = 50
    ) -> tuple[List[Account], int]:
        return await self.account_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit
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
