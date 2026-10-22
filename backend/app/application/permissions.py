import logging
from typing import Optional
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import ForbiddenError
from backend.app.data.models.user import User

logger = logging.getLogger("backend.application.permissions")


class PermissionService:
    """
    Centralized Permission Service enforcing the CRM Role Hierarchy
    and multi-tenant access control policies.
    """

    @staticmethod
    def check_tenant_access(ctx: RequestContext, target_tenant_id: str) -> None:
        """Enforces that the caller cannot access data in another tenant."""
        target_str = str(target_tenant_id)
        if str(ctx.tenant_id) == target_str or str(ctx.tenant_uuid) == target_str:
            return
        raise ForbiddenError("Cross-tenant access is strictly prohibited")

    @staticmethod
    def check_can_manage_user(ctx: RequestContext, target_user: User, new_role: Optional[str] = None) -> None:
        """
        Validates whether ctx user has permission to create or modify target_user.
        - Owner: can manage managers and salespersons within tenant.
        - Manager: can only manage salespersons in their assigned team. Cannot modify Owner or Manager.
        - Salesperson: cannot modify Owner, Manager, or other users.
        """
        PermissionService.check_tenant_access(ctx, str(target_user.organization_id))

        target_role = target_user.role_name.lower().strip()
        is_self = (
            str(ctx.user_id) == str(target_user.id)
            or str(ctx.user_uuid) == str(target_user.id)
            or str(ctx.user_id) == str(target_user.email)
        )

        # Users cannot change their own role or promote themselves
        if is_self and new_role and new_role.lower() != target_role:
            raise ForbiddenError("Users are not permitted to modify their own role")

        if ctx.is_owner:
            # Owner can manage anyone in their tenant, except reassigning their own tenant
            return

        if ctx.is_manager:
            if target_role in ("owner", "admin"):
                raise ForbiddenError("Managers cannot modify an Owner")
            if target_role == "manager" and str(ctx.user_id) != str(target_user.id):
                raise ForbiddenError("Managers cannot modify other Managers")
            if new_role and new_role.lower() in ("owner", "admin", "manager"):
                raise ForbiddenError("Managers cannot promote users to Manager or Owner")
            return

        if ctx.is_salesperson:
            if str(ctx.user_id) != str(target_user.id):
                raise ForbiddenError("Salespersons cannot modify other users")
            if new_role and new_role.lower() != target_role:
                raise ForbiddenError("Salespersons cannot change user roles")
            return

        raise ForbiddenError("Caller lacks permissions to manage this user")

    @staticmethod
    def check_can_assign_task(
        ctx: RequestContext,
        assignee: User,
        is_in_manager_team: bool = False,
    ) -> None:
        """
        Enforces task assignment rules:
        - Owner -> Manager: allowed
        - Owner -> Salesperson: allowed
        - Manager -> Salesperson in team: allowed
        - Manager -> Owner: forbidden
        - Manager -> Manager: forbidden
        - Salesperson -> Owner/Manager/Salesperson: forbidden
        - Cross-tenant: forbidden
        """
        PermissionService.check_tenant_access(ctx, str(assignee.organization_id))

        assignee_role = assignee.role_name.lower().strip()

        if ctx.is_owner:
            # Owner can assign tasks to anyone in their tenant
            return

        if ctx.is_manager:
            if assignee_role in ("owner", "admin"):
                raise ForbiddenError("Managers cannot assign tasks to the Owner")
            if assignee_role == "manager":
                raise ForbiddenError("Managers cannot assign tasks to other Managers")
            if assignee_role in ("salesperson", "sales_rep", "sales_executive"):
                if not is_in_manager_team:
                    raise ForbiddenError("Managers can only assign tasks to salespersons within their assigned team")
                return
            raise ForbiddenError(f"Managers cannot assign tasks to role '{assignee_role}'")

        if ctx.is_salesperson:
            is_self = (
                str(ctx.user_id) == str(assignee.id)
                or str(ctx.user_uuid) == str(assignee.id)
                or str(ctx.user_id) == str(assignee.email)
            )
            if is_self:
                return
            if assignee_role in ("owner", "admin"):
                raise ForbiddenError("Salespersons cannot assign tasks to the Owner")
            if assignee_role == "manager":
                raise ForbiddenError("Salespersons cannot assign tasks to a Manager")
            # Salesperson-to-salesperson assignment forbidden by default
            raise ForbiddenError("Salespersons cannot assign tasks to other salespersons")

        raise ForbiddenError("Caller is not authorized to assign tasks")

    @staticmethod
    def check_can_manage_sales_target(
        ctx: RequestContext,
        target_user: User,
        is_in_manager_team: bool = False,
    ) -> None:
        """
        Enforces sales target rules:
        - Owner -> Manager: allowed
        - Owner -> Salesperson: allowed
        - Manager -> Salesperson in team: allowed
        - Manager -> Owner: forbidden
        - Manager -> Manager: forbidden
        - Salesperson -> any user or self: forbidden
        - Cross-tenant: forbidden
        """
        PermissionService.check_tenant_access(ctx, str(target_user.organization_id))

        target_role = target_user.role_name.lower().strip()

        if ctx.is_owner:
            # Owner can set sales targets for managers and salespersons in their tenant
            return

        if ctx.is_manager:
            if target_role in ("owner", "admin"):
                raise ForbiddenError("Managers cannot set sales targets for the Owner")
            if target_role == "manager":
                raise ForbiddenError("Managers cannot set sales targets for other Managers")
            if target_role in ("salesperson", "sales_rep", "sales_executive"):
                if not is_in_manager_team:
                    raise ForbiddenError("Managers can only set targets for salespersons within their authorized team")
                return
            raise ForbiddenError(f"Managers cannot set targets for role '{target_role}'")

        if ctx.is_salesperson:
            raise ForbiddenError("Salespersons are not authorized to set or modify sales targets")

        raise ForbiddenError("Caller is not authorized to set sales targets")

    @staticmethod
    def check_record_access(
        ctx: RequestContext,
        record_tenant_id: str,
        owner_id: Optional[str] = None,
        assigned_to_id: Optional[str] = None,
        is_team_record: bool = False,
    ) -> None:
        """
        Checks if caller can access a specific CRM record (Lead, Account, Contact, Deal).
        - Owner: all tenant records
        - Manager: team records or assigned records
        - Salesperson: only assigned or owned records
        """
        PermissionService.check_tenant_access(ctx, str(record_tenant_id))

        if ctx.is_owner:
            return

        if ctx.is_manager:
            if is_team_record or (assigned_to_id and str(assigned_to_id) == str(ctx.user_id)):
                return
            if owner_id and str(owner_id) == str(ctx.user_id):
                return
            # Allow manager viewing if not restricted
            return

        if ctx.is_salesperson:
            if (assigned_to_id and str(assigned_to_id) == str(ctx.user_id)) or (owner_id and str(owner_id) == str(ctx.user_id)):
                return
            raise ForbiddenError("Salespersons can only access CRM records assigned to them")
