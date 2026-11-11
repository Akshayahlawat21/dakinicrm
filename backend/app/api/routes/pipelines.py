from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.pipeline_service import PipelineService
from backend.app.api.schemas.pipeline import (
    PipelineResponse,
    PipelineStageResponse,
    PipelineCreateRequest,
    PipelineStageCreateRequest,
    PipelineStageUpdateRequest,
    PipelineStageReorderRequest,
)
from backend.app.api.schemas.common import StandardResponse

router = APIRouter(prefix="/v1/pipelines", tags=["Pipelines & Custom Stages"])


@router.get("", response_model=StandardResponse[List[PipelineResponse]])
async def list_pipelines(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    CRM-BE-04: Returns organization pipelines and visible ordered columns
    (shared core 'org' stages + caller's own 'personal' custom columns).
    """
    service = PipelineService(session)
    data = await service.list_pipelines(ctx)
    return StandardResponse(
        status="success",
        data=[PipelineResponse(**p) for p in data],
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[PipelineResponse], status_code=201)
async def create_pipeline(
    body: PipelineCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = PipelineService(session)
    created = await service.create_pipeline(ctx, name=body.name, description=body.description)
    return StandardResponse(
        status="success",
        data=PipelineResponse(**created),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{pipeline_id}/stages", response_model=StandardResponse[PipelineStageResponse], status_code=201)
async def create_pipeline_stage(
    pipeline_id: str,
    body: PipelineStageCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    CRM-BE-04: Creates a new custom Kanban stage column inside a pipeline.
    Any role (Owner, Manager, Salesperson) can add 'personal' columns from any active stage header.
    """
    service = PipelineService(session)
    created = await service.create_stage(
        ctx=ctx,
        pipeline_id=pipeline_id,
        name=body.name,
        parent_stage_id=body.parent_stage_id,
        parent_base_stage=body.parent_base_stage,
        color=body.color,
        win_probability=body.win_probability,
        qualification_tags=body.qualification_tags,
        scope=body.scope,
    )
    return StandardResponse(
        status="success",
        data=PipelineStageResponse(**created),
        correlation_id=ctx.correlation_id,
    )


@router.put("/{pipeline_id}/stages/reorder", response_model=StandardResponse[List[PipelineStageResponse]])
async def reorder_pipeline_stages(
    pipeline_id: str,
    body: PipelineStageReorderRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """CRM-BE-04: Reorders stage columns in the active pipeline."""
    service = PipelineService(session)
    stages = await service.reorder_stages(ctx, pipeline_id=pipeline_id, stage_ids=body.stage_ids)
    return StandardResponse(
        status="success",
        data=[PipelineStageResponse(**s) for s in stages],
        correlation_id=ctx.correlation_id,
    )


@router.put("/{pipeline_id}/stages/{stage_id}", response_model=StandardResponse[PipelineStageResponse])
async def update_pipeline_stage(
    pipeline_id: str,
    stage_id: str,
    body: PipelineStageUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """CRM-BE-04: Renames or updates color, win probability, or qualification tags for a column."""
    service = PipelineService(session)
    updated = await service.update_stage(
        ctx=ctx,
        pipeline_id=pipeline_id,
        stage_id=stage_id,
        name=body.name,
        color=body.color,
        win_probability=body.win_probability,
        qualification_tags=body.qualification_tags,
    )
    return StandardResponse(
        status="success",
        data=PipelineStageResponse(**updated),
        correlation_id=ctx.correlation_id,
    )


@router.delete("/{pipeline_id}/stages/{stage_id}", response_model=StandardResponse[dict])
async def delete_pipeline_stage(
    pipeline_id: str,
    stage_id: str,
    reassign_to: Optional[str] = Query(None, description="Optional destination stage UUID; defaults to parent column or Qualified"),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    CRM-BE-05: Safely removes a custom column and atomically transfers all deals
    to `reassign_to` or falls back automatically to parent stage / Qualified.
    """
    service = PipelineService(session)
    result = await service.delete_stage(
        ctx=ctx,
        pipeline_id=pipeline_id,
        stage_id=stage_id,
        reassign_to=reassign_to,
    )
    return StandardResponse(
        status="success",
        data=result,
        correlation_id=ctx.correlation_id,
    )

