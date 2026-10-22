import uuid
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    type: str = Field(default="Roadshow & In-Person", max_length=50)
    status: str = Field(default="Active", max_length=20)
    budget: float = Field(default=25000.0, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    type: str
    status: str
    budget: float
    spent: float = 0.0
    leads_generated: int = 0
    pipeline_value: float = 0.0
    roi: str = "0%"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: Optional[datetime] = None
