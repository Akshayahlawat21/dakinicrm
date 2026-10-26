import uuid
import secrets
import string
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, select, func
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ConflictError, NotFoundError, ForbiddenError
from backend.app.data.models.user import User
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError, UniqueViolationError


def generate_temporary_password(length: int = 12) -> str:
    """Generates a cryptographically secure temporary password (min 12 chars, upper/lower/digit/symbol)."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in "!@#$%^&*" for c in password)
        ):
            return password


def hash_password(password: str) -> str:
    """Hashes password with bcrypt (12 rounds)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Verifies plaintext password against stored bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


class UserService:
    """Service for managing tenant users, credentials lifecycle, and role governance."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.team_repo = TeamRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_user(self, ctx: RequestContext, user_id: str | uuid.UUID) -> User:
        try:
            return await self.user_repo.get_by_id_scoped(user_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"User '{user_id}' was not found in this organization")

    async def list_users(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        team_id: Optional[str | uuid.UUID] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> tuple[List[User], int]:
        """
        Lists tenant users scoped to caller permissions:
        - Owner: all users across the organization
        - Manager: own team members + unassigned salespersons
        - Salesperson: own profile only
        """
        if ctx.is_salesperson:
            me = await self.get_user(ctx, ctx.user_id)
            return [me], 1

        if ctx.is_manager:
            # Get manager's team
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                return [], 0
            team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
            # Include unassigned reps if no specific filter
            unassigned = await self.user_repo.list_unassigned_salespersons(ctx.tenant_id)
            all_visible = {u.id: u for u in (team_users + unassigned)}
            user_list = list(all_visible.values())
            if role:
                user_list = [u for u in user_list if u.role_name.lower() == role.lower().strip()]
            if status:
                user_list = [u for u in user_list if u.status.lower() == status.lower().strip()]
            return user_list[skip : skip + limit], len(user_list)

        # Owner listing
        all_users, total = await self.user_repo.list_scoped(
            tenant_id=ctx.tenant_id,
            skip=skip,
            limit=limit,
        )
        if team_id:
            all_users = await self.user_repo.list_by_team(team_id, ctx.tenant_id)
            total = len(all_users)
        if role:
            all_users = [u for u in all_users if u.role_name.lower() == role.lower().strip()]
            total = len(all_users)
        if status:
            all_users = [u for u in all_users if u.status.lower() == status.lower().strip()]
            total = len(all_users)
        return all_users, total

    async def create_user(
        self,
        ctx: RequestContext,
        name: str,
        email: str,
        role_name: str = "salesperson",
        team_id: Optional[str | uuid.UUID] = None,
        manager_id: Optional[str | uuid.UUID] = None,
    ) -> Tuple[User, str]:
        """
        Creates a new user, generates deterministic login_id and temporary password.
        Returns tuple: (created_user, temporary_password).
        """
        clean_email = email.lower().strip()
        clean_role = role_name.lower().strip()
        clean_name = name.strip()

        # 1. Enforce Role creation hierarchy
        dummy_user = User(
            organization_id=ctx.tenant_uuid,
            name=clean_name,
            email=clean_email,
            role_name=clean_role,
        )
        PermissionService.check_can_manage_user(ctx, dummy_user, new_role=clean_role)

        # 2. Manager-Specific Creation Rule: Managers can ONLY create salespersons in their own team
        assigned_team: Optional[Team] = None
        if ctx.is_manager:
            if clean_role not in ("salesperson", "sales_rep", "sales_executive"):
                raise ForbiddenError("Managers can only create Salesperson accounts")
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                raise BadRequestError("You must lead an active team before creating salespersons")
            assigned_team = mgr_team
        elif team_id:
            assigned_team = await self.team_repo.get_by_id_scoped(team_id, ctx.tenant_id)

        # 3. Email uniqueness check
        existing = await self.user_repo.get_by_email(clean_email, ctx.tenant_id)
        if existing:
            raise ConflictError(f"A user with email '{clean_email}' already exists in this organization")

        # 4. Deterministic login_id generation with collision resolution
        login_id = await self._generate_unique_login_id(clean_email, ctx.tenant_id)

        # 5. Generate secure temporary password & hash
        temp_password = generate_temporary_password(12)
        hashed_pw = hash_password(temp_password)

        # 6. Resolve manager_id
        resolved_manager_id = None
        if assigned_team and assigned_team.manager_id:
            resolved_manager_id = assigned_team.manager_id
        elif manager_id:
            try:
                mgr = await self.user_repo.get_by_id_scoped(manager_id, ctx.tenant_id)
                resolved_manager_id = mgr.id
            except RecordNotFoundError:
                raise BadRequestError(f"Manager ID '{manager_id}' does not exist in this organization")

        new_user = User(
            organization_id=ctx.tenant_uuid,
            name=clean_name,
            email=clean_email,
            login_id=login_id,
            role_name=clean_role,
            manager_id=resolved_manager_id,
            hashed_password=hashed_pw,
            must_change_password=True,
            token_version=1,
            status="active",
        )

        try:
            created = await self.user_repo.create(new_user, ctx.tenant_id)

            # If team assigned, add to team_members
            if assigned_team:
                await self.team_repo.add_member(assigned_team.id, created.id)

            created.temporary_password = temp_password

            await self.audit_repo.record_event(
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                action="CREATE",
                resource_type="user",
                resource_id=created.id,
                new_values={
                    "email": clean_email,
                    "login_id": login_id,
                    "role": clean_role,
                    "team_id": str(assigned_team.id) if assigned_team else None,
                },
            )
            return created
        except UniqueViolationError:
            raise ConflictError(f"User with email '{clean_email}' or login ID '{login_id}' already exists")

    async def reset_password(self, ctx: RequestContext, user_id: str | uuid.UUID) -> str:
        """Resets user password, generates temporary credentials, and invalidates active sessions."""
        target_user = await self.get_user(ctx, user_id)

        # Check if caller is manager of target user's team
        is_in_team = False
        if ctx.is_manager:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if mgr_team:
                is_in_team = await self.team_repo.is_user_in_team(target_user.id, mgr_team.id, ctx.tenant_id)

        PermissionService.check_can_reset_password(ctx, target_user, is_in_manager_team=is_in_team)

        temp_password = generate_temporary_password(12)
        target_user.hashed_password = hash_password(temp_password)
        target_user.must_change_password = True
        target_user.token_version = (target_user.token_version or 1) + 1  # Invalidate prior sessions
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="RESET_PASSWORD",
            resource_type="user",
            resource_id=target_user.id,
        )
        return temp_password

    async def change_password(
        self, ctx: RequestContext, old_password: str, new_password: str
    ) -> User:
        """Self-service password change. Clears must_change_password and increments token_version."""
        user = await self.get_user(ctx, ctx.user_id)

        if not verify_password(old_password, user.hashed_password):
            raise BadRequestError("Current password is incorrect")

        # Validate new password policy
        if len(new_password) < 8:
            raise BadRequestError("New password must be at least 8 characters long")
        if not re.search(r"[A-Z]", new_password):
            raise BadRequestError("New password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", new_password):
            raise BadRequestError("New password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", new_password):
            raise BadRequestError("New password must contain at least one digit")

        if old_password == new_password:
            raise BadRequestError("New password must be different from current password")

        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        user.password_changed_at = datetime.now(timezone.utc)
        user.token_version = (user.token_version or 1) + 1
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CHANGE_PASSWORD",
            resource_type="user",
            resource_id=user.id,
        )
        return user

    async def _count_active_owners(self, tenant_id: str | uuid.UUID) -> int:
        tenant_uuid = self.user_repo._parse_uuid(tenant_id)
        stmt = select(func.count(User.id)).where(
            User.organization_id == tenant_uuid,
            User.role_name.in_(["owner", "admin"]),
            User.status == "active",
            User.deleted_at.is_(None),
        )
        try:
            stmt = stmt.with_for_update()
            res = await self.session.execute(stmt)
            return res.scalar_one()
        except Exception:
            # Fallback for storage engines without SELECT FOR UPDATE support
            res = await self.session.execute(
                select(func.count(User.id)).where(
                    User.organization_id == tenant_uuid,
                    User.role_name.in_(["owner", "admin"]),
                    User.status == "active",
                    User.deleted_at.is_(None),
                )
            )
            return res.scalar_one()

    async def deactivate_user(self, ctx: RequestContext, user_id: str | uuid.UUID) -> User:
        """Deactivates user, detaches team hierarchy, and revokes active sessions. Restricted to Owner."""
        if not ctx.is_owner:
            raise ForbiddenError("Only organization Owners are permitted to deactivate accounts")

        target_user = await self.get_user(ctx, user_id)
        if target_user.role_name.lower().strip() in ("owner", "admin") and str(target_user.id) == str(ctx.user_id):
            raise BadRequestError("You cannot deactivate your own Owner account")

        # Safeguard: Prevent deactivation of the last active Owner
        if target_user.role_name.lower().strip() in ("owner", "admin") and target_user.status == "active":
            active_owners = await self._count_active_owners(ctx.tenant_id)
            if active_owners <= 1:
                raise ForbiddenError("Cannot deactivate the last active Owner of the organization")

        target_user.status = "inactive"
        target_user.token_version = (target_user.token_version or 1) + 1  # Revoke sessions

        # If user was manager: clear teams.manager_id
        await self.session.execute(
            update(Team).where(Team.manager_id == target_user.id).values(manager_id=None)
        )
        # Clear users.manager_id if they were manager for someone
        await self.session.execute(
            update(User).where(User.manager_id == target_user.id).values(manager_id=None)
        )
        # Deactivate any active team membership
        await self.session.execute(
            update(TeamMember).where(TeamMember.user_id == target_user.id).values(is_active=False)
        )
        target_user.manager_id = None
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DEACTIVATE_USER",
            resource_type="user",
            resource_id=target_user.id,
        )
        return target_user

    async def reactivate_user(self, ctx: RequestContext, user_id: str | uuid.UUID) -> User:
        """Reactivates an inactive user account. Restricted to Owner."""
        if not ctx.is_owner:
            raise ForbiddenError("Only organization Owners are permitted to reactivate accounts")

        target_user = await self.get_user(ctx, user_id)
        target_user.status = "active"
        target_user.token_version = (target_user.token_version or 1) + 1
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="REACTIVATE_USER",
            resource_type="user",
            resource_id=target_user.id,
        )
        return target_user

    async def update_user(
        self, ctx: RequestContext, user_id: str | uuid.UUID, update_data: Dict[str, Any]
    ) -> User:
        target_user = await self.get_user(ctx, user_id)
        new_role = update_data.get("role_name")
        new_status = update_data.get("status")

        # Enforce role hierarchy
        PermissionService.check_can_manage_user(ctx, target_user, new_role=new_role)

        # Safeguard: Prevent demotion or deactivation of the last active Owner
        is_current_active_owner = (
            target_user.role_name.lower().strip() in ("owner", "admin")
            and target_user.status == "active"
            and target_user.deleted_at is None
        )
        is_demoting_owner = new_role and new_role.lower().strip() not in ("owner", "admin")
        is_deactivating_owner = new_status and new_status.lower().strip() != "active"

        if is_current_active_owner and (is_demoting_owner or is_deactivating_owner):
            active_owners = await self._count_active_owners(ctx.tenant_id)
            if active_owners <= 1:
                action_name = "demote" if is_demoting_owner else "deactivate"
                raise ForbiddenError(f"Cannot {action_name} the last active Owner of the organization")

        old_values = {
            "name": target_user.name,
            "role_name": target_user.role_name,
            "status": target_user.status,
        }

        # If role changed, increment token_version to force session refresh
        if new_role and new_role.lower() != target_user.role_name.lower():
            target_user.token_version = (target_user.token_version or 1) + 1

        updated = await self.user_repo.update_scoped(user_id, ctx.tenant_id, update_data)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="UPDATE",
            resource_type="user",
            resource_id=user_id,
            old_values=old_values,
            new_values=update_data,
        )
        return updated

    async def _generate_unique_login_id(self, email: str, tenant_id: str | uuid.UUID) -> str:
        """Generates a sanitized, collision-free login_id scoped to the organization."""
        raw_prefix = email.split("@")[0].lower().strip()
        sanitized = re.sub(r"[^a-z0-9]", "", raw_prefix)
        base = sanitized if len(sanitized) >= 2 else "user"

        candidate = base
        suffix = 2
        while True:
            existing = await self.user_repo.get_by_login_id(candidate, tenant_id)
            if not existing:
                return candidate
            candidate = f"{base}_{suffix}"
            suffix += 1
