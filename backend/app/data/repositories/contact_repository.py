import uuid
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.contact import Contact
from backend.app.data.models.account import Account
from backend.app.data.repositories.base import BaseRepository, phones_match
from backend.app.data.exceptions import RecordNotFoundError


class ContactRepository(BaseRepository[Contact]):
    """
    Tenant-scoped contact repository.
    Verifies tenant ownership by joining the parent Account's organization_id.
    """

    def __init__(self, session: AsyncSession):
        super().__init__(Contact, session)

    async def get_by_id_scoped(
        self, record_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> Contact:
        rec_uuid = self._parse_uuid(record_id)
        tenant_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(Contact)
            .join(Account, Account.id == Contact.account_id)
            .where(
                Contact.id == rec_uuid,
                Account.organization_id == tenant_uuid,
                Contact.deleted_at.is_(None),
                Account.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Contact", str(record_id))
        return record

    async def list_scoped(
        self,
        tenant_id: str | uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Any = None,
    ) -> tuple[List[Contact], int]:
        tenant_uuid = self._parse_uuid(tenant_id)

        base_filter = [
            Account.organization_id == tenant_uuid,
            Contact.deleted_at.is_(None),
            Account.deleted_at.is_(None),
        ]

        if filters:
            for field, val in filters.items():
                if hasattr(Contact, field) and val is not None:
                    base_filter.append(getattr(Contact, field) == val)

        # Count total
        count_stmt = select(func.count(Contact.id)).join(Account, Account.id == Contact.account_id).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        # Query records
        stmt = (
            select(Contact)
            .join(Account, Account.id == Contact.account_id)
            .where(*base_filter)
        )

        if order_by is not None:
            stmt = stmt.order_by(order_by)
        else:
            stmt = stmt.order_by(Contact.created_at.desc())

        stmt = stmt.offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def list_by_account(
        self, account_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> List[Contact]:
        acc_uuid = self._parse_uuid(account_id)
        tenant_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(Contact)
            .join(Account, Account.id == Contact.account_id)
            .where(
                Contact.account_id == acc_uuid,
                Account.organization_id == tenant_uuid,
                Contact.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_scoped_by_accounts(
        self,
        tenant_id: str | uuid.UUID,
        account_ids: Any,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        exclude_contact_ids: Optional[Any] = None,
    ) -> tuple[List[Contact], int]:
        tenant_uuid = self._parse_uuid(tenant_id)
        if not account_ids:
            return [], 0

        base_filter = [
            Account.organization_id == tenant_uuid,
            Contact.account_id.in_(list(account_ids)),
            Contact.deleted_at.is_(None),
            Account.deleted_at.is_(None),
        ]
        if exclude_contact_ids is not None:
            base_filter.append(~Contact.id.in_(exclude_contact_ids))
        if filters:
            for field, val in filters.items():
                if hasattr(Contact, field) and val is not None:
                    base_filter.append(getattr(Contact, field) == val)

        count_stmt = select(func.count(Contact.id)).join(Account, Account.id == Contact.account_id).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        stmt = select(Contact).join(Account, Account.id == Contact.account_id).where(*base_filter).order_by(Contact.created_at.desc()).offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def get_by_normalized_email(
        self,
        tenant_id: str | uuid.UUID,
        email: str,
        account_id: Optional[str | uuid.UUID] = None,
    ) -> Optional[Contact]:
        """
        Finds an existing non-deleted contact matching the normalized email.
        Optionally scoped to a specific account.
        """
        if not email or not email.strip():
            return None
        tenant_uuid = self._parse_uuid(tenant_id)
        clean_email = email.lower().strip()
        conditions = [
            Account.organization_id == tenant_uuid,
            func.lower(Contact.email) == clean_email,
            Contact.deleted_at.is_(None),
            Account.deleted_at.is_(None),
        ]
        if account_id:
            conditions.append(Contact.account_id == self._parse_uuid(account_id))

        stmt = (
            select(Contact)
            .join(Account, Account.id == Contact.account_id)
            .where(*conditions)
            .order_by(Contact.created_at.desc())
        )
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def get_by_normalized_phone(
        self,
        tenant_id: str | uuid.UUID,
        phone: str,
        account_id: Optional[str | uuid.UUID] = None,
    ) -> Optional[Contact]:
        """
        Finds an existing non-deleted contact matching the normalized phone.
        Optionally scoped to a specific account.
        """
        if not phone or not phone.strip():
            return None
        import re
        tenant_uuid = self._parse_uuid(tenant_id)
        digits = re.sub(r'[^0-9]', '', phone)

        conditions = [
            Account.organization_id == tenant_uuid,
            Contact.phone.is_not(None),
            Contact.deleted_at.is_(None),
            Account.deleted_at.is_(None),
        ]
        if account_id:
            conditions.append(Contact.account_id == self._parse_uuid(account_id))

        if len(digits) >= 4:
            from sqlalchemy import or_
            last4 = digits[-4:]
            conditions.append(
                or_(
                    Contact.phone.ilike(f"%{last4}%"),
                    func.trim(Contact.phone) == phone.strip()
                )
            )
        else:
            conditions.append(func.trim(Contact.phone) == phone.strip())

        stmt = (
            select(Contact)
            .join(Account, Account.id == Contact.account_id)
            .where(*conditions)
            .order_by(Contact.created_at.desc())
        )
        res = await self.session.execute(stmt)
        candidates = list(res.scalars().all())
        for c in candidates:
            if phones_match(phone, c.phone):
                return c
        return None

