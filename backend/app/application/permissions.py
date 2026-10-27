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
    def check_user_active(user: User) -> None:
        """
        Enforces that inactive or deleted users cannot perform actions or access records.
        """
        if getattr(user, "status", None) != "active" or getattr(user, "deleted_at", None) is not None:
            raise ForbiddenError("User account is inactive or disabled")

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
        - Manager: records belonging to active team members, or assigned to manager
        - Salesperson: only assigned or owned records (unassigned records strictly forbidden)
        """
        PermissionService.check_tenant_access(ctx, str(record_tenant_id))

        if ctx.is_owner:
            return

        u_id = str(ctx.user_id)
        u_uuid = str(ctx.user_uuid) if ctx.user_uuid else u_id

        if ctx.is_manager:
            if is_team_record:
                return
            if assigned_to_id and (str(assigned_to_id) == u_id or str(assigned_to_id) == u_uuid):
                return
            if owner_id and (str(owner_id) == u_id or str(owner_id) == u_uuid):
                return
            raise ForbiddenError("Managers can only access records belonging to their active team")

        if ctx.is_salesperson:
            # Salespersons can ONLY access explicitly assigned or owned records
            # An unassigned record (assigned_to_id=None, owner_id=None) is strictly forbidden
            is_assigned = assigned_to_id and (str(assigned_to_id) == u_id or str(assigned_to_id) == u_uuid)
            is_owned = owner_id and (str(owner_id) == u_id or str(owner_id) == u_uuid)
            if is_assigned or is_owned:
                return
            if not assigned_to_id and not owner_id:
                raise ForbiddenError("Salespersons are strictly forbidden from accessing unassigned records")
            raise ForbiddenError("Salespersons can only access CRM records assigned to them")

    @staticmethod
    def check_can_access_unassigned_leads(
        ctx: RequestContext, is_authorized_manager: bool = False
    ) -> None:
        """
        Enforces access to unassigned leads pool:
        - Owner: allowed.
        - Manager: allowed ONLY if explicitly granted unassigned pool authorization.
        - Salesperson: strictly forbidden.
        """
        if ctx.is_owner:
            return
        if ctx.is_manager and is_authorized_manager:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers must be explicitly authorized to access unassigned leads")
        raise ForbiddenError("Salespersons are strictly forbidden from accessing unassigned leads")

    @staticmethod
    def check_deal_access(
        ctx: RequestContext,
        deal_tenant_id: str,
        owner_id: Optional[str] = None,
        assigned_to_id: Optional[str] = None,
        is_team_deal: bool = False,
    ) -> None:
        """Enforces access to a deal for read, stage progression, and modification."""
        PermissionService.check_record_access(
            ctx=ctx,
            record_tenant_id=deal_tenant_id,
            owner_id=owner_id,
            assigned_to_id=assigned_to_id,
            is_team_record=is_team_deal,
        )

    @staticmethod
    def check_can_delete_deal(
        ctx: RequestContext,
        deal_tenant_id: str,
        is_team_deal: bool = False,
    ) -> None:
        """
        Enforces deal deletion rules:
        - Owner: All records in tenant
        - Manager: Team records only
        - Salesperson: No delete permission
        """
        PermissionService.check_tenant_access(ctx, str(deal_tenant_id))
        if ctx.is_owner:
            return
        if ctx.is_manager and is_team_deal:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers can only delete deals belonging to their active team")
        raise ForbiddenError("Salespersons are not authorized to delete deals")

    @staticmethod
    def check_can_delete_lead(
        ctx: RequestContext,
        lead_tenant_id: str,
        is_team_lead: bool = False,
    ) -> None:
        """
        Enforces lead deletion rules:
        - Owner: All records in tenant
        - Manager: Team records only
        - Salesperson: No delete permission
        """
        PermissionService.check_tenant_access(ctx, str(lead_tenant_id))
        if ctx.is_owner:
            return
        if ctx.is_manager and is_team_lead:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers can only delete leads belonging to their team")
        raise ForbiddenError("Salespersons are not authorized to delete leads")

    @staticmethod
    def check_can_delete_contact(
        ctx: RequestContext,
        contact_tenant_id: str,
        is_team_contact: bool = False,
    ) -> None:
        """
        Enforces contact deletion rules:
        - Owner: All records in tenant
        - Manager: Team records only
        - Salesperson: No delete permission
        """
        PermissionService.check_tenant_access(ctx, str(contact_tenant_id))
        if ctx.is_owner:
            return
        if ctx.is_manager and is_team_contact:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers can only delete contacts belonging to their team")
        raise ForbiddenError("Salespersons are not authorized to delete contacts")

    @staticmethod
    def check_can_manage_campaign(ctx: RequestContext) -> None:
        """
        Enforces campaign management:
        - Owner: Yes
        - Manager: Yes
        - Salesperson: No
        """
        if ctx.is_salesperson:
            raise ForbiddenError("Salespersons are not authorized to create, edit, or delete campaigns")

    @staticmethod
    def check_can_apply_discount(ctx: RequestContext, discount_percent: float) -> None:
        """
        Enforces discount application limits:
        - Owner: Any limit
        - Manager: Approved limits (up to 30%)
        - Salesperson: Small discounts only (up to 10%)
        """
        if ctx.is_owner:
            return
        if ctx.is_manager and discount_percent <= 30.0:
            return
        if ctx.is_salesperson and discount_percent <= 10.0:
            return
        if ctx.is_salesperson:
            raise ForbiddenError(f"Salespersons can only apply small discounts up to 10% (requested {discount_percent}%)")
        raise ForbiddenError(f"Discount of {discount_percent}% exceeds manager authorized threshold (30%)")

    @staticmethod
    def check_can_approve_discount(ctx: RequestContext) -> None:
        """
        Enforces discount approvals:
        - Owner: Yes
        - Manager: Yes
        - Salesperson: No
        """
        if ctx.is_salesperson:
            raise ForbiddenError("Salespersons are not authorized to approve discounts")

    @staticmethod
    def check_can_build_reports(ctx: RequestContext) -> None:
        """
        Enforces custom report creation:
        - Owner: Yes
        - Manager: Yes
        - Salesperson: No
        """
        if ctx.is_salesperson:
            raise ForbiddenError("Salespersons are not authorized to create or edit custom reports")

    @staticmethod
    def check_can_system_admin(ctx: RequestContext) -> None:
        """
        Enforces system administration:
        - Owner: Yes
        - Manager: No
        - Salesperson: No
        """
        if not ctx.is_owner:
            raise ForbiddenError("Only organization Owners are authorized to perform system administration")

    @staticmethod
    def check_can_export_data(ctx: RequestContext, is_team_scope: bool = False) -> None:
        """
        Enforces data export permissions:
        - Owner: Unlimited / full organization
        - Manager: Team-level only
        - Salesperson: No export permission
        """
        if ctx.is_owner:
            return
        if ctx.is_manager and is_team_scope:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers can only export team-level records")
        raise ForbiddenError("Salespersons are not authorized to export data")

    @staticmethod
    def check_can_delete_account(ctx: RequestContext, account_tenant_id: str) -> None:
        """Restricts account deletion strictly to organization Owners."""
        PermissionService.check_tenant_access(ctx, str(account_tenant_id))
        if not ctx.is_owner:
            raise ForbiddenError("Only organization Owners are permitted to delete accounts")

    @staticmethod
    def check_can_delete_task(
        ctx: RequestContext,
        task_tenant_id: str,
        created_by_id: Optional[str] = None,
    ) -> None:
        """Enforces task deletion: Owner allowed, or creator of task. Salespersons cannot delete assigned tasks."""
        PermissionService.check_tenant_access(ctx, str(task_tenant_id))
        if ctx.is_owner:
            return
        u_id = str(ctx.user_id)
        u_uuid = str(ctx.user_uuid) if ctx.user_uuid else u_id
        if created_by_id and (str(created_by_id) == u_id or str(created_by_id) == u_uuid):
            return
        raise ForbiddenError("Only the task creator or an organization Owner can delete tasks")

    @staticmethod
    def check_can_manage_team(ctx: RequestContext, target_tenant_id: str) -> None:
        """Enforces that only Owners can create, edit, or deactivate teams, or assign managers."""
        PermissionService.check_tenant_access(ctx, target_tenant_id)
        if not ctx.is_owner:
            raise ForbiddenError("Only organization Owners are permitted to manage teams or assign managers")

    @staticmethod
    def check_can_manage_team_members(
        ctx: RequestContext, target_tenant_id: str, is_team_manager: bool = False
    ) -> None:
        """
        Enforces team member assignment rules:
        - Owner: can manage members of any team in tenant.
        - Manager: can only manage members of their own assigned team.
        - Salesperson: forbidden.
        """
        PermissionService.check_tenant_access(ctx, target_tenant_id)
        if ctx.is_owner:
            return
        if ctx.is_manager and is_team_manager:
            return
        if ctx.is_manager:
            raise ForbiddenError("Managers can only manage members within their own assigned team")
        raise ForbiddenError("Salespersons are not authorized to manage team members")

    @staticmethod
    def check_can_reset_password(
        ctx: RequestContext, target_user: User, is_in_manager_team: bool = False
    ) -> None:
        """
        Enforces password reset permissions:
        - Owner: can reset password for any manager or salesperson in tenant.
        - Manager: can only reset password for salespersons in their assigned team.
        - Salesperson: cannot reset other users' passwords.
        """
        PermissionService.check_tenant_access(ctx, str(target_user.organization_id))
        target_role = target_user.role_name.lower().strip()

        if ctx.is_owner:
            return

        if ctx.is_manager:
            if target_role in ("owner", "admin", "manager"):
                raise ForbiddenError("Managers cannot reset passwords for Owners or Managers")
            if not is_in_manager_team:
                raise ForbiddenError("Managers can only reset passwords for salespersons in their assigned team")
            return

        raise ForbiddenError("You are not authorized to reset passwords for other users")

