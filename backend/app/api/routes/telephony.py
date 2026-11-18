from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.data.session import get_db_session
from backend.app.application.services.telephony_service import TelephonyService
from backend.app.api.schemas.telephony import (
    TelephonyConfigResponse,
    TelephonyTokenRequest,
    TelephonyTokenResponse,
    TelephonyCallRequest,
    TelephonyCallResponse,
    TelephonyHangupRequest,
    TelephonyHangupResponse,
    TelephonyRoomStatusResponse,
    TelephonyDTMFRequest,
    TelephonyDTMFResponse,
    TelephonyControlRequest,
    TelephonyControlResponse,
    TelephonyMergeRequest,
)
from backend.app.api.schemas.common import StandardResponse

router = APIRouter(prefix="/v1/telephony", tags=["Telephony & Softphone"])


@router.get("/config", response_model=StandardResponse[TelephonyConfigResponse])
async def get_telephony_config(
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    cfg = service.get_config()
    dto = TelephonyConfigResponse(
        from_number=cfg["from_number"],
        signaling_url=cfg["signaling_url"],
        outbound_mode=cfg["outbound_mode"],
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/token", response_model=StandardResponse[TelephonyTokenResponse])
async def mint_telephony_token(
    payload: TelephonyTokenRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.generate_token(
        room=payload.room,
        identity=payload.identity,
        name=payload.name,
    )
    dto = TelephonyTokenResponse(
        success=res["success"],
        token=res["token"],
        url=res["url"],
        room=res["room"],
        identity=res["identity"],
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/call", response_model=StandardResponse[TelephonyCallResponse])
async def initiate_outbound_call(
    payload: TelephonyCallRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.initiate_call(
        to_number=payload.to_number,
        lead_id=payload.lead_id,
        contact_name=payload.contact_name,
        room=payload.room,
        record=payload.record,
        user_id=str(ctx.user_id) if ctx.user_id else None,
    )
    dto = TelephonyCallResponse(
        success=res["success"],
        call_id=res["call_id"],
        call_uuid=res.get("call_uuid"),
        room=res["room"],
        to_number=res["to_number"],
        from_number=res["from_number"],
        status=res["status"],
        mode=res["mode"],
        token=res.get("token"),
        server_url=res.get("server_url"),
        lead_id=res.get("lead_id"),
        contact_name=res.get("contact_name"),
        message=res.get("message"),
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/hangup", response_model=StandardResponse[TelephonyHangupResponse])
async def hangup_call(
    payload: TelephonyHangupRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.hangup(
        room=payload.room,
        call_id=payload.call_id,
        lead_id=payload.lead_id,
    )
    dto = TelephonyHangupResponse(
        success=res["success"],
        status=res["status"],
        room=res["room"],
        call_id=res.get("call_id"),
        duration_seconds=res.get("duration_seconds"),
        message=res.get("message"),
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.get("/room-status", response_model=StandardResponse[TelephonyRoomStatusResponse])
async def get_room_status(
    room: str = Query(..., description="LiveKit room ID"),
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.get_room_status(room=room)
    dto = TelephonyRoomStatusResponse(
        exists=res.get("exists", False),
        pstn_connected=res.get("pstn_connected", False),
        agent_connected=res.get("agent_connected", False),
        participants=res.get("participants", []),
        room=res.get("room", room),
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.get("/active", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_active_calls(
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    calls = await service.get_active_calls()
    return StandardResponse(data=calls, correlation_id=ctx.correlation_id)


@router.get("/history", response_model=StandardResponse[List[Dict[str, Any]]])
async def get_call_history(
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    history = await service.get_call_history()
    return StandardResponse(data=history, correlation_id=ctx.correlation_id)


@router.post("/dtmf", response_model=StandardResponse[TelephonyDTMFResponse])
async def send_dtmf(
    payload: TelephonyDTMFRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.send_dtmf(room=payload.room, digit=payload.digit)
    dto = TelephonyDTMFResponse(ok=res.get("ok", True), room=payload.room, digit=payload.digit)
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/control", response_model=StandardResponse[TelephonyControlResponse])
async def call_control(
    payload: TelephonyControlRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.call_control(
        call_id=payload.call_id,
        action=payload.action,
        transfer_to=payload.transfer_to,
    )
    dto = TelephonyControlResponse(
        success=res.get("success", False),
        call_id=res["call_id"],
        action=res["action"],
        status=res.get("status"),
        message=res.get("message"),
        error=res.get("error"),
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


@router.post("/merge", response_model=StandardResponse[TelephonyCallResponse])
async def merge_call(
    payload: TelephonyMergeRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    service = TelephonyService()
    res = await service.merge_call(
        room=payload.room,
        to_number=payload.to_number,
        contact_name=payload.contact_name,
        lead_id=payload.lead_id,
    )
    dto = TelephonyCallResponse(
        success=res["success"],
        call_id=res["call_id"],
        call_uuid=res.get("call_uuid"),
        room=res["room"],
        to_number=res["to_number"],
        from_number=res["from_number"],
        status=res["status"],
        mode=res["mode"],
        token=res.get("token"),
        server_url=res.get("server_url"),
        lead_id=res.get("lead_id"),
        contact_name=res.get("contact_name"),
        message=res.get("message"),
    )
    return StandardResponse(data=dto, correlation_id=ctx.correlation_id)


