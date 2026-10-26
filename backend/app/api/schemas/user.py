import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    role_name: str = "salesperson"
    team_id: Optional[str] = None
    manager_id: Optional[str] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    role_name: Optional[str] = None
    status: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str


class PasswordResetResponse(BaseModel):
    status: str = "success"
    temporary_password: str
    message: str = "Temporary password generated. It must be changed upon first login."


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    email: str
    login_id: Optional[str] = None
    role_name: str
    status: str
    must_change_password: bool = False
    created_at: datetime
    temporary_password: Optional[str] = None
