import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """E2: Health endpoint GET /health returns 200 with service metadata."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "dakini-layer2-gateway"
    assert "upstream" in data
    assert "timestamp" in data
    assert "correlation_id" in data


@pytest.mark.asyncio
async def test_v1_health_endpoint(client: AsyncClient):
    """E2: Versioned health endpoint GET /v1/health returns 200."""
    resp = await client.get("/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
