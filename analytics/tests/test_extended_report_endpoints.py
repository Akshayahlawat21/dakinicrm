from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_connection
import csv
import io
import pytest


@pytest.fixture
def client():
    async def fake_connection():
        yield object()
    app.dependency_overrides[get_connection] = fake_connection
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("path", "function_name"),
    [
        ("/v1/reports/conversion-funnel?period=month", "conversion_funnel"),
        ("/v1/reports/activity-performance?period=month", "activity_performance"),
        ("/v1/reports/quota-leaderboard?period=month", "quota_leaderboard"),
        ("/v1/reports/target-pace?period=quarter", "target_pace"),
    ],
)
def test_new_report_endpoints_return_service_payload(client, path, function_name):
    payload = {"period": "month", "data": []}
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="org-1"), \
         patch(f"app.main.{function_name}", new_callable=AsyncMock, return_value=payload):
        response = client.get(path, headers={"X-Tenant-Id": "test-org"})
    assert response.status_code == 200
    assert response.json() == payload


def test_csv_export_returns_csv_attachment(client):
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="org-1"), \
         patch("app.main.lead_sources", new_callable=AsyncMock, return_value={
             "period": "month", "total_leads": 2,
             "data": [{"source": "Web", "lead_count": 2, "percentage": 100.0}]
         }):
        response = client.get(
            "/v1/reports/export.csv?report=lead-sources&period=month",
            headers={"X-Tenant-Id": "test-org"},
        )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment;" in response.headers["content-disposition"]
    assert "Web" in response.text
    assert "lead_count" in response.text


def test_csv_export_rejects_unknown_report(client):
    response = client.get(
        "/v1/reports/export.csv?report=unknown",
        headers={"X-Tenant-Id": "test-org"},
    )
    assert response.status_code == 422
