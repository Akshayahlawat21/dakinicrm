import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.repositories.base import BaseRepository
from backend.app.data.exceptions import RecordNotFoundError


class TeamRepository(BaseRepository[Team]):
    """Tenant-scoped team repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Team, session)

    async def is_user_in_team(
        self, user_id: str | uuid.UUID, team_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> bool:
        """Verifies if a user belongs to a specified team within the tenant."""
        u_uuid = self._parse_uuid(user_id)
        t_uuid = self._parse_uuid(team_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(TeamMember)
            .join(Team, Team.id == TeamMember.team_id)
            .where(
                TeamMember.user_id == u_uuid,
                TeamMember.team_id == t_uuid,
                TeamMember.is_active.is_(True),
                Team.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def get_user_teams(
        self, user_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> List[Team]:
        """Returns all teams that a user belongs to within the tenant."""
        u_uuid = self._parse_uuid(user_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TeamMember.user_id == u_uuid,
                TeamMember.is_active.is_(True),
                Team.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def add_member(
        self, team_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> TeamMember:
        t_uuid = self._parse_uuid(team_id)
        u_uuid = self._parse_uuid(user_id)

        member = TeamMember(team_id=t_uuid, user_id=u_uuid, is_active=True)
        self.session.add(member)
        await self.session.flush()
        return member
