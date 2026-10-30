import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Path
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.call_service import CallService
from backend.app.api.schemas.calls import (
    CreateCallTranscriptRequest,
    CreateCallAnalysisRequest,
    IngestCallAndAnalysisRequest,
    CallTranscriptResponse,
    CallAnalysisResponse,
    CallMetricsResponse,
)
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/v1/calls", tags=["Calls & AI Analysis"])


def _serialize_analysis(analysis) -> CallAnalysisResponse:
    lead_name = analysis.lead.name if analysis.lead else None
    product_name = None
    if analysis.lead:
        product_name = getattr(analysis.lead, "interested_product", None)

    analyst_name = analysis.analyst.name if analysis.analyst else None

    return CallAnalysisResponse(
        id=str(analysis.id),
        organization_id=str(analysis.organization_id),
        activity_id=str(analysis.activity_id) if analysis.activity_id else None,
        transcript_id=str(analysis.transcript_id) if analysis.transcript_id else None,
        lead_id=str(analysis.lead_id) if analysis.lead_id else None,
        lead_name=lead_name,
        product_name=product_name,
        analyzed_by=str(analysis.analyzed_by) if analysis.analyzed_by else None,
        analyst_name=analyst_name,
        sentiment=analysis.sentiment,
        call_outcome=analysis.call_outcome,
        summary=analysis.summary or {},
        improvements=analysis.improvements or {},
        status=analysis.status,
        error_message=analysis.error_message,
        model_version=analysis.model_version,
        analyzed_at=analysis.analyzed_at,
        created_at=analysis.created_at,
    )


@router.post("/transcripts", response_model=StandardResponse[CallTranscriptResponse])
async def create_transcript(
    payload: CreateCallTranscriptRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = CallService(session)
    activity, transcript = await service.create_call_record(
        ctx=ctx,
        raw_text=payload.raw_text,
        lead_id=payload.lead_id,
        subject=payload.subject,
        external_call_id=payload.external_call_id,
        diarization=payload.diarization,
        recording_url=payload.recording_url,
        duration_seconds=payload.duration_seconds,
    )
    await session.commit()
    dto = CallTranscriptResponse(
        id=str(transcript.id),
        organization_id=str(transcript.organization_id),
        activity_id=str(transcript.activity_id),
        external_call_id=transcript.external_call_id,
        raw_text=transcript.raw_text,
        diarization=transcript.diarization,
        recording_url=transcript.recording_url,
        duration_seconds=transcript.duration_seconds,
        created_at=transcript.created_at,
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/analysis", response_model=StandardResponse[CallAnalysisResponse])
async def record_analysis(
    payload: CreateCallAnalysisRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = CallService(session)
    analysis = await service.record_call_analysis(
        ctx=ctx,
        activity_id=payload.activity_id,
        transcript_id=payload.transcript_id,
        sentiment=payload.sentiment or "neutral",
        call_outcome=payload.call_outcome,
        summary=payload.summary,
        improvements=payload.improvements,
        status=payload.status or "completed",
        model_version=payload.model_version or "gemini-2.0-flash",
    )
    await session.commit()
    dto = _serialize_analysis(analysis)
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/ingest", response_model=StandardResponse[CallAnalysisResponse])
async def ingest_call_and_analysis(
    payload: IngestCallAndAnalysisRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Combined ingestion endpoint: saves activity, transcript, and AI analysis in one atomic operation.
    """
    service = CallService(session)
    activity, transcript = await service.create_call_record(
        ctx=ctx,
        raw_text=payload.raw_text,
        lead_id=payload.lead_id,
        subject=payload.subject,
        external_call_id=payload.external_call_id,
        recording_url=payload.recording_url,
        duration_seconds=payload.duration_seconds,
    )
    analysis = await service.record_call_analysis(
        ctx=ctx,
        activity_id=activity.id,
        transcript_id=transcript.id,
        sentiment=payload.sentiment or "neutral",
        call_outcome=payload.call_outcome,
        summary=payload.summary,
        improvements=payload.improvements,
        status="completed",
        model_version=payload.model_version or "gemini-2.0-flash",
    )
    await session.commit()
    dto = _serialize_analysis(analysis)
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.get("/analysis", response_model=PaginatedResponse[CallAnalysisResponse])
async def list_analyses(
    product_id: Optional[str] = Query(None),
    lead_id: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),
    call_outcome: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Lists call analyses with Owner/Manager/Salesperson RBAC and product filtering.
    """
    service = CallService(session)
    items, total = await service.list_analyses(
        ctx=ctx,
        product_id=product_id,
        lead_id=lead_id,
        sentiment=sentiment,
        call_outcome=call_outcome,
        status=status,
        skip=skip,
        limit=limit,
    )
    dtos = [_serialize_analysis(a) for a in items]
    return PaginatedResponse(
        data=dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.get("/analysis/{analysis_id}", response_model=StandardResponse[CallAnalysisResponse])
async def get_analysis(
    analysis_id: str = Path(..., description="UUID of call analysis"),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Fetches a single call analysis with RBAC permission check.
    """
    service = CallService(session)
    analysis = await service.get_analysis(ctx, analysis_id)
    dto = _serialize_analysis(analysis)
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.get("/metrics", response_model=StandardResponse[CallMetricsResponse])
async def get_metrics(
    product_id: Optional[str] = Query(None),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Fetches aggregated metrics (sentiment breakdown, outcomes, total count) with RBAC.
    """
    service = CallService(session)
    metrics = await service.get_metrics(ctx, product_id=product_id)
    dto = CallMetricsResponse(
        total_analyses=metrics["total_analyses"],
        sentiment_distribution=metrics["sentiment_distribution"],
        call_outcomes=metrics["call_outcomes"],
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)

