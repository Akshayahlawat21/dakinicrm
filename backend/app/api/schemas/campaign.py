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
    cost_per_lead: float = 0.0
    impressions: int = 0
    clicks: int = 0
    pipeline_value: float = 0.0
    roi: str = "0%"
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: Optional[datetime] = None


class CampaignLeadResponse(BaseModel):
    id: str
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str = "New"
    score: int = 85
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    created_at: Optional[datetime] = None
    form_answers: dict[str, str] = {}


class AssignCampaignRequest(BaseModel):
    manager_id: Optional[str] = None
