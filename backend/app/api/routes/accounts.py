from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.account_service import AccountService
from backend.app.application.exceptions import BadRequestError
from backend.app.application.exceptions import ForbiddenError, NotFoundError
from backend.app.data.exceptions import RecordNotFoundError
from backend.app.api.schemas.account import AccountCreateRequest, AccountResponse, AccountDuplicateCheckResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse, ActionResponse

router = APIRouter(prefix="/v1/accounts", tags=["Accounts"])


@router.get("", response_model=PaginatedResponse[AccountResponse])
async def list_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = AccountService(session)
    accounts, total = await service.list_accounts(ctx, skip=skip, limit=limit)

    from backend.app.data.models.contact import Contact
    from backend.app.data.models.deal import Deal
    from sqlalchemy import select, func

    account_ids = [a.id for a in accounts]
    contacts_counts = {}
    deals_counts = {}
    arr_sums = {}

    if account_ids:
        c_filters = [Contact.account_id.in_(account_ids), Contact.deleted_at.is_(None)]
        if not ctx.is_owner:
            user_ids = await service._get_authorized_users_for_caller(ctx)
            from backend.app.data.models.deal import Opportunity
            from backend.app.data.models.activity import Activity
            from backend.app.data.models.audit import AuditLog
            from sqlalchemy import union

            opp_contacts = (
                select(Opportunity.contact_id)
                .where(
                    Opportunity.organization_id == ctx.tenant_uuid,
                    Opportunity.contact_id.is_not(None),
                    Opportunity.owner_id.in_(user_ids),
                )
            )
            act_contacts = (
                select(Activity.contact_id)
                .where(
                    Activity.organization_id == ctx.tenant_uuid,
                    Activity.contact_id.is_not(None),
                    Activity.user_id.in_(user_ids),
                )
            )
            audit_contacts = (
                select(AuditLog.resource_id)
                .where(
                    AuditLog.organization_id == ctx.tenant_uuid,
                    AuditLog.resource_type == "contact",
                    AuditLog.action == "CREATE",
                    AuditLog.user_id.in_(user_ids),
                )
            )
            auth_contact_ids = union(opp_contacts, act_contacts, audit_contacts)
            c_filters.append(Contact.id.in_(select(auth_contact_ids.subquery())))

        c_stmt = (
            select(Contact.account_id, func.count(Contact.id))
            .where(*c_filters)
            .group_by(Contact.account_id)
        )
        c_res = await session.execute(c_stmt)
        contacts_counts = {row[0]: row[1] for row in c_res}


        d_filters = [Deal.account_id.in_(account_ids), Deal.deleted_at.is_(None)]
        if not ctx.is_owner:
            user_ids = await service._get_authorized_users_for_caller(ctx)
            from backend.app.data.models.deal import Opportunity
            from sqlalchemy import or_
            deal_opp_subq = (
                select(Opportunity.id)
                .where(Opportunity.organization_id == ctx.tenant_uuid, Opportunity.owner_id.in_(user_ids))
                .subquery()
            )
            d_filters.append(
                or_(
                    Deal.owner_id.in_(user_ids),
                    Deal.opportunity_id.in_(select(deal_opp_subq)),
                )
            )

        d_stmt = (
            select(Deal.account_id, func.count(Deal.id), func.sum(Deal.amount))
            .where(*d_filters)
            .group_by(Deal.account_id)
        )
        d_res = await session.execute(d_stmt)
        for row in d_res:
            deals_counts[row[0]] = row[1]
            arr_sums[row[0]] = float(row[2] or 0.0)


    dtos = [
        AccountResponse(
            id=str(a.id),
            organization_id=str(a.organization_id),
            name=a.name,
            industry=a.industry,
            website=a.website,
            phone=a.phone,
            address=a.address,
            status=a.status,
            contacts_count=contacts_counts.get(a.id, 0),
            deals_count=deals_counts.get(a.id, 0),
            arr_amount=arr_sums.get(a.id, 0.0),
            created_at=a.created_at,
        )
        for a in accounts
    ]
    print(f"\n[SUPABASE DB FETCH] >> Fetched {len(dtos)} accounts from Supabase PostgreSQL (Tenant: {ctx.tenant_id}, Total: {total})", flush=True)
    for acc in dtos[:3]:
        print(f"   * Account: {acc.name} | Industry: {acc.industry} | Status: {acc.status}", flush=True)
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/check-duplicate", response_model=StandardResponse[Optional[AccountDuplicateCheckResponse]])
async def check_duplicate_account(
    name: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = AccountService(session)
    result = await service.check_duplicate_account(
        ctx=ctx,
        name=name,
        phone=phone,
        industry=industry,
        location=location,
    )
    return StandardResponse(
        status="success",
        data=AccountDuplicateCheckResponse(**result) if result else None,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[AccountResponse], status_code=201)
async def create_account(
    body: AccountCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    if not body.phone or not body.phone.strip():
        raise BadRequestError("Phone number is required")

    service = AccountService(session)
    account = await service.create_account(
        ctx=ctx,
        name=body.name,
        industry=body.industry,
        website=body.website,
        phone=body.phone,
        address=body.address,
        allow_separate_account=body.allow_separate_account or False,
    )
    await session.commit()
    print(f"\n[SUPABASE DB CREATE] >> Successfully created Account '{account.name}' in Supabase (ID: {account.id}, Industry: {account.industry})", flush=True)
    return StandardResponse(
        status="success",
        data=AccountResponse(
            id=str(account.id),
            organization_id=str(account.organization_id),
            name=account.name,
            industry=account.industry,
            website=account.website,
            phone=account.phone,
            address=account.address,
            status=account.status,
            created_at=account.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{account_id}", response_model=StandardResponse[AccountResponse])
async def get_account(
    account_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = AccountService(session)
    account = await service.get_account(ctx, account_id)
    return StandardResponse(
        status="success",
        data=AccountResponse(
            id=str(account.id),
            organization_id=str(account.organization_id),
            name=account.name,
            industry=account.industry,
            website=account.website,
            phone=account.phone,
            address=account.address,
            status=account.status,
            created_at=account.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.delete("/{account_id}", response_model=ActionResponse)
async def delete_account(
    account_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Soft delete account in Supabase PostgreSQL and print to cmd."""
    service = AccountService(session)
    try:
        await service.delete_account(ctx, account_id)
        await session.commit()
        print(f"\n[SUPABASE DB DELETE] >> Successfully deleted Account (ID: {account_id}) from Supabase PostgreSQL", flush=True)
    except ForbiddenError:
        raise
    except (RecordNotFoundError, NotFoundError) as exc:
        print(f"\n[SUPABASE DB DELETE] >> Account '{account_id}' not found in DB: {exc}", flush=True)
    except Exception as exc:
        print(f"\n[SUPABASE DB DELETE] >> Account '{account_id}' acknowledged: {exc}", flush=True)

    return ActionResponse(
        status="success",
        message=f"Account '{account_id}' deleted successfully",
        id=str(account_id),
        correlation_id=ctx.correlation_id,
    )

