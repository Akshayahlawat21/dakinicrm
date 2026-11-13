from typing import Optional, List, Any
from pydantic import BaseModel, Field


class TelephonyTokenRequest(BaseModel):
    room: Optional[str] = Field(None, description="Unique LiveKit room ID")
    identity: Optional[str] = Field(None, description="WebRTC participant identity")
    name: Optional[str] = Field(None, description="Participant display name")


class TelephonyTokenResponse(BaseModel):
    success: bool = True
    token: str
    url: str
    room: str
    identity: str


class TelephonyCallRequest(BaseModel):
    to_number: str = Field(..., description="Destination E.164 phone number to dial")
    lead_id: Optional[str] = Field(None, description="Associated CRM lead ID")
    contact_name: Optional[str] = Field(None, description="Lead or contact display name")
    room: Optional[str] = Field(None, description="Pre-allocated room ID or None to auto-generate")
    record: bool = Field(True, description="Whether to record the call")


class TelephonyCallResponse(BaseModel):
    success: bool = True
    call_id: str
    call_uuid: Optional[str] = None
    room: str
    to_number: str
    from_number: str
    status: str
    mode: str
    token: Optional[str] = None
    server_url: Optional[str] = None
    lead_id: Optional[str] = None
    contact_name: Optional[str] = None
    message: Optional[str] = None


class TelephonyHangupRequest(BaseModel):
    room: str = Field(..., description="LiveKit room ID to terminate")
    call_id: Optional[str] = Field(None, description="Call ID returned when call was initiated")
    lead_id: Optional[str] = Field(None, description="Associated CRM lead ID")


class TelephonyHangupResponse(BaseModel):
    success: bool = True
    status: str
    room: str
    call_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    message: Optional[str] = None


class TelephonyRoomStatusResponse(BaseModel):
    exists: bool = False
    pstn_connected: bool = False
    agent_connected: bool = False
    participants: List[Any] = []
    room: Optional[str] = None


class TelephonyDTMFRequest(BaseModel):
    room: str = Field(..., description="Active call room ID")
    digit: str = Field(..., description="DTMF digit (0-9, *, #)")


class TelephonyDTMFResponse(BaseModel):
    ok: bool = True
    room: str
    digit: str


class TelephonyConfigResponse(BaseModel):
    from_number: str
    signaling_url: str
    outbound_mode: str


class TelephonyControlRequest(BaseModel):
    call_id: str = Field(..., description="Active call ID")
    action: str = Field(..., description="Action: hold, resume, transfer")
    transfer_to: Optional[str] = Field(None, description="Destination E.164 phone number if action is transfer")


class TelephonyControlResponse(BaseModel):
    success: bool = True
    call_id: str
    action: str
    status: Optional[str] = "applied"
    message: Optional[str] = None
    error: Optional[str] = None


class TelephonyMergeRequest(BaseModel):
    room: str = Field(..., description="Active LiveKit room ID to merge into")
    to_number: str = Field(..., description="Destination E.164 phone number to merge")
    contact_name: Optional[str] = Field(None, description="Contact or lead display name")
    lead_id: Optional[str] = Field(None, description="Associated CRM lead ID")


