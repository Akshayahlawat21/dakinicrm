import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.lead import Lead, LeadSignal, LeadConversion
from backend.app.data.repositories.base import BaseRepository


class LeadRepository(BaseRepository[Lead]):
    """Tenant-scoped lead repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Lead, session)

    async def get_by_email(self, email: str, tenant_id: str | uuid.UUID) -> Optional[Lead]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(Lead)
            .where(
                Lead.email == email.lower().strip(),
                Lead.organization_id == tenant_uuid,
                Lead.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

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
