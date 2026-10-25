import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.organization import Organization
from backend.app.data.exceptions import RecordNotFoundError


class TenantRepository:
    """Repository for managing Organization / Tenant entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, org_id: str | uuid.UUID) -> Organization:
        if not isinstance(org_id, uuid.UUID):
            try:
                org_uuid = uuid.UUID(str(org_id))
            except (ValueError, TypeError):
                org_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, str(org_id))
        else:
            org_uuid = org_id
        stmt = select(Organization).where(Organization.id == org_uuid)
        res = await self.session.execute(stmt)
        org = res.scalar_one_or_none()
        if not org:
            raise RecordNotFoundError("Organization", str(org_id))
        return org

    async def get_by_slug(self, slug: str) -> Optional[Organization]:
        stmt = select(Organization).where(Organization.slug == slug)
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def create(self, name: str, slug: str, org_id: Optional[uuid.UUID] = None) -> Organization:
        org = Organization(name=name, slug=slug)
        if org_id:
            org.id = org_id
        self.session.add(org)
        await self.session.flush()
        return org
