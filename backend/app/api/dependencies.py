import logging
import uuid
from typing import AsyncGenerator
import jwt
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import UnauthorizedError, ForbiddenError

logger = logging.getLogger("backend.api.dependencies")


async def get_request_context(request: Request) -> RequestContext:
    """
    Extracts trusted caller identity and tenant isolation context.
    Priority 1: Verified headers forwarded by the Layer 2 Gateway (E4).
    Priority 2: Direct Bearer JWT token in Authorization header.
    Rejects any unauthenticated request with 401 Unauthorized.
    """
    correlation_id = (
        request.headers.get("X-Correlation-ID")
        or request.headers.get("X-Request-ID")
        or f"req_{uuid.uuid4().hex}"
    )

    # 1. Gateway Forwarded Headers
    gateway_user = request.headers.get("X-User-Id")
    gateway_tenant = request.headers.get("X-Tenant-Id")
    gateway_roles = request.headers.get("X-User-Roles")
    gateway_team = request.headers.get("X-Team-Id")

    if gateway_user and gateway_tenant:
        primary_role = "salesperson"
        if gateway_roles:
            roles_list = [r.strip().lower() for r in gateway_roles.split(",")]
            if any(r in ("owner", "admin", "system_admin", "director") for r in roles_list):
                primary_role = "owner"
            elif any(r in ("manager", "sales_manager") for r in roles_list):
                primary_role = "manager"
            else:
                primary_role = roles_list[0] if roles_list else "salesperson"

        return RequestContext(
            user_id=gateway_user,
            tenant_id=gateway_tenant,
            role=primary_role,
            team_id=gateway_team,
            correlation_id=correlation_id,
        )

    # 2. Bearer Token Verification fallback
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid Authorization header (Bearer token required)")

    token = auth_header.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": True, "verify_signature": True},
        )
        user_id = payload.get("sub") or payload.get("user_id")
        tenant_id = payload.get("tenant_id") or payload.get("organization_id")
        roles = payload.get("roles", ["salesperson"])
        team_id = payload.get("team_id")

        if not user_id or not tenant_id:
            raise UnauthorizedError("Token missing mandatory user_id or tenant_id claims")

        primary_role = "salesperson"
        if isinstance(roles, list):
            roles_lower = [r.lower() for r in roles]
            if any(r in ("owner", "admin", "director") for r in roles_lower):
                primary_role = "owner"
            elif any(r == "manager" for r in roles_lower):
                primary_role = "manager"
            elif roles_lower:
                primary_role = roles_lower[0]
        elif isinstance(roles, str):
            primary_role = roles.lower()

        return RequestContext(
            user_id=str(user_id),
            tenant_id=str(tenant_id),
            role=primary_role,
            team_id=str(team_id) if team_id else None,
            correlation_id=correlation_id,
        )

    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token has expired")
    except jwt.PyJWTError as exc:
        raise UnauthorizedError(f"Invalid token signature: {exc}")
