import uuid
from typing import Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.deal import Deal
from backend.app.data.repositories.base import BaseRepository


class DealRepository(BaseRepository[Deal]):
    """Tenant-scoped deal repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Deal, session)

    async def get_pipeline_summary(self, tenant_id: str | uuid.UUID) -> Dict[str, Any]:
        """Calculates total deal values grouped by stage and status."""
        tenant_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(Deal.stage, func.sum(Deal.amount), func.count(Deal.id))
            .where(
                Deal.organization_id == tenant_uuid,
                Deal.deleted_at.is_(None),
            )
            .group_by(Deal.stage)
        )
        res = await self.session.execute(stmt)
        by_stage = {
            stage: {"total_value": float(total or 0.0), "count": count}
            for stage, total, count in res.all()
        }

        # Calculate pipeline total (excluding Lost)
        total_stmt = (
            select(func.sum(Deal.amount))
            .where(
                Deal.organization_id == tenant_uuid,
                Deal.stage != "Lost",
                Deal.deleted_at.is_(None),
            )
        )
        total_res = await self.session.execute(total_stmt)
        total_val = float(total_res.scalar_one_or_none() or 0.0)

        return {"total_pipeline": total_val, "stages": by_stage}
