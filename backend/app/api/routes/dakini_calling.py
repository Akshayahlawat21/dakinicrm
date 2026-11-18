from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.data.session import get_db_session
from backend.app.api.schemas.common import StandardResponse
from backend.app.api.schemas.dakini_calling import DakiniBatchCreateRequest, DakiniBatchScheduleRequest, DakiniLeadCallStatusRequest
from backend.app.application.services.dakini_calling_service import DakiniCallingService

router = APIRouter(prefix="/v1/dakini-calling", tags=["Dakini AI Calling"])


@router.post("/leads/{lead_id}/call", response_model=StandardResponse[dict])
async def call_single_lead(
    lead_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).initiate_single_call(lead_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.get("/leads/{lead_id}/latest-call", response_model=StandardResponse[dict | None])
async def get_latest_lead_call(
    lead_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).get_latest_lead_call(lead_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.post("/leads/call-statuses", response_model=StandardResponse[list[dict]])
async def get_lead_call_statuses(
    payload: DakiniLeadCallStatusRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Read persistent Dakini call history/status for the currently visible Leads page."""
    result = await DakiniCallingService(session, ctx).get_lead_call_statuses(payload.lead_ids)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.post("/batches", response_model=StandardResponse[dict])
async def create_call_batch(
    payload: DakiniBatchCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).create_batch(payload.lead_ids)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.post("/calls/{call_id}/analyze", response_model=StandardResponse[dict])
async def analyze_dakini_call(
    call_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Manually run Layer 5 analysis for one already-stored Dakini transcript."""
    result = await DakiniCallingService(session, ctx).manually_analyze_call(call_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.get("/calls/{call_id}", response_model=StandardResponse[dict])
async def get_call_status(
    call_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    # This endpoint reads the local CRM record only. The background worker handles Dakini API polling.
    result = await DakiniCallingService(session, ctx).get_call_state(call_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.get("/batches", response_model=StandardResponse[list[dict]])
async def list_call_batches(
    limit: int = 100,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).list_batches(limit=limit)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.get("/batches/{batch_id}/calls", response_model=StandardResponse[dict])
async def get_batch_calls(
    batch_id: str,
    skip: int = 0,
    limit: int = 100,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).get_batch_calls(batch_id, skip=skip, limit=limit)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.get("/batches/{batch_id}", response_model=StandardResponse[dict])
async def get_batch_status(
    batch_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    # Batch status and progress are served from CRM's automatically refreshed records.
    result = await DakiniCallingService(session, ctx).get_batch_state(batch_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.post("/batches/{batch_id}/schedule", response_model=StandardResponse[dict])
async def schedule_batch(
    batch_id: str,
    payload: DakiniBatchScheduleRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).schedule_batch(batch_id, payload.scheduled_at)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)


@router.post("/batches/{batch_id}/stop", response_model=StandardResponse[dict])
async def stop_batch(
    batch_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    result = await DakiniCallingService(session, ctx).stop_batch(batch_id)
    return StandardResponse(data=result, correlation_id=ctx.correlation_id)
