import pytest
from httpx import AsyncClient
from gateway.config import settings


@pytest.mark.asyncio
async def test_unknown_route_returns_404(client: AsyncClient, auth_headers: dict):
    """E3: Unknown or unregistered API routes return 404 with normalized error."""
    resp = await client.get("/v1/nonexistent_crm_module_xyz", headers=auth_headers)
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "NOT_FOUND"
    assert "correlation_id" in data["error"]


@pytest.mark.asyncio
async def test_upstream_fallback_when_offline(client: AsyncClient, auth_headers: dict):
    """E3: When upstream Layer 3 is offline, development mock fallback works."""
    settings.MOCK_UPSTREAM_IF_DOWN = True
    resp = await client.get("/v1/leads", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data


@pytest.mark.asyncio
async def test_upstream_returns_502_when_mock_disabled(client: AsyncClient, auth_headers: dict):
    """E3: When mock fallback is disabled, unreachable upstream returns 502 BAD_GATEWAY."""
    # Pass X-Mock-Fallback: false to simulate strict production behavior
    headers = {
        **auth_headers,
        "X-Mock-Fallback": "false",
    }
    resp = await client.get("/v1/leads", headers=headers)
    assert resp.status_code == 502
    data = resp.json()
    assert data["error"]["code"] == "BAD_GATEWAY"
    assert "correlation_id" in data["error"]


@pytest.mark.asyncio
async def test_inbound_webhooks_routing(client: AsyncClient):
    """E3: Inbound webhooks route accepts payloads without JWT."""
    resp = await client.post(
        "/v1/webhooks/hubspot",
        json={"event": "contact.created", "contact_id": "hs_99182"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["source"] == "hubspot"


@pytest.mark.asyncio
async def test_production_mode_strictly_forbids_mock_fallback(client: AsyncClient, auth_headers: dict):
    """
    Requirement 1 & 4: In production, mock fallback is strictly disabled.
    Unreachable upstream backend MUST return 502 Bad Gateway and NEVER return mock CRM data.
    """
    original_env = settings.ENVIRONMENT
    original_mock = settings.MOCK_UPSTREAM_IF_DOWN
    try:
        settings.ENVIRONMENT = "production"
        settings.MOCK_UPSTREAM_IF_DOWN = True  # Attempt to enable mock in production

        assert settings.can_mock_upstream is False

        resp = await client.get("/v1/leads", headers=auth_headers)
        assert resp.status_code == 502
        data = resp.json()
        assert data["error"]["code"] == "BAD_GATEWAY"
        assert "correlation_id" in data["error"]
        assert "source" not in data  # No mock data returned!
    finally:
        settings.ENVIRONMENT = original_env
        settings.MOCK_UPSTREAM_IF_DOWN = original_mock
