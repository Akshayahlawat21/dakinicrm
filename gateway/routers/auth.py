from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel
from gateway.config import settings
from gateway.security.auth import create_access_token, validate_jwt_token
from gateway.errors import UnauthorizedException, BadRequestException, BadGatewayException
from gateway.middleware.rate_limiter import apply_rate_limit

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str
    tenant_id: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 86400
    user: Dict[str, Any]


class PasswordChangePayload(BaseModel):
    old_password: str
    new_password: str


@router.post("/login", response_model=TokenResponse, summary="E4: User Login & Token Issuance")
@router.post("/token", response_model=TokenResponse, summary="E4: OAuth2 Token Endpoint")
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    """
    Public login endpoint:
    - Enforces strict E5 login rate limiting (10/min, fail-closed)
    - Verifies credentials against Upstream Layer 3 Backend / Database
    - Issues signed JWT with verified identity, tenant boundaries, tv, and mcp claims
    """
    # 1. Enforce login rate limit
    await apply_rate_limit(request)

    # Validate input presence
    if not body.email or not body.password:
        raise BadRequestException("Email and password are required")

    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    # 2. Authenticate against Upstream Layer 3 Backend if available
    try:
        async with httpx.AsyncClient(timeout=settings.UPSTREAM_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{settings.UPSTREAM_API_URL.rstrip('/')}/v1/auth/authenticate",
                json={"identifier": body.email, "password": body.password},
                headers={"X-Correlation-ID": correlation_id},
            )

            if resp.status_code == 200:
                payload = resp.json().get("data", {})
                user_id = payload["id"]
                tenant_id = payload["organization_id"]
                roles = payload.get("roles", [payload.get("role", "salesperson")])
                token_version = payload.get("token_version", 1)
                must_change_password = payload.get("must_change_password", False)

                token = create_access_token(
                    user_id=user_id,
                    tenant_id=tenant_id,
                    roles=roles,
                    email=payload.get("email", body.email),
                    token_version=token_version,
                    must_change_password=must_change_password,
                    expires_delta_seconds=86400,
                )

                user_info = {
                    "id": user_id,
                    "email": payload.get("email", body.email),
                    "login_id": payload.get("login_id"),
                    "name": payload.get("name", body.email.split("@")[0].replace(".", " ").title()),
                    "tenant_id": tenant_id,
                    "role": roles[0],
                    "roles": roles,
                    "must_change_password": must_change_password,
                }

                return TokenResponse(
                    access_token=token,
                    token_type="Bearer",
                    expires_in=86400,
                    user=user_info,
                )

            elif resp.status_code in (401, 403):
                if not settings.can_mock_upstream:
                    err = resp.json().get("error", {})
                    raise UnauthorizedException(
                        message=err.get("message", "Invalid email/login ID or password"),
                        code=err.get("code", "INVALID_CREDENTIALS"),
                    )
            elif resp.status_code == 404:
                if not settings.can_mock_upstream:
                    raise BadGatewayException("Upstream authentication endpoint is not available")

    except (httpx.ConnectError, httpx.TimeoutException):
        # Fallback only permitted in local dev mock mode
        if not settings.can_mock_upstream:
            raise BadGatewayException("Upstream authentication service is temporarily unavailable")

    # Fallback development mapping when Upstream is not started
    email_lower = body.email.lower()
    USER_UUID_MAP = {
        "elena.rostova@dakini.ai": "e7e81b6a-d30e-5270-87f1-260879092306",
        "marcus.vance@dakini.ai": "33333333-3333-3333-3333-333333330002",
        "dev.singhania@dakini.ai": "33333333-3333-3333-3333-333333330003",
        "asha.nair@dakini.ai": "33333333-3333-3333-3333-333333330004",
    }
    user_id = USER_UUID_MAP.get(email_lower, f"usr_{body.email.split('@')[0]}")
    if any(k in email_lower for k in ("elena", "owner", "admin", "director")):
        roles = ["owner", "admin"]
    elif any(k in email_lower for k in ("marcus", "manager")):
        roles = ["manager"]
    else:
        roles = ["salesperson"]

    resolved_tenant = "b4b76cde-a5e0-5ffb-9670-2df601cd5eef"

    token = create_access_token(
        user_id=user_id,
        tenant_id=resolved_tenant,
        roles=roles,
        email=body.email,
        expires_delta_seconds=86400,
    )

    user_info = {
        "id": user_id,
        "email": body.email,
        "name": body.email.split("@")[0].replace(".", " ").title(),
        "tenant_id": resolved_tenant,
        "role": roles[0],
        "roles": roles,
        "must_change_password": False,
    }

    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        expires_in=86400,
        user=user_info,
    )


@router.post("/change-password", summary="Self-Service Password Change")
async def change_password(request: Request, body: PasswordChangePayload) -> Dict[str, Any]:
    """Protected self-service password change route."""
    claims = await validate_jwt_token(request)
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    # Forward to Upstream Layer 3
    auth_header = request.headers.get("Authorization", "")
    async with httpx.AsyncClient(timeout=settings.UPSTREAM_TIMEOUT_SECONDS) as client:
        resp = await client.post(
            f"{settings.UPSTREAM_API_URL.rstrip('/')}/v1/auth/change-password",
            json={"old_password": body.old_password, "new_password": body.new_password},
            headers={
                "Authorization": auth_header,
                "X-Correlation-ID": correlation_id,
                "X-User-Id": str(getattr(request.state, "user_id", "")),
                "X-Tenant-Id": str(getattr(request.state, "tenant_id", "")),
            },
        )

        if resp.status_code == 200:
            user_data = resp.json().get("data", {})
            new_tv = user_data.get("token_version", 1)

            # Issue fresh token with mcp=False and updated tv
            fresh_token = create_access_token(
                user_id=str(user_data["id"]),
                tenant_id=str(user_data["organization_id"]),
                roles=claims.get("roles", ["salesperson"]),
                email=user_data["email"],
                token_version=new_tv,
                must_change_password=False,
                expires_delta_seconds=86400,
            )
            return {
                "status": "success",
                "access_token": fresh_token,
                "token_type": "Bearer",
                "expires_in": 86400,
                "user": user_data,
            }
        else:
            err = resp.json().get("error", {})
            raise BadRequestException(message=err.get("message", "Password change failed"))


@router.get("/me", summary="Get Authenticated User Profile")
async def get_me(request: Request) -> Dict[str, Any]:
    """Protected endpoint returning verified claims from validated token."""
    user = getattr(request.state, "user", None)
    if not user:
        raise UnauthorizedException("Unauthenticated")
    return {"user": user}
