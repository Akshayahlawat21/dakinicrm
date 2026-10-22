from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.contact_service import ContactService
from backend.app.api.schemas.contact import ContactCreateRequest, ContactResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

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
    dtos = [
        ContactResponse(
            id=str(c.id),
            account_id=str(c.account_id),
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
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[ContactResponse], status_code=201)
async def create_contact(
    body: ContactCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = ContactService(session)
    contact = await service.create_contact(
        ctx=ctx,
        account_id=body.account_id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        phone=body.phone,
        title=body.title,
        department=body.department,
    )
    await session.commit()
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
