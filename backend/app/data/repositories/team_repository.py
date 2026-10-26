import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.models.user import User
from backend.app.data.repositories.base import BaseRepository
from backend.app.data.exceptions import RecordNotFoundError


class TeamRepository(BaseRepository[Team]):
    """Tenant-scoped team repository managing teams and member assignments."""

    def __init__(self, session: AsyncSession):
        super().__init__(Team, session)

    async def list_teams_with_stats(
        self, tenant_id: str | uuid.UUID, status: Optional[str] = "active"
    ) -> List[Tuple[Team, int]]:
        """
        Lists all teams in tenant with eager-loaded manager and active member count.
        Returns list of tuples (Team, active_member_count).
        """
        org_uuid = self._parse_uuid(tenant_id)

        # Count active members per team
        member_count_subq = (
            select(
                TeamMember.team_id,
                func.count(TeamMember.id).label("member_count")
            )
            .where(TeamMember.is_active.is_(True))
            .group_by(TeamMember.team_id)
            .subquery()
        )

        query = (
            select(
                Team,
                func.coalesce(member_count_subq.c.member_count, 0).label("member_count")
            )
            .outerjoin(member_count_subq, Team.id == member_count_subq.c.team_id)
            .options(joinedload(Team.manager))
            .where(Team.organization_id == org_uuid)
        )

        if status:
            query = query.where(Team.status == status)

        query = query.order_by(Team.created_at.asc())
        res = await self.session.execute(query)
        return [(row[0], row[1]) for row in res.all()]

    async def get_team_detail(
        self, team_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> Optional[Team]:
        """Fetches team with manager and active members eagerly loaded."""
        t_uuid = self._parse_uuid(team_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = (
            select(Team)
            .options(
                joinedload(Team.manager),
                selectinload(Team.members.and_(TeamMember.is_active.is_(True))).joinedload(TeamMember.user),
            )
            .where(
                Team.id == t_uuid,
                Team.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_active_manager_team(
        self, manager_id: str | uuid.UUID, tenant_id: str | uuid.UUID, exclude_team_id: Optional[str | uuid.UUID] = None
    ) -> Optional[Team]:
        """Checks if a manager already leads an active team in the organization."""
        m_uuid = self._parse_uuid(manager_id)
        org_uuid = self._parse_uuid(tenant_id)

        stmt = select(Team).where(
            Team.organization_id == org_uuid,
            Team.manager_id == m_uuid,
            Team.status == "active",
        )
        if exclude_team_id:
            stmt = stmt.where(Team.id != self._parse_uuid(exclude_team_id))

        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

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

    async def get_active_membership(
        self, user_id: str | uuid.UUID
    ) -> Optional[TeamMember]:
        """Gets user's current active team membership if any."""
        u_uuid = self._parse_uuid(user_id)
        stmt = select(TeamMember).where(
            TeamMember.user_id == u_uuid,
            TeamMember.is_active.is_(True),
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def add_member(
        self, team_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> TeamMember:
        """Adds a user to a team (or reactivates existing inactive membership row)."""
        t_uuid = self._parse_uuid(team_id)
        u_uuid = self._parse_uuid(user_id)

        # Check existing row
        stmt = select(TeamMember).where(
            TeamMember.team_id == t_uuid,
            TeamMember.user_id == u_uuid,
        )
        res = await self.session.execute(stmt)
        existing = res.scalar_one_or_none()

        if existing:
            existing.is_active = True
            existing.joined_at = datetime.now(timezone.utc)
            await self.session.flush()
            return existing

        member = TeamMember(team_id=t_uuid, user_id=u_uuid, is_active=True)
        self.session.add(member)
        await self.session.flush()
        return member

    async def remove_member(
        self, team_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> bool:
        """Soft-deactivates user's membership in a team."""
        t_uuid = self._parse_uuid(team_id)
        u_uuid = self._parse_uuid(user_id)

        stmt = select(TeamMember).where(
            TeamMember.team_id == t_uuid,
            TeamMember.user_id == u_uuid,
            TeamMember.is_active.is_(True),
        )
        res = await self.session.execute(stmt)
        member = res.scalar_one_or_none()
        if member:
            member.is_active = False
            await self.session.flush()
            return True
        return False
