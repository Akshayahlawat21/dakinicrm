from fastapi import APIRouter, Depends, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.calendar_service import CalendarService
from backend.app.api.schemas.calendar import (
    CalendarEventCreateRequest,
    CalendarEventStatusUpdateRequest,
    CalendarEventResponse,
)
from backend.app.api.schemas.common import StandardResponse, ActionResponse

router = APIRouter(prefix="/v1/calendar", tags=["Calendar & Meetings"])


@router.get("", response_model=StandardResponse[List[Dict[str, Any]]])
async def list_calendar_events(
    status: Optional[str] = Query(None),
    scope: Optional[str] = Query("personal"),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Retrieves database-backed calendar events from Supabase `activities` table.
    Enforces multi-tenant isolation, user-level personal calendar isolation, and role-based permissions.
    """
    service = CalendarService(session)
    events = await service.list_events(ctx, status_filter=status, scope=scope)
    await session.commit()

    return StandardResponse(
        status="success",
        data=events,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[Dict[str, Any]], status_code=201)
async def create_calendar_event(
    body: CalendarEventCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Creates a new calendar event / meeting / follow-up stored in `activities` table.
    """
    service = CalendarService(session)
    activity = await service.create_event(
        ctx=ctx,
        title=body.title,
        company=body.company,
        type=body.type or "meeting",
        start_at=body.start_at,
        end_at=body.end_at,
        day_number=body.day_number,
        month_index=body.month_index,
        year=body.year,
        hour=body.hour,
        duration=body.duration or "30m",
        location=body.location,
        description=body.description,
        priority=body.priority or "medium",
        attendees=body.attendees,
        sync_task=body.sync_task or False,
    )
    await session.commit()

    return StandardResponse(
        status="success",
        data={
            "id": str(activity.id),
            "title": activity.subject,
            "type": activity.type,
            "status": activity.status,
            "start_at": activity.start_at.isoformat() if activity.start_at else None,
            "location": activity.location,
        },
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{event_id}/status", response_model=StandardResponse[Dict[str, Any]])
async def update_event_status(
    event_id: str,
    body: CalendarEventStatusUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Toggles completion status ('completed' or 'scheduled') on an activity.
    """
    service = CalendarService(session)
    activity = await service.update_status(ctx, event_id=event_id, status=body.status)
    await session.commit()

    return StandardResponse(
        status="success",
        data={
            "id": str(activity.id),
            "status": activity.status,
            "completed": activity.status == "completed",
        },
        correlation_id=ctx.correlation_id,
    )


@router.delete("/{event_id}", response_model=ActionResponse)
async def delete_calendar_event(
    event_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Permanently deletes a calendar event from `activities`.
    """
    service = CalendarService(session)
    await service.delete_event(ctx, event_id=event_id)
    await session.commit()

    return ActionResponse(
        status="success",
        message="Calendar event deleted successfully",
        correlation_id=ctx.correlation_id,
    )

