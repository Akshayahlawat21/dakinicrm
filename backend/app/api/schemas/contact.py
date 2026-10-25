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


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime
