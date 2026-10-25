
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


@pytest.mark.parametrize(
    "path",
    [
        "/v1/reports/overview?period=month",
        "/v1/reports/revenue-trend?months=3",
        "/v1/reports/pipeline-by-stage",
        "/v1/reports/lead-sources?period=last_30_days",
    ],
)
def test_report_endpoints_return_mocked_results(client, path):
    with patch(
        "app.main.resolve_organization_id",
        new_callable=AsyncMock,
        return_value="test-org",
    ), patch("app.main.overview", new_callable=AsyncMock) as overview_mock, patch(
        "app.main.revenue_trend", new_callable=AsyncMock
    ) as trend_mock, patch(
        "app.main.pipeline_by_stage", new_callable=AsyncMock
    ) as pipeline_mock, patch(
        "app.main.lead_sources", new_callable=AsyncMock
    ) as sources_mock:

        overview_mock.return_value = {"total_leads": 10}
        trend_mock.return_value = {"months": 3, "data": []}
        pipeline_mock.return_value = {"data": []}
        sources_mock.return_value = {"period": "last_30_days", "data": []}

        response = client.get(
            path,
            headers={"X-Tenant-Id": "test-tenant"},
        )

    assert response.status_code == 200
    assert response.json() is not None
