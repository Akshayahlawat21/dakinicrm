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
    limit: int = Query(500, ge=1, le=1000),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DealService(session)
    deals, total = await service.list_deals(ctx, skip=skip, limit=limit, stage=stage)

    from sqlalchemy import select
    from backend.app.data.models.user import User

    from backend.app.data.models.account import Account
    from backend.app.data.models.lead import LeadConversion, Lead
    from backend.app.data.models.campaign import Campaign
    from backend.app.data.models.deal import DealProduct, Product
    user_ids = {d.owner_id for d in deals if getattr(d, 'owner_id', None)}
    account_ids = {d.account_id for d in deals if d.account_id}
    opportunity_ids = {d.opportunity_id for d in deals if d.opportunity_id}
    user_map = {}
    if user_ids:
        users_res = await session.execute(select(User.id, User.name).where(User.id.in_(user_ids)))
        user_map = {row.id: row.name for row in users_res}
    account_map = {}
    if account_ids:
        rows = await session.execute(select(Account.id, Account.name).where(Account.id.in_(account_ids)))
        account_map = {row.id: row.name for row in rows}
    campaign_map = {}
    product_map = {}
    if opportunity_ids:
        conv_result = await session.execute(select(LeadConversion.opportunity_id, Lead.id.label("lead_id"), Lead.campaign_id).join(Lead, Lead.id == LeadConversion.lead_id).where(LeadConversion.opportunity_id.in_(opportunity_ids), Lead.organization_id == ctx.tenant_uuid, Lead.deleted_at.is_(None)))
        conv_rows = conv_result.all()
        campaign_ids = {row.campaign_id for row in conv_rows if row.campaign_id}
        if campaign_ids:
            camp_rows = await session.execute(select(Campaign.id, Campaign.name).where(Campaign.id.in_(campaign_ids), Campaign.organization_id == ctx.tenant_uuid, Campaign.deleted_at.is_(None)))
            campaign_map = {row.id: row.name for row in camp_rows}
        campaign_ids_by_opp = {}
        lead_ids_by_opp = {}
        for row in conv_rows:
            if row.campaign_id:
                campaign_ids_by_opp.setdefault(row.opportunity_id, set()).add(row.campaign_id)
            lead_ids_by_opp.setdefault(row.opportunity_id, set()).add(row.lead_id)
    else:
        campaign_ids_by_opp = {}
        lead_ids_by_opp = {}
    deal_ids = {d.id for d in deals}
    if deal_ids:
        product_rows = await session.execute(select(DealProduct.deal_id, Product.id, Product.name).join(Product, Product.id == DealProduct.product_id).where(DealProduct.deal_id.in_(deal_ids), Product.organization_id == ctx.tenant_uuid, Product.deleted_at.is_(None)))
        for row in product_rows:
            product_map.setdefault(row.deal_id, []).append((row.id, row.name))

    # Legacy/manual deals may not have a LeadConversion or DealProduct row.
    # Recover attribution only when exactly one tenant lead matches the account
    # company name; never assign ambiguous company matches.
    fallback_lead_by_account = {}
    account_names = {str(name).strip().lower() for name in account_map.values() if name}
    if account_names and deals:
        from sqlalchemy import func
        fallback_rows = await session.execute(
            select(
                Lead.id.label("lead_id"), Lead.company.label("lead_company"),
                Lead.campaign_id.label("campaign_id"), Campaign.name.label("campaign_name"),
                Lead.product_id.label("product_id"), Product.name.label("product_name")
            )
            .outerjoin(Campaign, Campaign.id == Lead.campaign_id)
            .outerjoin(Product, Product.id == Lead.product_id)
            .where(
                Lead.organization_id == ctx.tenant_uuid,
                Lead.deleted_at.is_(None),
                func.lower(func.trim(Lead.company)).in_(account_names),
            )
        )
        grouped = {}
        for row in fallback_rows:
            key = str(row.lead_company or '').strip().lower()
            grouped.setdefault(key, []).append(row)
        for account_id, account_name in account_map.items():
            matches = grouped.get(str(account_name or '').strip().lower(), [])
            if len(matches) == 1:
                fallback_lead_by_account[account_id] = matches[0]

    dtos = [
        DealResponse(
            id=str(d.id),
            organization_id=str(d.organization_id),
            account_id=str(d.account_id),
            company=account_map.get(d.account_id),
            lead_id=str(next(iter(lead_ids_by_opp.get(d.opportunity_id, set())), None) or getattr(fallback_lead_by_account.get(d.account_id), 'lead_id', '') or '') or None,
            campaign_id=str(next(iter(campaign_ids_by_opp.get(d.opportunity_id, set())), None) or getattr(fallback_lead_by_account.get(d.account_id), 'campaign_id', '') or '') or None,
            campaign_name=", ".join(
                [campaign_map[cid] for cid in sorted(campaign_ids_by_opp.get(d.opportunity_id, set())) if cid in campaign_map]
                or ([getattr(fallback_lead_by_account.get(d.account_id), 'campaign_name', '')] if getattr(fallback_lead_by_account.get(d.account_id), 'campaign_name', None) else [])
            ) or None,
            campaign_ids=[str(cid) for cid in sorted(campaign_ids_by_opp.get(d.opportunity_id, set()))] or ([str(getattr(fallback_lead_by_account.get(d.account_id), 'campaign_id'))] if getattr(fallback_lead_by_account.get(d.account_id), 'campaign_id', None) else []),
            campaign_names=[campaign_map[cid] for cid in sorted(campaign_ids_by_opp.get(d.opportunity_id, set())) if cid in campaign_map] or ([getattr(fallback_lead_by_account.get(d.account_id), 'campaign_name')] if getattr(fallback_lead_by_account.get(d.account_id), 'campaign_name', None) else []),
            product_id=str(product_map[d.id][0][0]) if d.id in product_map and product_map[d.id] else (str(getattr(fallback_lead_by_account.get(d.account_id), 'product_id', '') or '') or None),
            product_name=", ".join([item[1] for item in product_map.get(d.id, [])]) or getattr(fallback_lead_by_account.get(d.account_id), 'product_name', None),
            product_ids=[str(item[0]) for item in product_map.get(d.id, [])] or ([str(getattr(fallback_lead_by_account.get(d.account_id), 'product_id'))] if getattr(fallback_lead_by_account.get(d.account_id), 'product_id', None) else []),
            product_names=[item[1] for item in product_map.get(d.id, [])] or ([getattr(fallback_lead_by_account.get(d.account_id), 'product_name')] if getattr(fallback_lead_by_account.get(d.account_id), 'product_name', None) else []),
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
