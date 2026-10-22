from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.task_service import TaskService
from backend.app.api.schemas.task import TaskCreateRequest, TaskStatusUpdateRequest, TaskResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/v1/tasks", tags=["Tasks & Activities"])


@router.get("", response_model=PaginatedResponse[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TaskService(session)
    filters = {}
    if status and status.lower() != "all":
        filters["status"] = status

    tasks, total = await service.list_tasks(ctx, skip=skip, limit=limit, filters=filters)
    dtos = [
        TaskResponse(
            id=str(t.id),
            organization_id=str(t.organization_id),
            user_id=str(t.user_id) if t.user_id else None,
            subject=t.subject,
            description=t.description,
            priority=t.priority,
            status=t.status,
            start_at=t.start_at,
            created_at=t.created_at,
        )
        for t in tasks
    ]
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[TaskResponse], status_code=201)
async def assign_task(
    body: TaskCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TaskService(session)
    task_subject = body.subject or body.title or "Follow up with customer"
    assignee = body.assigned_to or ctx.user_id
    task = await service.assign_task(
        ctx=ctx,
        assignee_id=assignee,
        subject=task_subject,
        description=body.description,
        priority=body.priority or "medium",
        start_at=body.start_at,
        account_id=body.account_id,
        contact_id=body.contact_id,
        opportunity_id=body.opportunity_id,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=TaskResponse(
            id=str(task.id),
            organization_id=str(task.organization_id),
            user_id=str(task.user_id) if task.user_id else None,
            subject=task.subject,
            description=task.description,
            priority=task.priority,
            status=task.status,
            start_at=task.start_at,
            created_at=task.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{task_id}/status", response_model=StandardResponse[TaskResponse])
async def update_task_status(
    task_id: str,
    body: TaskStatusUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TaskService(session)
    task = await service.update_task_status(ctx, task_id, body.status)
    await session.commit()
    return StandardResponse(
        status="success",
        data=TaskResponse(
            id=str(task.id),
            organization_id=str(task.organization_id),
            user_id=str(task.user_id) if task.user_id else None,
            subject=task.subject,
            description=task.description,
            priority=task.priority,
            status=task.status,
            start_at=task.start_at,
            created_at=task.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )
