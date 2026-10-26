import uuid
from typing import Optional, List, Set
from sqlalchemy import select, func, or_
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

    async def get_authorized_account_ids_for_users(
        self, tenant_id: str | uuid.UUID, user_ids: List[uuid.UUID]
    ) -> Set[uuid.UUID]:
        """Finds account IDs linked to deals, tasks, or opportunities for given users."""
        tenant_uuid = self._parse_uuid(tenant_id)
        from backend.app.data.models.deal import Deal, Opportunity
        from backend.app.data.models.activity import Activity

        deal_opp_subq = (
            select(Opportunity.id)
            .where(Opportunity.organization_id == tenant_uuid, Opportunity.owner_id.in_(user_ids))
            .subquery()
        )
        deal_stmt = select(Deal.account_id).where(
            Deal.organization_id == tenant_uuid,
            Deal.deleted_at.is_(None),
            or_(
                Deal.owner_id.in_(user_ids),
                Deal.opportunity_id.in_(select(deal_opp_subq)),
            )
        )
        deal_accs = (await self.session.execute(deal_stmt)).scalars().all()

        act_stmt = select(Activity.account_id).where(
            Activity.organization_id == tenant_uuid,
            Activity.user_id.in_(user_ids),
            Activity.account_id.is_not(None),
        )
        act_accs = (await self.session.execute(act_stmt)).scalars().all()

        return {acc_id for acc_id in (list(deal_accs) + list(act_accs)) if acc_id is not None}

    async def list_scoped_by_ids(
        self,
        tenant_id: str | uuid.UUID,
        account_ids: Set[uuid.UUID],
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[Account], int]:
        tenant_uuid = self._parse_uuid(tenant_id)
        if not account_ids:
            return [], 0

        base_filter = [
            Account.organization_id == tenant_uuid,
            Account.id.in_(account_ids),
            Account.deleted_at.is_(None),
        ]
        count_stmt = select(func.count(Account.id)).where(*base_filter)
        total = (await self.session.execute(count_stmt)).scalar_one()

        stmt = select(Account).where(*base_filter).order_by(Account.name.asc()).offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total
