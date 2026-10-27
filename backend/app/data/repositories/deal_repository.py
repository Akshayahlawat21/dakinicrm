import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.deal import Deal, Opportunity
from backend.app.data.repositories.base import BaseRepository


class DealRepository(BaseRepository[Deal]):
    """Tenant-scoped deal repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Deal, session)

    async def get_effective_owner_id(self, deal: Deal) -> Optional[uuid.UUID]:
        """Resolves the effective owner of a deal via direct column or linked opportunity."""
        if deal.owner_id:
            return deal.owner_id
        if deal.opportunity_id:
            opp = await self.session.get(Opportunity, deal.opportunity_id)
            if opp and opp.owner_id:
                return opp.owner_id
        return None

    async def list_scoped_by_owners(
        self,
        tenant_id: str | uuid.UUID,
        owner_ids: List[uuid.UUID],
        skip: int = 0,
        limit: int = 50,
        filters: Optional[dict] = None,
    ) -> tuple[List[Deal], int]:
        """Lists deals owned by or assigned to any user in owner_ids."""
        tenant_uuid = self._parse_uuid(tenant_id)

        opp_subq = (
            select(Opportunity.id)
            .where(
                Opportunity.organization_id == tenant_uuid,
                Opportunity.owner_id.in_(owner_ids),
                Opportunity.deleted_at.is_(None),
            )
            .subquery()
        )

        base_filter = [
            Deal.organization_id == tenant_uuid,
            Deal.deleted_at.is_(None),
            or_(
                Deal.owner_id.in_(owner_ids),
                Deal.opportunity_id.in_(select(opp_subq)),
            ),
        ]
        if filters:
            for field, val in filters.items():
                if hasattr(Deal, field) and val is not None:
                    base_filter.append(getattr(Deal, field) == val)

        count_stmt = select(func.count(Deal.id)).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        stmt = (
            select(Deal)
            .where(*base_filter)
            .order_by(Deal.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

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
