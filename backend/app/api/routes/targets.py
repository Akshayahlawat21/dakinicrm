from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.sales_target_service import SalesTargetService
from backend.app.api.schemas.target import TargetCreateRequest, TargetResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/v1/sales-targets", tags=["Sales Targets"])


@router.get("", response_model=PaginatedResponse[TargetResponse])
async def list_targets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = SalesTargetService(session)
    targets, total = await service.list_targets(ctx, skip=skip, limit=limit)
    dtos = [
        TargetResponse(
            id=str(t.id),
            organization_id=str(t.organization_id),
            assigned_to_user_id=str(t.assigned_to_user_id),
            assigned_by_user_id=str(t.assigned_by_user_id) if t.assigned_by_user_id else None,
            target_amount=float(t.target_amount),
            currency=t.currency,
            period_type=t.period_type,
            period_start=t.period_start,
            period_end=t.period_end,
            status=t.status,
            created_at=t.created_at,
        )
        for t in targets
    ]
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/my", response_model=StandardResponse[List[TargetResponse]])
async def get_my_targets(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = SalesTargetService(session)
    targets = await service.get_my_targets(ctx)
    dtos = [
        TargetResponse(
            id=str(t.id),
            organization_id=str(t.organization_id),
            assigned_to_user_id=str(t.assigned_to_user_id),
            assigned_by_user_id=str(t.assigned_by_user_id) if t.assigned_by_user_id else None,
            target_amount=float(t.target_amount),
            currency=t.currency,
            period_type=t.period_type,
            period_start=t.period_start,
            period_end=t.period_end,
            status=t.status,
            created_at=t.created_at,
        )
        for t in targets
    ]
    return StandardResponse(
        status="success",
        data=dtos,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[TargetResponse], status_code=201)
async def set_sales_target(
    body: TargetCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = SalesTargetService(session)
    target = await service.set_sales_target(
        ctx=ctx,
        assigned_to_user_id=body.assigned_to,
        target_amount=body.target_amount,
        period_start=body.period_start,
        period_end=body.period_end,
        period_type=body.period_type or "monthly",
        currency=body.currency or "USD",
        team_id=body.team_id,
        notes=body.notes,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=TargetResponse(
            id=str(target.id),
            organization_id=str(target.organization_id),
            assigned_to_user_id=str(target.assigned_to_user_id),
            assigned_by_user_id=str(target.assigned_by_user_id) if target.assigned_by_user_id else None,
            target_amount=float(target.target_amount),
            currency=target.currency,
            period_type=target.period_type,
            period_start=target.period_start,
            period_end=target.period_end,
            status=target.status,
            created_at=target.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )
