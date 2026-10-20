import pytest
from httpx import AsyncClient
from gateway.config import settings


@pytest.mark.asyncio
async def test_edge_shield_disabled_by_default(client: AsyncClient):
    """When EDGE_SHIELD_ENABLED is false, direct calls succeed."""
    settings.EDGE_SHIELD_ENABLED = False
    resp = await client.get("/health")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_edge_shield_blocks_direct_bypass_when_enabled(client: AsyncClient):
    """When EDGE_SHIELD_ENABLED is true, requests without valid secret are blocked with 403."""
    settings.EDGE_SHIELD_ENABLED = True
    settings.EDGE_SHIELD_SECRET = "super-secret-edge-token"

    try:
        # 1. Missing secret header -> 403
        resp = await client.get("/health")
        assert resp.status_code == 403
        data = resp.json()
        assert data["error"]["code"] == "EDGE_SHIELD_REQUIRED"
        assert "correlation_id" in data["error"]

        # 2. Invalid secret header -> 403
        resp = await client.get("/health", headers={"X-Edge-Secret": "wrong-secret"})
        assert resp.status_code == 403

        # 3. Valid secret header -> 200
        resp = await client.get("/health", headers={"X-Edge-Secret": "super-secret-edge-token"})
        assert resp.status_code == 200

    finally:
        # Reset settings
        settings.EDGE_SHIELD_ENABLED = False


@pytest.mark.asyncio
async def test_e1_anti_cache_headers_on_v1(client: AsyncClient, auth_headers: dict):
    """Authenticated /v1/ routes must have anti-cache headers."""
    resp = await client.get("/v1/health")
    assert resp.status_code == 200
    assert "no-store" in resp.headers.get("Cache-Control", "")
    assert "no-cache" in resp.headers.get("Pragma", "")
