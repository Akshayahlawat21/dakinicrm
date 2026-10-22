from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.account_service import AccountService
from backend.app.api.schemas.account import AccountCreateRequest, AccountResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

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
    dtos = [
        AccountResponse(
            id=str(a.id),
            organization_id=str(a.organization_id),
            name=a.name,
            industry=a.industry,
            website=a.website,
            phone=a.phone,
            status=a.status,
            created_at=a.created_at,
        )
        for a in accounts
    ]
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[AccountResponse], status_code=201)
async def create_account(
    body: AccountCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = AccountService(session)
    account = await service.create_account(
        ctx=ctx,
        name=body.name,
        industry=body.industry,
        website=body.website,
        phone=body.phone,
        address=body.address,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=AccountResponse(
            id=str(account.id),
            organization_id=str(account.organization_id),
            name=account.name,
            industry=account.industry,
            website=account.website,
            phone=account.phone,
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
            status=account.status,
            created_at=account.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )
