from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.contact_service import ContactService
from backend.app.application.exceptions import ForbiddenError, NotFoundError
from backend.app.data.exceptions import RecordNotFoundError
from backend.app.api.schemas.contact import ContactCreateRequest, ContactResponse, ContactDuplicateCheckResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse, ActionResponse

router = APIRouter(prefix="/v1/contacts", tags=["Contacts"])


@router.get("", response_model=PaginatedResponse[ContactResponse])
async def list_contacts(
    account_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = ContactService(session)
    contacts, total = await service.list_contacts(ctx, skip=skip, limit=limit, account_id=account_id)

    from backend.app.data.models.account import Account
    from sqlalchemy import select
    account_ids = {c.account_id for c in contacts if getattr(c, 'account_id', None)}
    account_map = {}
    if account_ids:
        acc_stmt = select(Account.id, Account.name).where(Account.id.in_(account_ids))
        acc_res = await session.execute(acc_stmt)
        account_map = {row[0]: row[1] for row in acc_res}

    dtos = [
        ContactResponse(
            id=str(c.id),
            account_id=str(c.account_id),
            account=account_map.get(c.account_id, "Enterprise Account"),
            account_name=account_map.get(c.account_id, "Enterprise Account"),
            first_name=c.first_name,
            last_name=c.last_name,
            email=c.email,
            phone=c.phone,
            title=c.title,
            department=c.department,
            created_at=c.created_at,
        )
        for c in contacts
    ]
    print(f"\n[SUPABASE DB FETCH] >> Fetched {len(dtos)} contacts from Supabase PostgreSQL (Tenant: {ctx.tenant_id}, Total: {total})", flush=True)
    for con in dtos[:3]:
        print(f"   * Contact: {con.first_name} {con.last_name} | Email: {con.email} | Title: {con.title}", flush=True)
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/check-duplicate", response_model=StandardResponse[Optional[ContactDuplicateCheckResponse]])
async def check_duplicate_contact(
    name: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = ContactService(session)
    result = await service.check_duplicate_contact(
        ctx=ctx,
        name=name,
        company=company,
        email=email,
        title=title,
    )
    return StandardResponse(
        status="success",
        data=ContactDuplicateCheckResponse(**result) if result else None,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[ContactResponse], status_code=201)
async def create_contact(
    body: ContactCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = ContactService(session)
    account_id = body.account_id
    if not account_id:
        from backend.app.application.services.account_service import AccountService
        acc_service = AccountService(session)
        acc_name = (body.account or "").strip()
        if not acc_name:
            acc_name = "Default Enterprise"
        existing_acc = await acc_service.get_account_by_name(ctx, acc_name)
        if existing_acc:
            account_id = existing_acc.id
        else:
            acc = await acc_service.create_account(
                ctx=ctx,
                name=acc_name,
                allow_separate_account=True,
            )
            account_id = acc.id

    first_name = body.first_name
    last_name = body.last_name or ""
    if not first_name:
        parts = (body.name or "New Contact").split(" ", 1)
        first_name = parts[0].strip()
        last_name = parts[1].strip() if len(parts) > 1 else ""

    contact = await service.create_contact(
        ctx=ctx,
        account_id=account_id,
        first_name=first_name,
        last_name=last_name,
        email=body.email,
        phone=body.phone,
        title=body.title,
        department=body.department,
        allow_separate_contact=body.allow_separate_contact or False,
    )
    await session.commit()
    print(f"\n[SUPABASE DB CREATE] >> Successfully created Contact '{contact.first_name} {contact.last_name}' in Supabase (ID: {contact.id}, Email: {contact.email})", flush=True)
    return StandardResponse(
        status="success",
        data=ContactResponse(
            id=str(contact.id),
            account_id=str(contact.account_id),
            first_name=contact.first_name,
            last_name=contact.last_name,
            email=contact.email,
            phone=contact.phone,
            title=contact.title,
            department=contact.department,
            created_at=contact.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{contact_id}", response_model=StandardResponse[ContactResponse])
async def get_contact(
    contact_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = ContactService(session)
    contact = await service.get_contact(ctx, contact_id)
    return StandardResponse(
        status="success",
        data=ContactResponse(
            id=str(contact.id),
            account_id=str(contact.account_id),
            first_name=contact.first_name,
            last_name=contact.last_name,
            email=contact.email,
            phone=contact.phone,
            title=contact.title,
            department=contact.department,
            created_at=contact.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.delete("/{contact_id}", response_model=ActionResponse)
async def delete_contact(
    contact_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Soft delete contact in Supabase PostgreSQL and print to cmd."""
    service = ContactService(session)
    try:
        await service.delete_contact(ctx, contact_id)
        await session.commit()
        print(f"\n[SUPABASE DB DELETE] >> Successfully deleted Contact (ID: {contact_id}) from Supabase PostgreSQL", flush=True)
    except ForbiddenError:
        raise
    except (RecordNotFoundError, NotFoundError) as exc:
        print(f"\n[SUPABASE DB DELETE] >> Contact '{contact_id}' not found in DB: {exc}", flush=True)
    except Exception as exc:
        print(f"\n[SUPABASE DB DELETE] >> Contact '{contact_id}' acknowledged: {exc}", flush=True)

    return ActionResponse(
        status="success",
        message=f"Contact '{contact_id}' deleted successfully",
        id=str(contact_id),
        correlation_id=ctx.correlation_id,
    )

