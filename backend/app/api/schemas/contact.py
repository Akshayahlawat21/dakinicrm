import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class ContactCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    account_id: Optional[str] = None
    account: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    allow_separate_contact: Optional[bool] = False


class ContactDuplicateCheckResponse(BaseModel):
    is_duplicate_warning: bool
    existing_contact_id: Optional[str] = None
    existing_contact_name: Optional[str] = None
    existing_company: Optional[str] = None
    existing_email: Optional[str] = None
    existing_title: Optional[str] = None
    warning_message: Optional[str] = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    account: Optional[str] = None
    account_name: Optional[str] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime
