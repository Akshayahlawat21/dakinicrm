import uuid
from typing import Optional, List
from sqlalchemy import select, or_, func
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

    async def get_by_login_id(self, login_id: str, tenant_id: str | uuid.UUID) -> Optional[User]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(User)
            .where(
                func.lower(User.login_id) == login_id.lower().strip(),
                User.organization_id == tenant_uuid,
                User.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_email_or_login(self, identifier: str, tenant_id: Optional[str | uuid.UUID] = None) -> Optional[User]:
        clean = identifier.lower().strip()
        clean_compact = clean.replace(".", "").replace("_", "").replace("-", "")
        stmt = select(User).where(
            or_(
                func.lower(User.email) == clean,
                func.lower(User.login_id) == clean,
                func.replace(func.replace(func.replace(func.lower(User.login_id), '.', ''), '_', ''), '-', '') == clean_compact,
            ),
            User.deleted_at.is_(None),
        )
        if tenant_id:
            stmt = stmt.where(User.organization_id == self._parse_uuid(tenant_id))
        res = await self.session.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            return user

        stmt_all = select(User).where(User.deleted_at.is_(None))
        if tenant_id:
            stmt_all = stmt_all.where(User.organization_id == self._parse_uuid(tenant_id))
        all_res = await self.session.execute(stmt_all)
        for u in all_res.scalars().all():
            prefix = u.email.split("@")[0].lower()
            prefix_compact = prefix.replace(".", "").replace("_", "").replace("-", "")
            if prefix == clean or prefix_compact == clean_compact:
                return u
        return None

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

    async def list_unassigned_salespersons(self, tenant_id: str | uuid.UUID) -> List[User]:
        """Lists salespersons who have no active team membership."""
        tenant_uuid = self._parse_uuid(tenant_id)

        active_members_subq = (
            select(TeamMember.user_id)
            .where(TeamMember.is_active.is_(True))
            .subquery()
        )

        stmt = (
            select(User)
            .where(
                User.organization_id == tenant_uuid,
                User.role_name.in_(("salesperson", "sales_rep", "sales_executive")),
                User.status == "active",
                User.deleted_at.is_(None),
                User.id.not_in(select(active_members_subq)),
            )
            .order_by(User.name.asc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())
