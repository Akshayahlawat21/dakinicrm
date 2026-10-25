import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    role_name: str = "salesperson"
    manager_id: Optional[str] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role_name: Optional[str] = None
    status: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    email: str
    role_name: str
    status: str
    created_at: datetime
