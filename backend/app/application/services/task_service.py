import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ForbiddenError, NotFoundError
from backend.app.data.models.activity import Activity
from backend.app.data.repositories.task_repository import TaskRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class TaskService:
    """
    Dedicated Task Assignment & Management Service.
    Enforces the Owner/Manager/Salesperson hierarchy rules, team boundaries,
    and audit logging for all assignments.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.task_repo = TaskRepository(session)
        self.user_repo = UserRepository(session)
        self.team_repo = TeamRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def assign_task(
        self,
        ctx: RequestContext,
        assignee_id: str | uuid.UUID,
        subject: str,
        description: Optional[str] = None,
        priority: str = "medium",
        start_at: Optional[Any] = None,
        account_id: Optional[str | uuid.UUID] = None,
        contact_id: Optional[str | uuid.UUID] = None,
        opportunity_id: Optional[str | uuid.UUID] = None,
    ) -> Activity:
        """
        Executes the 10-step task assignment workflow with strict role checks.
        """
        if not subject or not subject.strip():
            raise BadRequestError("Task subject/title is required")

        # 3 & 4. Load intended assignee and verify tenant scoping
        try:
            assignee = await self.user_repo.get_by_id_scoped(assignee_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Assignee user '{assignee_id}' does not exist in this organization")

        # 5 & 6. Check team membership for managers
        is_in_team = False
        if ctx.is_manager and ctx.team_id:
            is_in_team = await self.team_repo.is_user_in_team(
                user_id=assignee.id, team_id=ctx.team_id, tenant_id=ctx.tenant_id
            )

        # Enforce task assignment permissions
        PermissionService.check_can_assign_task(
            ctx=ctx, assignee=assignee, is_in_manager_team=is_in_team
        )

        # 7 & 8. Save task via Data Layer
        task = await self.task_repo.create_task(
            tenant_id=ctx.tenant_id,
            subject=subject.strip(),
            assigned_user_id=assignee.id,
            description=description,
            priority=priority,
            start_at=start_at,
            account_id=account_id,
            contact_id=contact_id,
            opportunity_id=opportunity_id,
        )

        # 9. Record operation in audit log
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="ASSIGN_TASK",
            resource_type="task",
            resource_id=task.id,
            new_values={
                "subject": subject,
                "assigned_to": str(assignee.id),
                "assignee_name": assignee.name,
                "priority": priority,
            },
        )

        # 10. Return task
        return task

    async def get_task(self, ctx: RequestContext, task_id: str | uuid.UUID) -> Activity:
        try:
            task = await self.task_repo.get_by_id_scoped(task_id, ctx.tenant_id)
            # Salesperson can only view their own tasks
            if ctx.is_salesperson and str(task.user_id) != str(ctx.user_id) and str(task.user_id) != str(ctx.user_uuid):
                raise ForbiddenError("Salespersons can only view tasks assigned to them")
            return task
        except RecordNotFoundError:
            raise NotFoundError(f"Task '{task_id}' was not found in this organization")

    async def list_tasks(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
    ) -> tuple[List[Activity], int]:
        filters = filters or {}
        # Salespersons only see tasks assigned to them
        if ctx.is_salesperson:
            filters["user_id"] = ctx.user_uuid

        return await self.task_repo.list_scoped(
            tenant_id=ctx.tenant_id,
            skip=skip,
            limit=limit,
            filters=filters,
        )

    async def update_task_status(
        self, ctx: RequestContext, task_id: str | uuid.UUID, new_status: str
    ) -> Activity:
        task = await self.get_task(ctx, task_id)
        if new_status not in ("scheduled", "in_progress", "completed", "canceled"):
            raise BadRequestError(f"Invalid task status: '{new_status}'")

        updated = await self.task_repo.update_scoped(
            record_id=task_id,
            tenant_id=ctx.tenant_id,
            update_data={"status": new_status},
        )
        return updated

    async def delete_task(self, ctx: RequestContext, task_id: str | uuid.UUID) -> bool:
        task = await self.get_task(ctx, task_id)
        await self.task_repo.delete_scoped(task.id, ctx.tenant_id, soft_delete=True)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="task",
            resource_id=task.id,
        )
        return True
