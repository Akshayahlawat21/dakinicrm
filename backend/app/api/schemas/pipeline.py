from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class PipelineStageResponse(BaseModel):
    id: str
    pipeline_id: str
    organization_id: str
    user_id: Optional[str] = None
    scope: str = "org"
    parent_stage_id: Optional[str] = None
    parent_base_stage: Optional[str] = None
    name: str
    order_index: int
    color: str
    win_probability: int
    qualification_tags: list[str] = []
    is_system: bool = False
    is_won: bool = False
    is_lost: bool = False


class PipelineResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    is_default: bool = False
    status: str = "active"
    created_at: Optional[datetime] = None
    stages: List[PipelineStageResponse] = []


class PipelineCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class PipelineStageCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_stage_id: Optional[str] = None
    parent_base_stage: Optional[str] = None
    color: Optional[str] = "#06b6d4"
    win_probability: Optional[int] = Field(default=None, ge=0, le=100)
    qualification_tags: List[str] = []
    scope: str = "personal"  # 'personal' (default for all users) or 'org' (Owner/Admin only)


class PipelineStageUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = None
    win_probability: Optional[int] = Field(default=None, ge=0, le=100)
    qualification_tags: Optional[List[str]] = None


class PipelineStageReorderRequest(BaseModel):
    stage_ids: List[str] = Field(..., min_length=1)

