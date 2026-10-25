import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.user import User
from backend.app.data.models.organization import TeamMember
from backend.app.data.repositories.base import BaseRepository
from backend.app.data.exceptions import RecordNotFoundError


class UserRepository(BaseRepository[User]):
    """Tenant-scoped user repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str, tenant_id: str | uuid.UUID) -> Optional[User]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(User)
            .where(
                User.email == email.lower().strip(),
                User.organization_id == tenant_uuid,
                User.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_by_team(self, team_id: str | uuid.UUID, tenant_id: str | uuid.UUID) -> List[User]:
        tenant_uuid = self._parse_uuid(tenant_id)
        team_uuid = self._parse_uuid(team_id)

        stmt = (
            select(User)
            .join(TeamMember, TeamMember.user_id == User.id)
            .where(
                TeamMember.team_id == team_uuid,
                TeamMember.is_active.is_(True),
                User.organization_id == tenant_uuid,
                User.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())
