
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_connection


@pytest.fixture
def client():
    async def fake_connection():
        yield object()

    app.dependency_overrides[get_connection] = fake_connection

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_invalid_period_returns_422(client):
    with patch(
        "app.main.resolve_organization_id",
        new_callable=AsyncMock,
        return_value="test-org",
    ):
        response = client.get(
            "/v1/reports/overview?period=all_time",
            headers={"X-Tenant-Id": "test-tenant"},
        )

    assert response.status_code == 422


def test_missing_tenant_header_returns_422(client):
    response = client.get("/v1/reports/overview?period=month")

    assert response.status_code == 422


def test_unknown_tenant_returns_404(client):
    with patch(
        "app.main.resolve_organization_id",
        new_callable=AsyncMock,
        side_effect=__import__("fastapi").HTTPException(
            status_code=404,
            detail="Organization not found for tenant",
        ),
    ):
        response = client.get(
            "/v1/reports/overview?period=month",
            headers={"X-Tenant-Id": "unknown-tenant"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Organization not found for tenant"
