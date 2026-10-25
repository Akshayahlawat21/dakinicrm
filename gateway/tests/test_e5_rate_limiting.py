import pytest
from httpx import AsyncClient
from gateway.config import settings


@pytest.mark.asyncio
async def test_rate_limit_headers_present(client: AsyncClient, auth_headers: dict):
    """E5: Rate limit headers are exposed on responses."""
    resp = await client.get("/v1/leads", headers=auth_headers)
    assert resp.status_code == 200
    assert "X-RateLimit-Limit" in resp.headers
    assert "X-RateLimit-Remaining" in resp.headers
    assert "X-RateLimit-Reset" in resp.headers


@pytest.mark.asyncio
async def test_login_rate_limit_exceeded(client: AsyncClient):
    """E5: Login rate limit triggers 429 and Retry-After header."""
    # Temporarily set login limit to 3 for fast test execution
    original_limit = settings.RATE_LIMIT_LOGIN
    settings.RATE_LIMIT_LOGIN = 3

    try:
        # 3 allowed requests
        for i in range(3):
            resp = await client.post(
                "/v1/auth/login",
                json={"email": f"user{i}@test.com", "password": "pass"},
                headers={"X-Forwarded-For": "192.168.1.100"},
            )
            assert resp.status_code == 200

        # 4th request must be rejected with 429
        resp = await client.post(
            "/v1/auth/login",
            json={"email": "user4@test.com", "password": "pass"},
            headers={"X-Forwarded-For": "192.168.1.100"},
        )
        assert resp.status_code == 429
        data = resp.json()
        assert data["error"]["code"] == "RATE_LIMITED"
        assert "Retry-After" in resp.headers
        assert "correlation_id" in data["error"]

    finally:
        settings.RATE_LIMIT_LOGIN = original_limit
