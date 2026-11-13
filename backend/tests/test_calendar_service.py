import pytest
from datetime import datetime, timezone
from backend.app.application.services.calendar_service import CalendarService
from backend.app.application.exceptions import NotFoundError, BadRequestError


@pytest.mark.asyncio
async def test_calendar_create_and_list_event(db_session, ctx_owner_a):
    """Test creating a calendar event and listing it with tenant isolation."""
    cal_service = CalendarService(db_session)

    activity = await cal_service.create_event(
        ctx=ctx_owner_a,
        title="Q4 Product Demo with Acme Corp",
        company="Acme Corp",
        type="demo",
        hour=14,
        duration="45m",
        description="Demoing new freight AI co-pilot.",
    )
    assert activity.subject == "Q4 Product Demo with Acme Corp"
    assert activity.type == "demo"
    assert activity.organization_id == ctx_owner_a.tenant_uuid

    # List events for this tenant
    events = await cal_service.list_events(ctx_owner_a)
    assert len(events) >= 1
    found = next((e for e in events if e["id"] == str(activity.id)), None)
    assert found is not None
    assert found["title"] == "Q4 Product Demo with Acme Corp"
    assert found["company"] == "Acme Corp"


@pytest.mark.asyncio
async def test_calendar_toggle_status_and_delete(db_session, ctx_owner_a):
    """Test toggling event status and deleting it."""
    cal_service = CalendarService(db_session)

    activity = await cal_service.create_event(
        ctx=ctx_owner_a,
        title="Follow-up Call with Client",
        type="call",
    )
    assert activity.status == "scheduled"

    # Toggle to completed
    updated = await cal_service.update_status(ctx_owner_a, activity.id, "completed")
    assert updated.status == "completed"

    # Delete event
    deleted = await cal_service.delete_event(ctx_owner_a, activity.id)
    assert deleted is True

    # Confirm not found after delete
    with pytest.raises(NotFoundError):
        await cal_service.update_status(ctx_owner_a, activity.id, "completed")


@pytest.mark.asyncio
async def test_calendar_cross_tenant_isolation(db_session, ctx_owner_a, ctx_owner_b):
    """Test that Tenant B cannot access or view Tenant A's calendar events."""
    cal_service = CalendarService(db_session)

    activity_a = await cal_service.create_event(
        ctx=ctx_owner_a,
        title="Tenant A Private Board Meeting",
        type="meeting",
    )

    # Tenant B tries to delete or modify Tenant A's event -> 404
    with pytest.raises(NotFoundError):
        await cal_service.update_status(ctx_owner_b, activity_a.id, "completed")

    with pytest.raises(NotFoundError):
        await cal_service.delete_event(ctx_owner_b, activity_a.id)

    # Tenant B listing events should NOT contain Tenant A's event
    events_b = await cal_service.list_events(ctx_owner_b)
    assert not any(e["id"] == str(activity_a.id) for e in events_b)


@pytest.mark.asyncio
async def test_calendar_personal_isolation_salesperson_vs_owner(db_session, ctx_owner_a, ctx_sales_a1):
    """Test that salesperson cannot view owner's personal calendar markings."""
    cal_service = CalendarService(db_session)

    # Owner creates a personal event
    owner_event = await cal_service.create_event(
        ctx=ctx_owner_a,
        title="Owner Executive Strategy Session",
        type="meeting",
    )

    # Salesperson creates a personal event
    sales_event = await cal_service.create_event(
        ctx=ctx_sales_a1,
        title="Salesperson Client Call",
        type="call",
    )

    # Salesperson listing events (default personal scope) -> sees ONLY their event, NEVER owner's
    sales_events = await cal_service.list_events(ctx_sales_a1, scope="personal")
    assert any(e["id"] == str(sales_event.id) for e in sales_events)
    assert not any(e["id"] == str(owner_event.id) for e in sales_events)

    # Even if salesperson tries scope="team", salesperson is restricted to personal
    sales_events_team = await cal_service.list_events(ctx_sales_a1, scope="team")
    assert not any(e["id"] == str(owner_event.id) for e in sales_events_team)

    # Owner with scope="personal" sees only their own event
    owner_personal = await cal_service.list_events(ctx_owner_a, scope="personal")
    assert any(e["id"] == str(owner_event.id) for e in owner_personal)
    assert not any(e["id"] == str(sales_event.id) for e in owner_personal)

    # Owner with scope="team" can oversee all events in the organization
    owner_team = await cal_service.list_events(ctx_owner_a, scope="team")
    assert any(e["id"] == str(owner_event.id) for e in owner_team)
    assert any(e["id"] == str(sales_event.id) for e in owner_team)


