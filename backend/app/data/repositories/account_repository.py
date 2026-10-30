import uuid
from typing import Optional, List, Set
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.account import Account
from backend.app.data.repositories.base import BaseRepository, phones_match


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

    async def list_by_phone(self, phone: str, tenant_id: str | uuid.UUID) -> List[Account]:
        if not phone or not phone.strip():
            return []
        import re
        tenant_uuid = self._parse_uuid(tenant_id)
        digits = re.sub(r'[^0-9]', '', phone)

        conditions = [
            Account.organization_id == tenant_uuid,
            Account.phone.is_not(None),
            Account.deleted_at.is_(None),
        ]

        if len(digits) >= 4:
            last4 = digits[-4:]
            conditions.append(
                or_(
                    Account.phone.ilike(f"%{last4}%"),
                    func.trim(Account.phone) == phone.strip()
                )
            )
        else:
            conditions.append(func.trim(Account.phone) == phone.strip())

        stmt = (
            select(Account)
            .where(*conditions)
            .order_by(Account.created_at.desc())
        )
        res = await self.session.execute(stmt)
        candidates = list(res.scalars().all())
        return [a for a in candidates if phones_match(phone, a.phone)]


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

        from backend.app.data.models.lead import Lead, LeadConversion
        lead_conv_stmt = (
            select(LeadConversion.account_id)
            .join(Lead, Lead.id == LeadConversion.lead_id)
            .where(
                Lead.organization_id == tenant_uuid,
                Lead.deleted_at.is_(None),
                Lead.assigned_to.in_(user_ids),
                LeadConversion.account_id.is_not(None),
            )
        )
        lead_accs = (await self.session.execute(lead_conv_stmt)).scalars().all()

        from backend.app.data.models.audit import AuditLog
        from backend.app.data.models.contact import Contact
        created_acc_stmt = select(AuditLog.resource_id).where(
            AuditLog.organization_id == tenant_uuid,
            AuditLog.resource_type == "account",
            AuditLog.action == "CREATE",
            AuditLog.user_id.in_(user_ids),
        )
        created_accs = (await self.session.execute(created_acc_stmt)).scalars().all()

        created_con_stmt = (
            select(Contact.account_id)
            .join(AuditLog, AuditLog.resource_id == Contact.id)
            .where(
                AuditLog.organization_id == tenant_uuid,
                AuditLog.resource_type == "contact",
                AuditLog.action == "CREATE",
                AuditLog.user_id.in_(user_ids),
                Contact.deleted_at.is_(None),
            )
        )
        con_accs = (await self.session.execute(created_con_stmt)).scalars().all()

        all_acc_candidates = list(deal_accs) + list(act_accs) + list(lead_accs) + list(created_accs) + list(con_accs)
        return {acc_id for acc_id in all_acc_candidates if acc_id is not None}

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
