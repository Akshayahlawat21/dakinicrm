import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DealCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    title: Optional[str] = None
    account_id: Optional[str] = None
    company: Optional[str] = None
    amount: Optional[float] = None
    value: Optional[float] = None
    stage: Optional[str] = "Qualified"
    currency: Optional[str] = "USD"
    opportunity_id: Optional[str] = None

    def get_name(self) -> str:
        if self.name and self.name.strip():
            return self.name.strip()
        if self.title and self.title.strip():
            return self.title.strip()
        return "New Opportunity"

    def get_amount(self) -> float:
        if self.amount is not None:
            return float(self.amount)
        if self.value is not None:
            return float(self.value)
        return 45000.0


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
