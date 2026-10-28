import hmac
import re
import uuid
from dataclasses import dataclass
from fastapi import Header, HTTPException, status
from app.config import get_settings


@dataclass(frozen=True)
class AIRequestContext:
    tenant_id: str
    user_id: str
    role: str

    @property
    def is_owner(self) -> bool:
        return self.role in {"owner", "admin", "system_admin", "director"}

    @property
    def is_salesperson(self) -> bool:
        return self.role in {"salesperson", "sales_rep", "sales_executive", "viewer"}


async def get_ai_context(
    service_key: str | None = Header(None, alias="X-AI-Service-Key"),
    tenant_id: str | None = Header(None, alias="X-CRM-Tenant-Id"),
    user_id: str | None = Header(None, alias="X-CRM-User-Id"),
    role: str | None = Header(None, alias="X-CRM-User-Role"),
) -> AIRequestContext:
    """Only the authenticated Layer 3 service should call this service."""
    expected = get_settings().ai_internal_api_key
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_INTERNAL_API_KEY is not configured",
        )
    if not service_key or not hmac.compare_digest(service_key, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal service credentials")
    if not tenant_id or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing trusted CRM identity headers")
    # Tenant identifiers may be either organization UUIDs or database slugs. Only Layer 3
    # can set these headers because the internal service key is required.
    try:
        tenant_id = str(uuid.UUID(tenant_id))
    except (ValueError, TypeError, AttributeError):
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,99}", tenant_id):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid CRM tenant identifier")
    try:
        user_id = str(uuid.UUID(user_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="CRM user identity must use a UUID") from exc

    normalized_role = (role or "salesperson").strip().lower()
    if normalized_role not in {
        "owner", "admin", "system_admin", "director", "manager", "sales_manager",
        "salesperson", "sales_rep", "sales_executive", "viewer",
    }:
        normalized_role = "salesperson"
    return AIRequestContext(tenant_id=tenant_id, user_id=user_id, role=normalized_role)
