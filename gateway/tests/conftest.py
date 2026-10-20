import pytest
from httpx import AsyncClient, ASGITransport
from gateway.main import app
from gateway.config import settings
from gateway.security.auth import create_access_token


@pytest.fixture
def auth_token() -> str:
    """Generate a valid JWT token for test user."""
    return create_access_token(
        user_id="usr_test_elena",
        tenant_id="tenant_dakini_test",
        roles=["sales_executive", "admin"],
        email="elena.rostova@dakini.ai",
    )


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Standard authenticated headers."""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture
async def client():
    """Async test client for FastAPI gateway."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
