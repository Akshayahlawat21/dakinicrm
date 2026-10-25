from typing import Generic, TypeVar, List, Optional, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    status: str = "success"
    data: T
    correlation_id: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    status: str = "success"
    data: List[T]
    total: int
    skip: int
    limit: int
    correlation_id: Optional[str] = None


class ActionResponse(BaseModel):
    status: str = "success"
    message: str
    id: Optional[str] = None
    correlation_id: Optional[str] = None
