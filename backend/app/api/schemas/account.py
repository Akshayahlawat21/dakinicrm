import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AccountCreateRequest(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    allow_separate_account: Optional[bool] = False


class AccountDuplicateCheckResponse(BaseModel):
    is_duplicate_warning: bool
    existing_account_id: Optional[str] = None
    existing_account_name: Optional[str] = None
    existing_phone: Optional[str] = None
    existing_industry: Optional[str] = None
    existing_location: Optional[str] = None
    warning_message: Optional[str] = None


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str
    contacts_count: Optional[int] = 0
    deals_count: Optional[int] = 0
    arr_amount: Optional[float] = 0.0
    created_at: datetime
