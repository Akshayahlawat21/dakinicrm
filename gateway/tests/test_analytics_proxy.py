import pytest
from httpx import AsyncClient, Response
from unittest.mock import patch
from gateway.config import settings


@pytest.mark.asyncio
async def test_analytics_proxy_rejects_unregistered_path(client: AsyncClient, auth_headers: dict):
    """Unknown analytics sub-paths return 404 ANALYTICS_ROUTE_NOT_FOUND."""
    resp = await client.get("/v1/analytics/reports/unknown_report", headers=auth_headers)
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "ANALYTICS_ROUTE_NOT_FOUND"


@pytest.mark.asyncio
async def test_analytics_proxy_requires_auth(client: AsyncClient):
    """Analytics proxy requires a valid Bearer JWT."""
    resp = await client.get("/v1/analytics/reports/overview?period=month")
    assert resp.status_code == 401
    data = resp.json()
    assert data["error"]["code"] in ("MISSING_TOKEN", "AUTH_REQUIRED")


@pytest.mark.asyncio
async def test_analytics_proxy_forwards_to_upstream(client: AsyncClient, auth_headers: dict):
    """Registered analytics path forwards request to Layer 9 service."""
    mock_payload = {"status": "success", "period": "month", "won_revenue": 10000}
    orig_get = AsyncClient.get

    async def patched_get(self, url, *args, **kwargs):
        if str(url).startswith(settings.ANALYTICS_API_URL):
            return Response(
                status_code=200,
                json=mock_payload,
                headers={"content-type": "application/json"},
            )
        return await orig_get(self, url, *args, **kwargs)

    with patch.object(AsyncClient, "get", patched_get):
        resp = await client.get("/v1/analytics/reports/overview?period=month", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == mock_payload
        assert "X-Correlation-ID" in resp.headers


@pytest.mark.asyncio
async def test_analytics_proxy_unreachable_upstream_returns_502(client: AsyncClient, auth_headers: dict):
    """When Layer 9 service is unreachable, gateway returns 502 BAD_GATEWAY."""
    original_url = settings.ANALYTICS_API_URL
    try:
        settings.ANALYTICS_API_URL = "http://127.0.0.1:59998"
        resp = await client.get("/v1/analytics/reports/overview?period=month", headers=auth_headers)
        assert resp.status_code == 502
        data = resp.json()
        assert data["error"]["code"] == "BAD_GATEWAY"
    finally:
        settings.ANALYTICS_API_URL = original_url
