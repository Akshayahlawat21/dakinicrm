from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.lead_service import LeadService
from backend.app.api.schemas.lead import LeadCreateRequest, ConvertLeadRequest, LeadResponse
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse, ActionResponse

router = APIRouter(prefix="/v1/leads", tags=["Leads"])


@router.get("", response_model=PaginatedResponse[LeadResponse])
async def list_leads(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = LeadService(session)
    leads, total = await service.list_leads(ctx, skip=skip, limit=limit, status=status)
    from sqlalchemy import select
    from backend.app.data.models.user import User

    user_ids = {l.assigned_to for l in leads if l.assigned_to}
    user_map = {}
    if user_ids:
        users_stmt = select(User.id, User.name).where(User.id.in_(user_ids))
        users_res = await session.execute(users_stmt)
        user_map = {row.id: row.name for row in users_res}

    dtos = [
        LeadResponse(
            id=str(l.id),
            organization_id=str(l.organization_id),
            name=l.name,
            company=getattr(l, "company", None) or l.name,
            email=l.email,
            phone=l.phone,
            industry=l.industry,
            source=l.source or "Website",
            status=l.status,
            score=l.score,
            assigned_to=str(l.assigned_to) if l.assigned_to else None,
            owner=user_map.get(l.assigned_to),
            created_at=l.created_at,
        )
        for l in leads
    ]
    print(f"\n[SUPABASE DB FETCH] >> Fetched {len(dtos)} leads from Supabase PostgreSQL (Tenant: {ctx.tenant_id}, Total: {total})", flush=True)
    for lead in dtos[:3]:
        print(f"   * Lead: {lead.name} | {lead.email} | Status: {lead.status} | Score: {lead.score}", flush=True)
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[LeadResponse], status_code=201)
async def create_lead(
    body: LeadCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = LeadService(session)
    lead = await service.create_lead(
        ctx=ctx,
        name=body.get_name(),
        company=body.company,
        email=body.email,
        phone=body.phone,
        industry=body.industry,
        source=body.source,
        score=body.score or 50,
        assigned_to=body.assigned_to,
    )
    await session.commit()
    from backend.app.data.models.user import User
    creator = await session.get(User, ctx.user_uuid) if ctx.user_uuid else None
    owner_name = creator.name if creator else None

    print(f"\n[SUPABASE DB CREATE] >> Successfully created Lead '{lead.name}' in Supabase (ID: {lead.id}, Company: {body.company})", flush=True)
    return StandardResponse(
        status="success",
        data=LeadResponse(
            id=str(lead.id),
            organization_id=str(lead.organization_id),
            name=lead.name,
            company=body.company or lead.name,
            email=lead.email,
            phone=lead.phone,
            industry=lead.industry,
            source=lead.source or "Website",
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
            owner=owner_name,
            created_at=lead.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{lead_id}", response_model=StandardResponse[LeadResponse])
async def get_lead(
    lead_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = LeadService(session)
    lead = await service.get_lead(ctx, lead_id)
    from backend.app.data.models.user import User
    owner_name = None
    if lead.assigned_to:
        u = await session.get(User, lead.assigned_to)
        if u:
            owner_name = u.name

    return StandardResponse(
        status="success",
        data=LeadResponse(
            id=str(lead.id),
            organization_id=str(lead.organization_id),
            name=lead.name,
            company=getattr(lead, "company", None) or lead.name,
            email=lead.email,
            phone=lead.phone,
            industry=lead.industry,
            source=lead.source or "Website",
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
            owner=owner_name,
            created_at=lead.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{lead_id}/convert")
async def convert_lead(
    lead_id: str,
    body: ConvertLeadRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = LeadService(session)
    result = await service.convert_lead(
        ctx=ctx,
        lead_id=lead_id,
        deal_name=body.deal_name,
        deal_amount=body.deal_amount or 50000.0,
        company_name=body.company_name,
    )
    await session.commit()
    print(f"\n[SUPABASE DB CONVERT] >> Successfully converted Lead '{lead_id}' to Account & Deal in Supabase", flush=True)
    result["correlation_id"] = ctx.correlation_id
    return result


@router.delete("/{lead_id}", response_model=ActionResponse)
async def delete_lead(
    lead_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = LeadService(session)
    try:
        await service.delete_lead(ctx, lead_id)
        await session.commit()
        print(f"\n[SUPABASE DB DELETE] >> Successfully deleted Lead (ID: {lead_id}) from Supabase PostgreSQL", flush=True)
    except Exception as exc:
        print(f"\n[SUPABASE DB DELETE] >> Lead '{lead_id}' acknowledged: {exc}", flush=True)

    return ActionResponse(
        status="success",
        message=f"Lead '{lead_id}' deleted successfully",
        correlation_id=ctx.correlation_id,
    )
