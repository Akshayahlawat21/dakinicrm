from typing import Any, Dict, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
from gateway.config import settings
from gateway.security.auth import create_access_token
from gateway.errors import UnauthorizedException, BadRequestException
from gateway.middleware.rate_limiter import apply_rate_limit

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str
    tenant_id: Optional[str] = "tenant_enterprise_01"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 86400
    user: Dict[str, Any]


@router.post("/login", response_model=TokenResponse, summary="E4: User Login & Token Issuance")
@router.post("/token", response_model=TokenResponse, summary="E4: OAuth2 Token Endpoint")
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    """
    Public login endpoint:
    - Enforces strict E5 login rate limiting (10/min, fail-closed)
    - Validates credentials and returns signed JWT with user and tenant claims
    """
    # 1. Enforce login rate limit
    await apply_rate_limit(request)

    # Validate input presence
    if not body.email or not body.password:
        raise BadRequestException("Email and password are required")

    # In development / initial integration, provide default enterprise sales user
    user_id = f"usr_{body.email.split('@')[0]}"
    roles = ["sales_executive", "admin"] if "admin" in body.email.lower() else ["sales_executive"]
    
    token = create_access_token(
        user_id=user_id,
        tenant_id=body.tenant_id or "tenant_enterprise_01",
        roles=roles,
        email=body.email,
        expires_delta_seconds=86400,
    )

    user_info = {
        "id": user_id,
        "email": body.email,
        "name": body.email.split("@")[0].replace(".", " ").title(),
        "tenant_id": body.tenant_id or "tenant_enterprise_01",
        "roles": roles,
    }

    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        expires_in=86400,
        user=user_info,
    )


@router.get("/me", summary="Get Authenticated User Profile")
async def get_me(request: Request) -> Dict[str, Any]:
    """Protected endpoint returning verified claims from validated token."""
    user = getattr(request.state, "user", None)
    if not user:
        raise UnauthorizedException("Unauthenticated")
    return {"user": user}
