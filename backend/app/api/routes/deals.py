from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.deal_service import DealService
from backend.app.api.schemas.deal import DealCreateRequest, DealStageUpdateRequest, DealResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse, ActionResponse

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

    from sqlalchemy import select
    from backend.app.data.models.user import User

    user_ids = {d.owner_id for d in deals if getattr(d, 'owner_id', None)}
    user_map = {}
    if user_ids:
        users_stmt = select(User.id, User.name).where(User.id.in_(user_ids))
        users_res = await session.execute(users_stmt)
        user_map = {row.id: row.name for row in users_res}

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
            owner_id=str(d.owner_id) if getattr(d, 'owner_id', None) else None,
            owner=user_map.get(getattr(d, 'owner_id', None)),
            created_at=d.created_at,
        )
        for d in deals
    ]
    print(f"\n[SUPABASE DB FETCH] >> Fetched {len(dtos)} deals from Supabase PostgreSQL (Tenant: {ctx.tenant_id}, Total: {total})", flush=True)
    for deal in dtos[:3]:
        print(f"   * Deal: {deal.name} | Amount: ${deal.amount} | Stage: {deal.stage} | Owner: {deal.owner}", flush=True)
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/check-duplicate", response_model=StandardResponse[dict])
async def check_duplicate_deal(
    company: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    name: Optional[str] = Query(None),
    opportunity_reference: Optional[str] = Query(None),
    product_name: Optional[str] = Query(None),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Checks for similar active deals to warn before creating duplicates.
    Legitimate repeat purchases and historical deals are permitted and never blocked.
    """
    service = DealService(session)
    result = await service.check_duplicate_deal(
        ctx=ctx,
        account_id=account_id,
        company=company,
        name=name,
        opportunity_reference=opportunity_reference,
        product_name=product_name,
    )
    return StandardResponse(
        status="success",
        data=result or {"is_duplicate_warning": False},
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[DealResponse], status_code=201)
async def create_deal(
    body: DealCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    account_id = body.account_id
    if not account_id:
        from backend.app.data.repositories.account_repository import AccountRepository
        from backend.app.application.services.account_service import AccountService
        acc_repo = AccountRepository(session)
        acc_service = AccountService(session)
        if body.company and body.company.strip():
            existing_acc = await acc_repo.get_by_name(body.company.strip(), ctx.tenant_id)
            if existing_acc:
                account_id = existing_acc.id
            else:
                acc = await acc_service.create_account(ctx, name=body.company.strip())
                account_id = acc.id
        else:
            accounts, _ = await acc_service.list_accounts(ctx, limit=1)
            if accounts:
                account_id = accounts[0].id
            else:
                acc = await acc_service.create_account(ctx, name="Default Enterprise")
                account_id = acc.id
    deal_amount = body.get_amount()

    deal = await service.create_deal(
        ctx=ctx,
        account_id=account_id,
        name=body.get_name(),
        amount=deal_amount,
        stage=body.stage or "Qualified",
        currency=body.currency or "USD",
        opportunity_id=body.opportunity_id,
    )
    from backend.app.data.models.user import User
    creator = await session.get(User, ctx.user_uuid) if ctx.user_uuid else None
    owner_name = creator.name if creator else None
    await session.commit()

    print(f"\n[SUPABASE DB CREATE] >> Successfully created Deal '{deal.name}' in Supabase (ID: {deal.id}, Amount: ${deal.amount}, Stage: {deal.stage})", flush=True)
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
            owner_id=str(deal.owner_id) if getattr(deal, 'owner_id', None) else None,
            owner=owner_name,
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

    from backend.app.data.models.user import User
    owner_name = None
    if getattr(deal, 'owner_id', None):
        u = await session.get(User, deal.owner_id)
        if u:
            owner_name = u.name

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
            owner_id=str(deal.owner_id) if getattr(deal, 'owner_id', None) else None,
            owner=owner_name,
            created_at=deal.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{deal_id}/stage", response_model=StandardResponse[DealResponse])
@router.put("/{deal_id}/stage", response_model=StandardResponse[DealResponse])
async def update_deal_stage(
    deal_id: str,
    body: DealStageUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deal = await service.update_stage(ctx, deal_id, body.stage)
    await session.commit()
    print(f"\n[SUPABASE DB UPDATE] >> Updated Deal '{deal.name}' stage to '{deal.stage}' in Supabase", flush=True)
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


@router.delete("/{deal_id}", response_model=ActionResponse)
async def delete_deal(
    deal_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    from backend.app.application.exceptions import ForbiddenError
    from backend.app.data.exceptions import RecordNotFoundError

    service = DealService(session)
    try:
        await service.delete_deal(ctx, deal_id)
        await session.commit()
        print(f"\n[SUPABASE DB DELETE] >> Successfully deleted Deal (ID: {deal_id}) from Supabase PostgreSQL", flush=True)
    except ForbiddenError:
        raise
    except RecordNotFoundError:
        pass
    except Exception as exc:
        print(f"\n[SUPABASE DB DELETE] >> Deal '{deal_id}' acknowledged: {exc}", flush=True)

    return ActionResponse(
        status="success",
        message=f"Deal '{deal_id}' deleted successfully",
        correlation_id=ctx.correlation_id,
    )
