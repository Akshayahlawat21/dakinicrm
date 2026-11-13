import uuid
from datetime import timezone

import pytest

from backend.app.application.context import RequestContext
from backend.app.application.services.ai_crm_tools import (
    CRM_TOOL_DEFINITIONS,
    _date_bounds,
    _visible_user_ids,
    execute_crm_tool,
)


class _Scalars:
    def __init__(self, values):
        self._values = values

    def all(self):
        return self._values


class _Result:
    def __init__(self, scalar=None, values=None):
        self._scalar = scalar
        self._values = values or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return _Scalars(self._values)


class _FakeSession:
    def __init__(self, results=None):
        self.results = list(results or [])
        self.calls = 0

    async def execute(self, _statement):
        result = self.results[self.calls]
        self.calls += 1
        return result


def test_date_bounds_support_llm_selected_relative_periods():
    start, end = _date_bounds({"date_range": "this_month"})
    assert start is not None
    assert end is None
    assert start.tzinfo == timezone.utc
    assert start.day == 1

    start, end = _date_bounds({"created_after": "2026-11-01", "created_before": "2026-11-10"})
    assert start.isoformat().startswith("2026-11-01")
    assert end.isoformat().startswith("2026-11-10")


def test_date_bounds_reject_invalid_period_and_reversed_dates():
    with pytest.raises(ValueError):
        _date_bounds({"date_range": "next_century"})
    with pytest.raises(ValueError):
        _date_bounds({"created_after": "2026-11-10", "created_before": "2026-11-01"})


@pytest.mark.asyncio
async def test_owner_has_tenant_wide_scope_without_user_filter_query():
    tenant_id = uuid.uuid4()
    session = _FakeSession()
    ctx = RequestContext(user_id=str(uuid.uuid4()), tenant_id=str(tenant_id), role="owner")
    assert await _visible_user_ids(session, ctx) is None
    assert session.calls == 0


@pytest.mark.asyncio
async def test_salesperson_is_scoped_to_self():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    session = _FakeSession()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="salesperson")
    assert await _visible_user_ids(session, ctx) == [user_id]
    assert session.calls == 0


@pytest.mark.asyncio
async def test_manager_scope_is_active_manager_teams_plus_self():
    tenant_id = uuid.uuid4()
    manager_id = uuid.uuid4()
    teammate_a = uuid.uuid4()
    teammate_b = uuid.uuid4()
    team_ids = [uuid.uuid4(), uuid.uuid4()]
    session = _FakeSession([
        _Result(values=team_ids),
        _Result(values=[teammate_a, teammate_b]),
    ])
    ctx = RequestContext(user_id=str(manager_id), tenant_id=str(tenant_id), role="manager")
    assert await _visible_user_ids(session, ctx) == [manager_id, teammate_a, teammate_b]
    assert session.calls == 2


@pytest.mark.asyncio
async def test_manager_without_active_team_still_sees_own_records():
    tenant_id = uuid.uuid4()
    manager_id = uuid.uuid4()
    session = _FakeSession([_Result(values=[])])
    ctx = RequestContext(user_id=str(manager_id), tenant_id=str(tenant_id), role="manager")
    assert await _visible_user_ids(session, ctx) == [manager_id]


@pytest.mark.asyncio
async def test_unknown_tool_is_rejected_without_database_access():
    session = _FakeSession()
    ctx = RequestContext(user_id=str(uuid.uuid4()), tenant_id=str(uuid.uuid4()), role="salesperson")
    result = await execute_crm_tool(session, ctx, "execute_sql", {"query": "select * from leads"})
    assert result == {"error": "Unknown CRM data tool"}
    assert session.calls == 0


def test_tool_registry_is_read_only_and_contains_expected_lookups():
    names = {entry["function"]["name"] for entry in CRM_TOOL_DEFINITIONS}
    assert names == {
        "search_leads",
        "search_deals",
        "get_pipeline_summary",
        "get_campaign_performance",
        "get_product_performance",
        "get_account_summary",
        "search_contacts",
        "search_activities",
    }
    assert all(entry["type"] == "function" for entry in CRM_TOOL_DEFINITIONS)
