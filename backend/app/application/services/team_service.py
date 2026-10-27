import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ConflictError, NotFoundError, ForbiddenError
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.models.user import User
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError, UniqueViolationError


class TeamService:
    """Domain service managing team hierarchy, assignments, and synchronized manager caching."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def list_teams(
        self, ctx: RequestContext, status: Optional[str] = "active"
    ) -> List[Tuple[Team, int]]:
        """
        Lists teams accessible to caller:
        - Owner: all teams in organization
        - Manager: manager's assigned team only
        - Salesperson: salesperson's assigned team only
        """
        all_teams = await self.team_repo.list_teams_with_stats(ctx.tenant_id, status=status)

        if ctx.is_owner:
            return all_teams

        if ctx.is_manager:
            return [t for t in all_teams if str(t[0].manager_id) == str(ctx.user_id) or str(t[0].manager_id) == str(ctx.user_uuid)]

        if ctx.is_salesperson:
            user_teams = await self.team_repo.get_user_teams(ctx.user_id, ctx.tenant_id)
            user_team_ids = {str(t.id) for t in user_teams}
            return [t for t in all_teams if str(t[0].id) in user_team_ids]

        return []

    async def get_team(self, ctx: RequestContext, team_id: str | uuid.UUID) -> Team:
        """Retrieves full team detail with manager and member roster."""
        team = await self.team_repo.get_team_detail(team_id, ctx.tenant_id)
        if not team:
            raise NotFoundError(f"Team '{team_id}' was not found in this organization")

        # Scope visibility
        if ctx.is_manager and str(team.manager_id) != str(ctx.user_id) and str(team.manager_id) != str(ctx.user_uuid):
            raise ForbiddenError("Managers can only view their own assigned team")
        if ctx.is_salesperson:
            is_member = await self.team_repo.is_user_in_team(ctx.user_id, team.id, ctx.tenant_id)
            if not is_member:
                raise ForbiddenError("Salespersons can only view their own team")

        return team

    async def create_team(
        self,
        ctx: RequestContext,
        name: str,
        description: Optional[str] = None,
        manager_id: Optional[str | uuid.UUID] = None,
    ) -> Team:
        """Creates a new team. Restricted to organization Owner."""
        PermissionService.check_can_manage_team(ctx, str(ctx.tenant_id))

        clean_name = name.strip()
        if not clean_name:
            raise BadRequestError("Team name cannot be empty")

        m_uuid = None
        if manager_id:
            m_uuid = await self._validate_manager_candidate(ctx, manager_id)

        new_team = Team(
            organization_id=ctx.tenant_uuid,
            name=clean_name,
            description=description.strip() if description else None,
            manager_id=m_uuid,
            status="active",
        )

        created = await self.team_repo.create(new_team, ctx.tenant_id)

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="team",
            resource_id=created.id,
            new_values={"name": clean_name, "manager_id": str(m_uuid) if m_uuid else None},
        )
        return created

    async def update_team(
        self,
        ctx: RequestContext,
        team_id: str | uuid.UUID,
        update_data: Dict[str, Any],
    ) -> Team:
        """Updates team details or reassigns manager. Restricted to Owner."""
        PermissionService.check_can_manage_team(ctx, str(ctx.tenant_id))

        team = await self.team_repo.get_by_id_scoped(team_id, ctx.tenant_id)
        old_manager_id = team.manager_id

        if "name" in update_data:
            name = str(update_data["name"]).strip()
            if not name:
                raise BadRequestError("Team name cannot be empty")
            team.name = name

        if "description" in update_data:
            team.description = update_data["description"]

        manager_changed = False
        if "manager_id" in update_data:
            new_m_id = update_data["manager_id"]
            if new_m_id is None:
                team.manager_id = None
                manager_changed = True
            else:
                validated_uuid = await self._validate_manager_candidate(ctx, new_m_id, exclude_team_id=team.id)
                team.manager_id = validated_uuid
                manager_changed = True

        await self.session.flush()

        # If manager changed, synchronize denormalized users.manager_id for all active members
        if manager_changed:
            stmt = (
                update(User)
                .where(
                    User.id.in_(
                        select(TeamMember.user_id)
                        .where(TeamMember.team_id == team.id, TeamMember.is_active.is_(True))
                    )
                )
                .values(manager_id=team.manager_id)
            )
            await self.session.execute(stmt)
            await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="UPDATE",
            resource_type="team",
            resource_id=team.id,
            old_values={"manager_id": str(old_manager_id) if old_manager_id else None},
            new_values={"manager_id": str(team.manager_id) if team.manager_id else None},
        )
        return team

    async def deactivate_team(
        self, ctx: RequestContext, team_id: str | uuid.UUID
    ) -> Team:
        """Deactivates a team, releasing manager and member cache. Restricted to Owner."""
        PermissionService.check_can_manage_team(ctx, str(ctx.tenant_id))

        team = await self.team_repo.get_by_id_scoped(team_id, ctx.tenant_id)
        if team.status == "inactive":
            return team

        team.status = "inactive"
        team.deleted_at = datetime.now(timezone.utc)

        # 1. Clear manager_id on team
        team.manager_id = None

        # 2. Deactivate all active team members
        stmt_members = (
            update(TeamMember)
            .where(TeamMember.team_id == team.id, TeamMember.is_active.is_(True))
            .values(is_active=False)
        )
        await self.session.execute(stmt_members)

        # 3. Clear users.manager_id cache for former members
        stmt_users = (
            update(User)
            .where(
                User.id.in_(
                    select(TeamMember.user_id).where(TeamMember.team_id == team.id)
                )
            )
            .values(manager_id=None)
        )
        await self.session.execute(stmt_users)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DEACTIVATE",
            resource_type="team",
            resource_id=team.id,
        )
        return team

    async def add_member(
        self, ctx: RequestContext, team_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> TeamMember:
        """Assigns a salesperson to a team."""
        team = await self.team_repo.get_by_id_scoped(team_id, ctx.tenant_id)
        is_team_mgr = (
            str(team.manager_id) == str(ctx.user_id)
            or str(team.manager_id) == str(ctx.user_uuid)
        )
        PermissionService.check_can_manage_team_members(ctx, str(ctx.tenant_id), is_team_manager=is_team_mgr)

        target_user = await self.user_repo.get_by_id_scoped(user_id, ctx.tenant_id)
        if target_user.role_name.lower().strip() not in ("salesperson", "sales_rep", "sales_executive"):
            raise BadRequestError("Only users with role 'salesperson' can be assigned to teams")

        if target_user.status != "active":
            raise BadRequestError("Cannot assign an inactive user to a team")

        # Check existing active membership (enforce at most 1 active team per salesperson)
        existing_membership = await self.team_repo.get_active_membership(target_user.id)
        if existing_membership and str(existing_membership.team_id) != str(team.id):
            # Deactivate former membership
            existing_membership.is_active = False
            await self.session.flush()

        member = await self.team_repo.add_member(team.id, target_user.id)

        # Synchronize users.manager_id
        target_user.manager_id = team.manager_id
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="ADD_MEMBER",
            resource_type="team",
            resource_id=team.id,
            new_values={"user_id": str(target_user.id)},
        )
        return member

    async def remove_member(
        self, ctx: RequestContext, team_id: str | uuid.UUID, user_id: str | uuid.UUID
    ) -> bool:
        """Removes a salesperson from a team."""
        team = await self.team_repo.get_by_id_scoped(team_id, ctx.tenant_id)
        is_team_mgr = (
            str(team.manager_id) == str(ctx.user_id)
            or str(team.manager_id) == str(ctx.user_uuid)
        )
        PermissionService.check_can_manage_team_members(ctx, str(ctx.tenant_id), is_team_manager=is_team_mgr)

        target_user = await self.user_repo.get_by_id_scoped(user_id, ctx.tenant_id)
        removed = await self.team_repo.remove_member(team.id, target_user.id)

        if removed:
            target_user.manager_id = None
            await self.session.flush()

            await self.audit_repo.record_event(
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                action="REMOVE_MEMBER",
                resource_type="team",
                resource_id=team.id,
                old_values={"user_id": str(target_user.id)},
            )
        return removed

    async def transfer_member(
        self,
        ctx: RequestContext,
        user_id: str | uuid.UUID,
        source_team_id: str | uuid.UUID,
        target_team_id: str | uuid.UUID,
    ) -> TeamMember:
        """Transfers a salesperson between teams. Restricted to Owner."""
        PermissionService.check_can_manage_team(ctx, str(ctx.tenant_id))

        if str(source_team_id) == str(target_team_id):
            raise BadRequestError("Source and target teams cannot be the same")

        target_team = await self.team_repo.get_by_id_scoped(target_team_id, ctx.tenant_id)
        if target_team.status != "active":
            raise BadRequestError("Cannot transfer user to an inactive team")

        # 1. Remove from source
        await self.remove_member(ctx, source_team_id, user_id)

        # 2. Add to target
        member = await self.add_member(ctx, target_team_id, user_id)
        return member

    async def _validate_manager_candidate(
        self,
        ctx: RequestContext,
        manager_id: str | uuid.UUID,
        exclude_team_id: Optional[str | uuid.UUID] = None,
    ) -> uuid.UUID:
        """Validates that candidate is an active manager in this organization not leading another active team."""
        try:
            manager = await self.user_repo.get_by_id_scoped(manager_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise BadRequestError(f"Manager ID '{manager_id}' does not exist in this organization")

        if manager.role_name.lower().strip() != "manager":
            raise BadRequestError(f"User '{manager.name}' does not have the 'manager' role (current role: '{manager.role_name}')")

        if manager.status != "active":
            raise BadRequestError(f"User '{manager.name}' is inactive and cannot lead a team")

        # Check if already leading another active team (enforcing 1 active team per manager)
        existing_team = await self.team_repo.get_active_manager_team(
            manager.id, ctx.tenant_id, exclude_team_id=exclude_team_id
        )
        if existing_team:
            raise ConflictError(
                f"Manager '{manager.name}' is already assigned as leader of active team '{existing_team.name}'"
            )

        return manager.id
