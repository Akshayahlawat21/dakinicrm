from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.deal_service import DealService
from backend.app.api.schemas.deal import DealCreateRequest, DealStageUpdateRequest, DealResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/v1/deals", tags=["Deals"])


@router.get("/summary")
async def get_pipeline_summary(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    res = await service.get_pipeline_summary(ctx)
    res["correlation_id"] = ctx.correlation_id
    return res


@router.get("", response_model=PaginatedResponse[DealResponse])
async def list_deals(
    stage: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deals, total = await service.list_deals(ctx, skip=skip, limit=limit, stage=stage)
    dtos = [
        DealResponse(
            id=str(d.id),
            organization_id=str(d.organization_id),
            account_id=str(d.account_id),
            name=d.name,
            amount=float(d.amount),
            currency=d.currency,
            stage=d.stage,
            status=d.status,
            created_at=d.created_at,
        )
        for d in deals
    ]
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[DealResponse], status_code=201)
async def create_deal(
    body: DealCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deal = await service.create_deal(
        ctx=ctx,
        account_id=body.account_id,
        name=body.name,
        amount=body.amount,
        stage=body.stage or "Qualified",
        currency=body.currency or "USD",
        opportunity_id=body.opportunity_id,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=DealResponse(
            id=str(deal.id),
            organization_id=str(deal.organization_id),
            account_id=str(deal.account_id),
            name=deal.name,
            amount=float(deal.amount),
            currency=deal.currency,
            stage=deal.stage,
            status=deal.status,
            created_at=deal.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{deal_id}", response_model=StandardResponse[DealResponse])
async def get_deal(
    deal_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deal = await service.get_deal(ctx, deal_id)
    return StandardResponse(
        status="success",
        data=DealResponse(
            id=str(deal.id),
            organization_id=str(deal.organization_id),
            account_id=str(deal.account_id),
            name=deal.name,
            amount=float(deal.amount),
            currency=deal.currency,
            stage=deal.stage,
            status=deal.status,
            created_at=deal.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{deal_id}/stage", response_model=StandardResponse[DealResponse])
async def update_deal_stage(
    deal_id: str,
    body: DealStageUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deal = await service.update_stage(ctx, deal_id, body.stage)
    await session.commit()
    return StandardResponse(
        status="success",
        data=DealResponse(
            id=str(deal.id),
            organization_id=str(deal.organization_id),
            account_id=str(deal.account_id),
            name=deal.name,
            amount=float(deal.amount),
            currency=deal.currency,
            stage=deal.stage,
            status=deal.status,
            created_at=deal.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )
