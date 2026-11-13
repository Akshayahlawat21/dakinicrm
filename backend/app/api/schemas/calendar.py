import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CalendarEventCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    company: Optional[str] = None
    type: Optional[str] = "meeting"  # meeting, call, follow-up, demo, task, review
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    day_number: Optional[int] = None
    month_index: Optional[int] = None
    year: Optional[int] = None
    hour: Optional[int] = None
    duration: Optional[str] = "30m"
    location: Optional[str] = None  # Google Meet / Zoom link
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    attendees: Optional[List[str]] = None
    assigned_to: Optional[str] = None  # user_id
    lead_id: Optional[str] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    sync_task: Optional[bool] = False


class CalendarEventStatusUpdateRequest(BaseModel):
    status: str  # scheduled, completed, canceled


class CalendarEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    title: str
    company: Optional[str] = None
    type: str
    time: Optional[str] = None
    hour: Optional[int] = None
    day_number: Optional[int] = None
    month_index: Optional[int] = None
    year: Optional[int] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    duration_seconds: Optional[int] = 0
    location: Optional[str] = None
    video_url: Optional[str] = None
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "scheduled"
    completed: bool = False
    attendees: Optional[List[str]] = None
    created_at: datetime

