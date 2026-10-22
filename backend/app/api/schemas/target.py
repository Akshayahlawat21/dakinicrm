import uuid
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict


class TargetCreateRequest(BaseModel):
    assigned_to: str
    target_amount: float = Field(gt=0, description="Target quota amount must be > 0")
    period_start: date
    period_end: date
    period_type: Optional[str] = "monthly"
    currency: Optional[str] = "USD"
    team_id: Optional[str] = None
    notes: Optional[str] = None


class TargetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    assigned_to_user_id: str
    assigned_by_user_id: Optional[str] = None
    target_amount: float
    currency: str
    period_type: str
    period_start: date
    period_end: date
    status: str
    created_at: datetime
