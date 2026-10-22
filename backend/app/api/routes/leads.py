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
    dtos = [
        LeadResponse(
            id=str(l.id),
            organization_id=str(l.organization_id),
            name=l.name,
            email=l.email,
            phone=l.phone,
            industry=l.industry,
            status=l.status,
            score=l.score,
            assigned_to=str(l.assigned_to) if l.assigned_to else None,
            created_at=l.created_at,
        )
        for l in leads
    ]
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
        name=body.name,
        company=body.company,
        email=body.email,
        phone=body.phone,
        industry=body.industry,
        source=body.source,
        score=body.score or 50,
        assigned_to=body.assigned_to,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=LeadResponse(
            id=str(lead.id),
            organization_id=str(lead.organization_id),
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            industry=lead.industry,
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
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
    return StandardResponse(
        status="success",
        data=LeadResponse(
            id=str(lead.id),
            organization_id=str(lead.organization_id),
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            industry=lead.industry,
            status=lead.status,
            score=lead.score,
            assigned_to=str(lead.assigned_to) if lead.assigned_to else None,
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
    result["correlation_id"] = ctx.correlation_id
    return result
