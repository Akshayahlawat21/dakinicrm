from backend.app.api.schemas.common import StandardResponse, PaginatedResponse, ActionResponse
from backend.app.api.schemas.user import UserCreateRequest, UserUpdateRequest, UserResponse
from backend.app.api.schemas.lead import LeadCreateRequest, ConvertLeadRequest, LeadResponse
from backend.app.api.schemas.deal import DealCreateRequest, DealStageUpdateRequest, DealResponse
from backend.app.api.schemas.account import AccountCreateRequest, AccountResponse
from backend.app.api.schemas.contact import ContactCreateRequest, ContactResponse
from backend.app.api.schemas.task import TaskCreateRequest, TaskStatusUpdateRequest, TaskResponse
from backend.app.api.schemas.target import TargetCreateRequest, TargetResponse

__all__ = [
    "StandardResponse",
    "PaginatedResponse",
    "ActionResponse",
    "UserCreateRequest",
    "UserUpdateRequest",
    "UserResponse",
    "LeadCreateRequest",
    "ConvertLeadRequest",
    "LeadResponse",
    "DealCreateRequest",
    "DealStageUpdateRequest",
    "DealResponse",
    "AccountCreateRequest",
    "AccountResponse",
    "ContactCreateRequest",
    "ContactResponse",
    "TaskCreateRequest",
    "TaskStatusUpdateRequest",
    "TaskResponse",
    "TargetCreateRequest",
    "TargetResponse",
]
