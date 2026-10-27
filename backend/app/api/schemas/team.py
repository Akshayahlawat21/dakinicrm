import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeamCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[str] = None


class TeamUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[str] = None


class TeamMemberAddRequest(BaseModel):
    user_id: str


class TeamMemberTransferRequest(BaseModel):
    target_team_id: str


class TeamManagerDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    login_id: Optional[str] = None


class TeamMemberDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    email: str
    login_id: Optional[str] = None
    role_name: str
    joined_at: datetime


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    status: str
    manager: Optional[TeamManagerDTO] = None
    salesperson_count: int = 0
    created_at: datetime


class TeamDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    status: str
    manager: Optional[TeamManagerDTO] = None
    members: List[TeamMemberDTO] = []
    created_at: datetime
