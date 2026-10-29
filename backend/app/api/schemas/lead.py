import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class LeadCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    product_id: Optional[str] = None
    interested_product: Optional[str] = None
    product_name: Optional[str] = None
    source: Optional[str] = "Manual"
    score: Optional[int] = 50
    assigned_to: Optional[str] = None
    allow_separate_inquiry: Optional[bool] = False

    def get_name(self) -> str:
        if self.name and self.name.strip():
            return self.name.strip()
        combined = f"{self.first_name or ''} {self.last_name or ''}".strip()
        return combined if combined else "New Lead"


class ConvertLeadRequest(BaseModel):
    deal_name: Optional[str] = None
    deal_amount: Optional[float] = 50000.0
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_title: Optional[str] = None
    website: Optional[str] = None
    create_deal: Optional[bool] = True


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    title: Optional[str] = None
    website: Optional[str] = None
    product_id: Optional[str] = None
    interested_product: Optional[str] = None
    source: Optional[str] = "Website"
    status: str
    score: int
    assigned_to: Optional[str] = None
    owner: Optional[str] = None
    created_at: datetime


class AssignLeadsRequest(BaseModel):
    lead_ids: list[str]
    assignee_id: str


class AssignLeadRequest(BaseModel):
    assignee_id: str
