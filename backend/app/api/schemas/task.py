import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TaskCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    subject: Optional[str] = None
    title: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    start_at: Optional[datetime] = None
    account_id: Optional[str] = None
    contact_id: Optional[str] = None
    opportunity_id: Optional[str] = None


class TaskStatusUpdateRequest(BaseModel):
    status: str  # scheduled, in_progress, completed, canceled


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    user_id: Optional[str] = None
    subject: str
    description: Optional[str] = None
    priority: str
    status: str
    start_at: Optional[datetime] = None
    created_at: datetime
