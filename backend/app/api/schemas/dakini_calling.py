from datetime import datetime
from pydantic import BaseModel, Field


class DakiniBatchCreateRequest(BaseModel):
    lead_ids: list[str] = Field(min_length=1, max_length=10000)


class DakiniBatchScheduleRequest(BaseModel):
    scheduled_at: datetime


class DakiniLeadCallStatusRequest(BaseModel):
    lead_ids: list[str] = Field(min_length=1, max_length=100)
