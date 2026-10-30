import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class CreateCallTranscriptRequest(BaseModel):
    raw_text: str = Field(..., description="Full verbatim call transcript")
    lead_id: Optional[str] = Field(None, description="UUID of associated Lead")
    subject: Optional[str] = Field(None, description="Activity subject e.g. Outbound Call with Ramesh")
    external_call_id: Optional[str] = Field(None, description="Dialer SID / external unique reference")
    diarization: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Speaker segmented turns")
    recording_url: Optional[str] = Field(None, description="Presigned audio URL")
    duration_seconds: int = Field(0, description="Call duration in seconds")


class CreateCallAnalysisRequest(BaseModel):
    activity_id: str = Field(..., description="UUID of the parent call Activity")
    transcript_id: Optional[str] = Field(None, description="UUID of the CallTranscript")
    sentiment: Optional[str] = Field("neutral", description="positive, neutral, negative")
    call_outcome: Optional[str] = Field(None, description="Outcome e.g. demo_scheduled, qualified")
    summary: Optional[Dict[str, Any]] = Field(default_factory=dict, description="AI summary, key signals, pain points")
    improvements: Optional[Any] = Field(default_factory=dict, description="Sales coaching and coaching tips")
    status: Optional[str] = Field("completed", description="pending, processing, completed, failed")
    model_version: Optional[str] = Field("gemini-2.0-flash", description="AI model version used")


class IngestCallAndAnalysisRequest(BaseModel):
    """Single-call ingestion storing activity, transcript, and AI analysis together."""
    raw_text: str = Field(..., description="Full verbatim call transcript")
    lead_id: Optional[str] = Field(None, description="UUID of associated Lead")
    subject: Optional[str] = Field(None, description="Activity subject")
    external_call_id: Optional[str] = Field(None, description="External dialer call SID")
    recording_url: Optional[str] = Field(None, description="Presigned audio URL")
    duration_seconds: int = Field(0, description="Duration in seconds")
    sentiment: Optional[str] = Field("neutral", description="positive, neutral, negative")
    call_outcome: Optional[str] = Field(None, description="Outcome e.g. demo_scheduled, qualified")
    summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    improvements: Optional[Any] = Field(default_factory=dict)
    model_version: Optional[str] = Field("gemini-2.0-flash")


class CallTranscriptResponse(BaseModel):
    id: str
    organization_id: str
    activity_id: str
    external_call_id: Optional[str] = None
    raw_text: str
    diarization: Optional[Any] = None
    recording_url: Optional[str] = None
    duration_seconds: Optional[int] = 0
    created_at: datetime


class CallAnalysisResponse(BaseModel):
    id: str
    organization_id: str
    activity_id: Optional[str] = None
    transcript_id: Optional[str] = None
    lead_id: Optional[str] = None
    lead_name: Optional[str] = None
    product_name: Optional[str] = None
    analyzed_by: Optional[str] = None
    analyst_name: Optional[str] = None
    sentiment: Optional[str] = "neutral"
    call_outcome: Optional[str] = None
    summary: Optional[Dict[str, Any]] = None
    improvements: Optional[Any] = None
    status: str
    error_message: Optional[str] = None
    model_version: Optional[str] = None
    analyzed_at: Optional[datetime] = None
    created_at: datetime


class CallAnalysisListResponse(BaseModel):
    items: List[CallAnalysisResponse]
    total: int
    skip: int
    limit: int


class CallMetricsResponse(BaseModel):
    total_analyses: int
    sentiment_distribution: Dict[str, int]
    call_outcomes: Dict[str, int]

