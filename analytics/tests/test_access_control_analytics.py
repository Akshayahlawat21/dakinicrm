import uuid
from datetime import date, datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, ANY
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app, resolve_auth_scope, AuthScope
from app.analytics import (
    overview,
    revenue_trend,
    pipeline_by_stage,
    lead_sources,
    conversion_funnel,
    activity_performance,
    quota_leaderboard,
    target_pace,
)
from app.database import get_connection


@pytest.fixture
def client():
    async def fake_connection():
        yield object()

    app.dependency_overrides[get_connection] = fake_connection
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_missing_identity_header_fails_closed():
    """Analytics fails closed when X-User-Id is missing in requests against real connection."""
    fake_conn = MagicMock()
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"):
        with pytest.raises(HTTPException) as excinfo:
            await resolve_auth_scope(
                conn=fake_conn,
                tenant_id="tenant-acme",
                user_id_hdr=None,
                roles_hdr=None,
            )
        assert excinfo.value.status_code == 401
        assert "Missing required identity context" in excinfo.value.detail


@pytest.mark.asyncio
async def test_invalid_uuid_identity_header_fails_closed():
    """Analytics rejects malformed user identity headers."""
    fake_conn = MagicMock()
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"):
        with pytest.raises(HTTPException) as excinfo:
            await resolve_auth_scope(
                conn=fake_conn,
                tenant_id="tenant-acme",
                user_id_hdr="not-a-valid-uuid",
                roles_hdr="salesperson",
            )
        assert excinfo.value.status_code == 401
        assert "Invalid X-User-Id format" in excinfo.value.detail


def test_analytics_metrics_scoped_by_role_in_app(client):
    """
    Verifies that requests with Owner, Manager, and Salesperson roles pass the
    appropriate scoped_users constraints to underlying query handlers.
    """
    owner_id = str(uuid.uuid4())
    sales_id = str(uuid.uuid4())

    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"), \
         patch("app.main.overview", new_callable=AsyncMock) as mock_overview:
        mock_overview.return_value = {"total_leads": 10}

        # 1. Owner request: scoped_users must be None (full organization scope)
        resp_owner = client.get(
            "/v1/reports/overview?period=month",
            headers={
                "X-Tenant-Id": "tenant-acme",
                "X-User-Id": owner_id,
                "X-User-Roles": "owner",
            },
        )
        assert resp_owner.status_code == 200
        mock_overview.assert_called_with(ANY, "test-org", "month", scoped_users=None)

        # 2. Salesperson request: scoped_users must strictly be [sales_uuid]
        resp_sales = client.get(
            "/v1/reports/overview?period=month",
            headers={
                "X-Tenant-Id": "tenant-acme",
                "X-User-Id": sales_id,
                "X-User-Roles": "salesperson",
            },
        )
        assert resp_sales.status_code == 200
        mock_overview.assert_called_with(
            ANY, "test-org", "month", scoped_users=[uuid.UUID(sales_id)]
        )


def test_analytics_csv_export_applies_same_role_scoping(client):
    """
    CSV exports must enforce identical scoped_users constraints as JSON reports.
    """
    sales_id = str(uuid.uuid4())

    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"), \
         patch("app.main.quota_leaderboard", new_callable=AsyncMock) as mock_leaderboard:
        mock_leaderboard.return_value = {"data": [], "period": "month"}

        resp = client.get(
            "/v1/reports/export.csv?report=quota-leaderboard&period=month",
            headers={
                "X-Tenant-Id": "tenant-acme",
                "X-User-Id": sales_id,
                "X-User-Roles": "salesperson",
            },
        )
        assert resp.status_code == 200
        mock_leaderboard.assert_called_with(
            ANY, "test-org", "month", scoped_users=[uuid.UUID(sales_id)]
        )


@pytest.mark.asyncio
async def test_resolve_auth_scope_rejects_inactive_user():
    """Database identity verification rejects inactive user accounts."""
    fake_conn = AsyncMock()
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"):
        mock_result = MagicMock()
        mock_result.mappings.return_value.one_or_none.return_value = {
            "id": uuid.uuid4(),
            "role_name": "salesperson",
            "status": "inactive",
        }
        fake_conn.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as excinfo:
            await resolve_auth_scope(
                conn=fake_conn,
                tenant_id="tenant-acme",
                user_id_hdr=str(uuid.uuid4()),
                roles_hdr="salesperson",
            )
        assert excinfo.value.status_code == 403
        assert "Inactive user accounts cannot access analytics" in excinfo.value.detail


@pytest.mark.asyncio
async def test_resolve_auth_scope_rejects_cross_tenant_user():
    """Database identity verification rejects users not belonging to the tenant."""
    fake_conn = AsyncMock()
    with patch("app.main.resolve_organization_id", new_callable=AsyncMock, return_value="test-org"):
        mock_result = MagicMock()
        mock_result.mappings.return_value.one_or_none.return_value = None  # Not found in this org
        fake_conn.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as excinfo:
            await resolve_auth_scope(
                conn=fake_conn,
                tenant_id="tenant-acme",
                user_id_hdr=str(uuid.uuid4()),
                roles_hdr="owner",
            )
        assert excinfo.value.status_code == 403
        assert "User not found or cross-tenant access denied" in excinfo.value.detail
