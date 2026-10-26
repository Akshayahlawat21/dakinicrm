import uuid
from datetime import date
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.target import SalesTarget
from backend.app.data.repositories.base import BaseRepository


class SalesTargetRepository(BaseRepository[SalesTarget]):
    """Tenant-scoped sales target repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(SalesTarget, session)

    async def find_existing_target(
        self,
        user_id: str | uuid.UUID,
        period_start: date,
        period_end: date,
        tenant_id: str | uuid.UUID,
    ) -> Optional[SalesTarget]:
        u_uuid = self._parse_uuid(user_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = select(SalesTarget).where(
            SalesTarget.organization_id == org_uuid,
            SalesTarget.assigned_to_user_id == u_uuid,
            SalesTarget.period_start == period_start,
            SalesTarget.period_end == period_end,
            SalesTarget.status == "active",
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_user(
        self, user_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> List[SalesTarget]:
        u_uuid = self._parse_uuid(user_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = select(SalesTarget).where(
            SalesTarget.organization_id == org_uuid,
            SalesTarget.assigned_to_user_id == u_uuid,
        ).order_by(SalesTarget.period_start.desc())
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_scoped_by_users(
        self,
        tenant_id: str | uuid.UUID,
        user_ids: List[uuid.UUID],
        skip: int = 0,
        limit: int = 50,
        filters: Optional[dict] = None,
    ) -> tuple[List[SalesTarget], int]:
        from sqlalchemy import func
        tenant_uuid = self._parse_uuid(tenant_id)
        if not user_ids:
            return [], 0
        base_filter = [
            SalesTarget.organization_id == tenant_uuid,
            SalesTarget.assigned_to_user_id.in_(user_ids),
        ]
        if filters:
            for field, val in filters.items():
                if hasattr(SalesTarget, field) and val is not None:
                    base_filter.append(getattr(SalesTarget, field) == val)

        count_stmt = select(func.count(SalesTarget.id)).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        stmt = select(SalesTarget).where(*base_filter).order_by(SalesTarget.period_start.desc())
        stmt = stmt.offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total
