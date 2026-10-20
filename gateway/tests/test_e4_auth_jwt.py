import pytest
import time
from httpx import AsyncClient
import jwt
from gateway.config import settings
from gateway.security.auth import create_access_token


@pytest.mark.asyncio
async def test_missing_token_rejected_with_401(client: AsyncClient):
    """E4: Protected route without Authorization header rejected with 401."""
    resp = await client.get("/v1/leads")
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "MISSING_TOKEN"
    assert "correlation_id" in data["error"]


@pytest.mark.asyncio
async def test_invalid_token_format_rejected_with_401(client: AsyncClient):
    """E4: Malformed Authorization header rejected with 401."""
    resp = await client.get("/v1/leads", headers={"Authorization": "Basic 12345"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "INVALID_AUTH_HEADER"


@pytest.mark.asyncio
async def test_invalid_token_signature_rejected_with_401(client: AsyncClient):
    """E4: Token signed with wrong secret rejected with 401."""
    bad_token = jwt.encode(
        {"sub": "user_hacker", "exp": int(time.time()) + 3600},
        "wrong-secret-key-must-be-32-bytes-long!",
        algorithm="HS256",
    )
    resp = await client.get("/v1/leads", headers={"Authorization": f"Bearer {bad_token}"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_expired_token_rejected_with_401(client: AsyncClient):
    """E4: Expired token rejected with 401 TOKEN_EXPIRED."""
    expired_token = jwt.encode(
        {"sub": "usr_expired", "exp": int(time.time()) - 100},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    resp = await client.get("/v1/leads", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] == "TOKEN_EXPIRED"


@pytest.mark.asyncio
async def test_valid_token_allows_access(client: AsyncClient, auth_headers: dict):
    """E4: Valid JWT allows access to protected routes."""
    resp = await client.get("/v1/leads", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_public_login_endpoint_issues_token(client: AsyncClient):
    """E4: Public login endpoint validates credentials and returns JWT."""
    resp = await client.post(
        "/v1/auth/login",
        json={"email": "elena.rostova@dakini.ai", "password": "securepassword123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"
    assert data["user"]["email"] == "elena.rostova@dakini.ai"


def test_production_requires_secure_jwt_secret_or_jwks():
    """Requirement 2: In production, hardcoded dev secret is rejected."""
    original_env = settings.ENVIRONMENT
    original_secret = settings.JWT_SECRET
    try:
        settings.ENVIRONMENT = "production"
        settings.JWT_SECRET = "dakini-crm-dev-super-secret-key-change-in-production-123456789"
        settings.JWKS_URL = None

        with pytest.raises(ValueError, match="Production deployment requires a secure JWT_SECRET"):
            settings.validate_production_security()

        # Valid production secret (>= 32 chars) passes
        settings.JWT_SECRET = "production-secure-random-token-exceeding-thirty-two-bytes-minimum"
        settings.validate_production_security()  # Does not raise
    finally:
        settings.ENVIRONMENT = original_env
        settings.JWT_SECRET = original_secret
