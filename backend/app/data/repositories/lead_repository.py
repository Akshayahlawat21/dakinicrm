import uuid
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.lead import Lead, LeadSignal, LeadConversion
from backend.app.data.repositories.base import BaseRepository


class LeadRepository(BaseRepository[Lead]):
    """Tenant-scoped lead repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Lead, session)

    async def get_by_email(self, email: str, tenant_id: str | uuid.UUID, status: Optional[str] = None) -> Optional[Lead]:
        tenant_uuid = self._parse_uuid(tenant_id)
        conditions = [
            func.lower(func.trim(Lead.email)) == email.lower().strip(),
            Lead.organization_id == tenant_uuid,
            Lead.deleted_at.is_(None),
        ]
        if status:
            conditions.append(Lead.status == status)
        stmt = (
            select(Lead)
            .where(*conditions)
            .order_by(Lead.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def list_by_email(self, email: str, tenant_id: str | uuid.UUID) -> List[Lead]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(Lead)
            .where(
                func.lower(func.trim(Lead.email)) == email.lower().strip(),
                Lead.organization_id == tenant_uuid,
                Lead.deleted_at.is_(None),
            )
            .order_by(Lead.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_scoped_by_assignees(
        self,
        tenant_id: str | uuid.UUID,
        assignee_ids: List[uuid.UUID],
        skip: int = 0,
        limit: int = 50,
        filters: Optional[dict] = None,
    ) -> tuple[List[Lead], int]:
        tenant_uuid = self._parse_uuid(tenant_id)
        base_filter = [
            Lead.organization_id == tenant_uuid,
            Lead.deleted_at.is_(None),
            Lead.assigned_to.in_(assignee_ids),
        ]
        if filters:
            for field, val in filters.items():
                if hasattr(Lead, field) and val is not None:
                    base_filter.append(getattr(Lead, field) == val)

        count_stmt = select(func.count(Lead.id)).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        stmt = select(Lead).where(*base_filter).order_by(Lead.created_at.desc()).offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def record_conversion(
        self,
        lead_id: str | uuid.UUID,
        account_id: str | uuid.UUID,
        opportunity_id: Optional[str | uuid.UUID] = None,
        conversion_type: str = "standard",
        notes: Optional[str] = None,
    ) -> LeadConversion:
        l_uuid = self._parse_uuid(lead_id)
        a_uuid = self._parse_uuid(account_id)
        o_uuid = self._parse_uuid(opportunity_id) if opportunity_id else None

        conv = LeadConversion(
            lead_id=l_uuid,
            account_id=a_uuid,
            opportunity_id=o_uuid,
            conversion_type=conversion_type,
            notes=notes,
        )
        self.session.add(conv)
        await self.session.flush()
        return conv

    async def add_signal(
        self,
        lead_id: str | uuid.UUID,
        signal_type: str,
        signal_value: str,
        score: int,
        source: Optional[str] = None,
    ) -> LeadSignal:
        l_uuid = self._parse_uuid(lead_id)
        sig = LeadSignal(
            lead_id=l_uuid,
            signal_type=signal_type,
            signal_value=signal_value,
            score=score,
            source=source,
        )
        self.session.add(sig)
        await self.session.flush()
        return sig
