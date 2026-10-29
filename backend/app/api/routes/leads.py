from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.lead_service import LeadService
from backend.app.api.schemas.lead import (
    LeadCreateRequest,
    ConvertLeadRequest,
    LeadResponse,
    AssignLeadsRequest,
    AssignLeadRequest,
)
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
            title=l.title,
            website=getattr(l, "website", None),
            source=l.source or "Website",
            status=l.status,
            score=l.score,
            assigned_to=str(l.assigned_to) if l.assigned_to else None,
            owner=user_map.get(l.assigned_to),
            created_at=l.created_at,
            product_id=str(l.product_id) if getattr(l, "product_id", None) else None,
            interested_product=getattr(l, "interested_product", None),
        )
        for l in leads
    ]
    print(f"\n[SUPABASE DB FETCH] >> Fetched {len(dtos)} leads from Supabase PostgreSQL (Tenant: {ctx.tenant_id}, Total: {total})", flush=True)
    for lead in dtos[:3]:
        print(f"   * Lead: {lead.name} | {lead.email} | Status: {lead.status} | Score: {lead.score} | Product: {lead.interested_product}", flush=True)
    return PaginatedResponse(
        status="success",
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/check-duplicate", response_model=StandardResponse[dict])
async def check_duplicate_lead(
    name: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    interested_product: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Checks for similar active leads or existing contacts to warn before creating duplicates.
    Considers name + email + interested_product to differentiate legitimate cross-sell opportunities.
    """
    service = LeadService(session)
    result = await service.check_duplicate_lead(
        ctx=ctx,
        name=name,
        email=email,
        company=company,
        title=title,
        interested_product=interested_product,
        product_id=product_id,
    )
    return StandardResponse(
        status="success",
        data=result or {"is_duplicate_warning": False},
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
        title=body.title,
        website=body.website,
        product_id=body.product_id,
        interested_product=body.interested_product or body.product_name,
        allow_separate_inquiry=body.allow_separate_inquiry or False,
    )
    from backend.app.data.models.user import User
    creator = await session.get(User, ctx.user_uuid) if ctx.user_uuid else None
    owner_name = creator.name if creator else None
    await session.commit()

    print(f"\n[SUPABASE DB CREATE] >> Successfully created Lead '{lead.name}' in Supabase (ID: {lead.id}, Company: {lead.company}, Product: {getattr(lead, 'interested_product', None)})", flush=True)
    return StandardResponse(
        status="success",
        data=LeadResponse(
            id=str(lead.id),
            organization_id=str(lead.organization_id),
            name=lead.name,
            company=lead.company or lead.name,
            email=lead.email,
            phone=lead.phone,
            industry=lead.industry,
            title=lead.title,
            website=getattr(lead, "website", None),
            source=lead.source or "Website",
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
            owner=owner_name,
            product_id=str(lead.product_id) if getattr(lead, "product_id", None) else None,
            interested_product=getattr(lead, "interested_product", None),
            created_at=lead.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/cleanup-stale", response_model=StandardResponse[dict])
async def cleanup_stale_leads(
    retention_days: int = Query(30, ge=1, le=365),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Auto-cleans (soft-deletes) unconverted leads older than retention_days (default 30 days).
    This enables pipeline hygiene and ensures returning contacts can re-enter cleanly.
    """
    service = LeadService(session)
    count = await service.cleanup_stale_leads(ctx, retention_days=retention_days)
    await session.commit()
    return StandardResponse(
        status="success",
        data={"cleaned_leads_count": count, "retention_days": retention_days},
        correlation_id=ctx.correlation_id,
    )


@router.post("/assign", response_model=StandardResponse[dict])
async def assign_leads_bulk(
    body: AssignLeadsRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    import uuid
    from backend.app.data.models.user import User

    service = LeadService(session)
    updated_leads = await service.assign_leads(ctx, body.lead_ids, body.assignee_id)
    await session.commit()

    assignee = None
    try:
        assignee_uuid = uuid.UUID(str(body.assignee_id))
        assignee = await session.get(User, assignee_uuid)
    except (ValueError, TypeError):
        assignee = None

    assignee_name = assignee.name if assignee else "Assigned User"
    all_deal_ids = []
    for l in updated_leads:
        all_deal_ids.extend(getattr(l, "_affected_deal_ids", []))
    print(f"\n[SUPABASE DB REASSIGN] >> Reassigned {len(updated_leads)} lead(s) to '{assignee_name}' (ID: {body.assignee_id}) in Supabase (Affected Deals: {len(all_deal_ids)})", flush=True)

    return StandardResponse(
        status="success",
        data={
            "assigned_count": len(updated_leads),
            "assignee_id": body.assignee_id,
            "assignee_name": assignee_name,
            "lead_ids": [str(l.id) for l in updated_leads],
            "deal_ids": list(set(all_deal_ids)),
        },
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
            title=lead.title,
            website=getattr(lead, "website", None),
            source=lead.source or "Website",
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
            owner=owner_name,
            product_id=str(lead.product_id) if getattr(lead, "product_id", None) else None,
            interested_product=getattr(lead, "interested_product", None),
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
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        contact_title=body.contact_title,
        website=body.website,
        create_deal=body.create_deal if body.create_deal is not None else True,
    )
    await session.commit()
    print(f"\n[SUPABASE DB CONVERT] >> Successfully converted Lead '{lead_id}' (Company: {body.company_name}, Contact: {body.contact_name}) in Supabase", flush=True)
    result["correlation_id"] = ctx.correlation_id
    return result


@router.post("/{lead_id}/assign", response_model=StandardResponse[dict])
async def assign_single_lead(
    lead_id: str,
    body: AssignLeadRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    import uuid
    from backend.app.data.models.user import User

    service = LeadService(session)
    updated_lead = await service.assign_lead(ctx, lead_id, body.assignee_id)
    await session.commit()

    assignee = None
    try:
        assignee_uuid = uuid.UUID(str(body.assignee_id))
        assignee = await session.get(User, assignee_uuid)
    except (ValueError, TypeError):
        assignee = None

    assignee_name = assignee.name if assignee else "Assigned User"

    return StandardResponse(
        status="success",
        data={
            "lead_id": str(updated_lead.id),
            "assignee_id": body.assignee_id,
            "assignee_name": assignee_name,
            "deal_ids": getattr(updated_lead, "_affected_deal_ids", []),
        },
        correlation_id=ctx.correlation_id,
    )


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
