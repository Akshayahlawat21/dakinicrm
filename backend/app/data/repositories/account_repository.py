import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.account import Account
from backend.app.data.repositories.base import BaseRepository


class AccountRepository(BaseRepository[Account]):
    """Tenant-scoped account repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Account, session)

    async def get_by_name(self, name: str, tenant_id: str | uuid.UUID) -> Optional[Account]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(Account)
            .where(
                Account.name.ilike(name.strip()),
                Account.organization_id == tenant_uuid,
                Account.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()
