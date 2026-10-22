import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class LeadCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    company: Optional[str] = "Enterprise Corp"
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    source: Optional[str] = "Manual"
    score: Optional[int] = 50
    assigned_to: Optional[str] = None


class ConvertLeadRequest(BaseModel):
    deal_name: Optional[str] = None
    deal_amount: Optional[float] = 50000.0
    company_name: Optional[str] = None


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    status: str
    score: int
    assigned_to: Optional[str] = None
    created_at: datetime
