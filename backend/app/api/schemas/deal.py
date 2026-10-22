import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DealCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    account_id: Optional[str] = None
    company: Optional[str] = None
    amount: Optional[float] = None
    value: Optional[float] = None
    stage: Optional[str] = "Qualified"
    currency: Optional[str] = "USD"
    opportunity_id: Optional[str] = None


class DealStageUpdateRequest(BaseModel):
    stage: str


class DealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    account_id: str
    name: str
    amount: float
    currency: str
    stage: str
    status: str
    created_at: datetime
