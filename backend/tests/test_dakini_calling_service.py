from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
import uuid

import pytest

from backend.app.application.context import RequestContext
from backend.app.application.services.dakini_calling_service import DakiniCallingService, _phone, _unwrap


def test_phone_normalization_uses_indian_country_code_for_ten_digits():
    assert _phone("98765 43210") == "+919876543210"
    assert _phone("+91 98765-43210") == "+919876543210"


def test_unwrap_supports_dakini_data_envelope():
    assert _unwrap({"success": True, "data": {"call_id": "call-1"}}) == {"call_id": "call-1"}


@pytest.mark.asyncio
async def test_single_call_uses_dakini_documented_request_field():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    class EmptyResult:
        def scalar_one_or_none(self):
            return None
        def scalars(self):
            return SimpleNamespace(all=lambda: [])
    session = SimpleNamespace(execute=AsyncMock(return_value=EmptyResult()), add=lambda _item: None, commit=AsyncMock())
    service = DakiniCallingService(session, ctx)
    lead = SimpleNamespace(id=uuid.uuid4(), phone="9876543210")
    service._get_lead = AsyncMock(return_value=lead)
    captured = {}

    async def fake_request(method, path, **kwargs):
        captured.update({"method": method, "path": path, **kwargs})
        return {"success": True, "data": {"call_id": "dakini-call-1", "agent_id": "agent-1", "status": "initiated"}}

    service._credentials = lambda: ("api-key", "agent-1", "+911234567890")
    service._request = fake_request

    result = await service.initiate_single_call(str(lead.id))

    assert result["call_id"] == "dakini-call-1"
    assert captured["method"] == "POST"
    assert captured["path"] == "/call"
    assert captured["json"]["recipient_phone_number"] == "+919876543210"
    assert "reciver_phone_number" not in captured["json"]
    assert "receiver_phone_number" not in captured["json"]
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_background_poll_fetches_agent_logs_once_and_matches_single_call():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")

    class FakeScalars:
        def all(self):
            return [pending_call]

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    pending_call = SimpleNamespace(
        dakini_call_id="call-100",
        dakini_batch_id=None,
        phone_number="+919876543210",
        transcript_id=None,
        agent_id="agent-1",
    )
    session = SimpleNamespace(
        execute=AsyncMock(return_value=FakeResult()),
        commit=AsyncMock(),
    )
    service = DakiniCallingService(session, ctx)
    service._request = AsyncMock(return_value={
        "success": True,
        "data": {
            "call_logs": {
                "call-100": {
                    "id": "call-100",
                    "status": "completed",
                    "transcript": "Customer asked for a product demo.",
                }
            }
        },
    })
    service._persist_call_log = AsyncMock()

    result = await service.poll_agent_call_logs("agent-1")

    assert result == {"call_logs_seen": 1, "calls_matched": 1, "attempts_created": 0}
    service._request.assert_awaited_once_with("GET", "/call_logs/agent-1/list")
    service._persist_call_log.assert_awaited_once_with(
        pending_call,
        {
            "id": "call-100",
            "status": "completed",
            "transcript": "Customer asked for a product demo.",
        },
        {
            "id": "call-100",
            "status": "completed",
            "transcript": "Customer asked for a product demo.",
        },
    )
    session.commit.assert_awaited_once()


def test_phone_match_key_preserves_international_country_code():
    assert DakiniCallingService._normal_phone_key("+91 98765-43210") == "919876543210"
    assert DakiniCallingService._normal_phone_key("+1 98765-43210") == "19876543210"
    assert DakiniCallingService._normal_phone_key("+91 98765-43210") != DakiniCallingService._normal_phone_key("+1 98765-43210")


def test_batch_progress_distinguishes_submitted_contacts_from_triggered_calls():
    batch = SimpleNamespace(
        dakini_batch_id="batch-100",
        status="running",
        total_contacts=5,
        transcript_count=0,
        scheduled_at=None,
        last_polled_at=None,
    )
    calls = [
        SimpleNamespace(lead_id=uuid.uuid4(), status="completed", dakini_call_id="call-1", transcript_id=uuid.uuid4(), analyzed_at=uuid.uuid4()),
        SimpleNamespace(lead_id=uuid.uuid4(), status="initiated", dakini_call_id="call-2", transcript_id=None, analyzed_at=None),
        SimpleNamespace(lead_id=uuid.uuid4(), status="failed", dakini_call_id="call-3", transcript_id=None, analyzed_at=None),
        SimpleNamespace(lead_id=uuid.uuid4(), status="pending", dakini_call_id=None, transcript_id=None, analyzed_at=None),
        SimpleNamespace(lead_id=uuid.uuid4(), status="pending", dakini_call_id=None, transcript_id=None, analyzed_at=None),
    ]

    progress = DakiniCallingService._batch_progress(batch, calls)

    assert progress["total_contacts"] == 5
    assert progress["lead_records_created"] == 5
    assert progress["triggered_count"] == 3
    assert progress["calls_tracked"] == 3
    assert progress["completed_count"] == 1
    assert progress["ongoing_count"] == 1
    assert progress["failed_count"] == 1
    assert progress["not_triggered_count"] == 2
    assert progress["processed_count"] == 2
    assert progress["progress_percent"] == 40.0
    assert progress["transcripts_saved"] == 1
    assert progress["analyses_completed"] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("initial_status", ["pending", "created"])
async def test_schedule_batch_sends_timezone_aware_utc_payload_and_updates_status(initial_status):
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(status=initial_status, created_by=user_id, scheduled_at=None, raw_response=None)
    class EmptyResult:
        def scalars(self):
            return SimpleNamespace(all=lambda: [])
    session = SimpleNamespace(execute=AsyncMock(return_value=EmptyResult()), commit=AsyncMock())
    service = DakiniCallingService(session, ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock(return_value={"success": True, "data": {"batch_id": "batch-1", "status": "scheduled"}})

    from datetime import datetime, timezone, timedelta
    scheduled_at = datetime(2026, 12, 1, 10, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    result = await service.schedule_batch("batch-1", scheduled_at)

    assert result["status"] == "scheduled"
    service._request.assert_awaited_once_with(
        "POST", "/batches/batch-1/schedule",
        files={"scheduled_at": (None, "2026-12-01T05:00:00Z")},
    )
    assert batch.status == "scheduled"
    assert batch.scheduled_at == scheduled_at.astimezone(timezone.utc)
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_schedule_batch_rejects_a_batch_that_already_has_a_scheduled_time():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(
        status="pending",
        created_by=user_id,
        scheduled_at=datetime(2026, 12, 1, 5, 0, tzinfo=timezone.utc),
    )
    service = DakiniCallingService(SimpleNamespace(commit=AsyncMock()), ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock()

    with pytest.raises(Exception, match="already has a scheduled start time"):
        await service.schedule_batch(
            "batch-1",
            datetime(2026, 12, 2, 5, 0, tzinfo=timezone.utc),
        )
    service._request.assert_not_awaited()


@pytest.mark.asyncio
async def test_stop_batch_calls_documented_stop_endpoint_and_updates_status():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(status="running", created_by=user_id, raw_response=None)
    class EmptyResult:
        def scalars(self):
            return SimpleNamespace(all=lambda: [])
    session = SimpleNamespace(execute=AsyncMock(return_value=EmptyResult()), commit=AsyncMock())
    service = DakiniCallingService(session, ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock(return_value={"success": True, "data": {"batch_id": "batch-1", "status": "stopped"}})

    result = await service.stop_batch("batch-1")

    assert result["status"] == "stopped"
    service._request.assert_awaited_once_with("POST", "/batches/batch-1/stop")
    assert batch.status == "stopped"
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_background_batch_status_poll_uses_get_batch_endpoint_and_persists_status():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(
        dakini_batch_id="batch-77",
        status="scheduled",
        total_contacts=10,
        raw_response=None,
        last_polled_at=None,
    )
    session = SimpleNamespace(commit=AsyncMock())
    service = DakiniCallingService(session, ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock(return_value={
        "success": True,
        "data": {"batch_id": "batch-77", "status": "running", "total_contacts": 10},
    })

    result = await service.poll_batch_status("batch-77")

    assert result == {"batch_id": "batch-77", "status": "running", "total_contacts": 10}
    service._request.assert_awaited_once_with("GET", "/batches/batch-77")
    assert batch.status == "running"
    assert batch.last_polled_at is not None
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_schedule_batch_rejects_naive_datetime_before_dakini_request():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(status="pending", created_by=user_id)
    service = DakiniCallingService(SimpleNamespace(commit=AsyncMock()), ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock()

    from datetime import datetime
    with pytest.raises(Exception, match="scheduled_at must include a timezone"):
        await service.schedule_batch("batch-1", datetime(2026, 12, 1, 10, 30))
    service._request.assert_not_awaited()


@pytest.mark.asyncio
async def test_stop_batch_rejects_terminal_batch_without_calling_dakini():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch = SimpleNamespace(status="completed", created_by=user_id)
    service = DakiniCallingService(SimpleNamespace(commit=AsyncMock()), ctx)
    service._get_batch_record = AsyncMock(return_value=batch)
    service._request = AsyncMock()

    with pytest.raises(Exception, match="Only pending, scheduled or running batches can be stopped"):
        await service.stop_batch("batch-1")
    service._request.assert_not_awaited()


def test_batch_progress_counts_call_attempts_and_unique_contacts_separately():
    lead_one = uuid.uuid4()
    lead_two = uuid.uuid4()
    batch = SimpleNamespace(
        dakini_batch_id="batch-retries",
        status="running",
        total_contacts=7,
        scheduled_at=None,
        last_polled_at=None,
    )
    calls = [
        SimpleNamespace(lead_id=lead_one, status="connected", dakini_call_id="call-1", transcript_id=None, analyzed_at=None),
        SimpleNamespace(lead_id=lead_one, status="disconnected", dakini_call_id="call-2", transcript_id=None, analyzed_at=None),
        SimpleNamespace(lead_id=lead_two, status="pending", dakini_call_id="call-3", transcript_id=None, analyzed_at=None),
    ]

    progress = DakiniCallingService._batch_progress(batch, calls)

    assert progress["triggered_count"] == 3  # three unique provider call IDs / attempts
    assert progress["triggered_contacts_count"] == 2  # only two of seven leads called
    assert progress["not_triggered_count"] == 5
    assert progress["completed_count"] == 2  # connected and disconnected are completed outcomes
    assert progress["ongoing_count"] == 1
    assert progress["failed_count"] == 0
    assert progress["processed_contacts_count"] == 1  # lead_one counted once despite two attempts


@pytest.mark.asyncio
async def test_batch_log_sync_records_distinct_retry_attempts_without_duplicate_rows():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    lead_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    batch_id = "batch-retry-1"
    phone = "+919876543210"
    placeholder = SimpleNamespace(
        organization_id=tenant_id,
        lead_id=lead_id,
        created_by=user_id,
        dakini_call_id=None,
        dakini_batch_id=batch_id,
        agent_id="agent-1",
        phone_number=phone,
        status="pending",
        transcript_id=None,
        activity_id=None,
        duration_seconds=0,
        recording_url=None,
        synced_at=None,
        last_polled_at=None,
        raw_response=None,
    )

    class FakeResult:
        def scalars(self):
            return self
        def all(self):
            return [placeholder]

    added = []
    session = SimpleNamespace(
        execute=AsyncMock(return_value=FakeResult()),
        add=added.append,
        commit=AsyncMock(),
    )

    service = DakiniCallingService(session, ctx)
    service._request = AsyncMock(return_value={
        "success": True,
        "data": {
            "call_logs": [
                {
                    "id": "attempt-1", "batch_id": batch_id, "status": "connected",
                    "context_details": {"recipient_phone_number": phone},
                },
                {
                    "id": "attempt-2", "batch_id": batch_id, "status": "disconnected",
                    "context_details": {"recipient_phone_number": phone},
                },
                {
                    "id": "attempt-2", "batch_id": batch_id, "status": "disconnected",
                    "context_details": {"recipient_phone_number": phone},
                },
            ]
        },
    })
    service._persist_call_log = AsyncMock()

    result = await service.poll_agent_call_logs("agent-1")

    assert result == {"call_logs_seen": 3, "calls_matched": 3, "attempts_created": 1}
    assert placeholder.dakini_call_id == "attempt-1"
    assert len(added) == 1
    assert added[0].dakini_call_id == "attempt-2"
    assert added[0].lead_id == lead_id
    assert service._persist_call_log.await_count == 3
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_poll_agent_call_logs_preserves_multiple_attempts_for_same_batch_contact():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    lead_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")

    placeholder = SimpleNamespace(
        organization_id=tenant_id,
        lead_id=lead_id,
        created_by=user_id,
        dakini_call_id=None,
        dakini_batch_id="batch-200",
        agent_id="agent-1",
        phone_number="+919876543210",
        status="pending",
        transcript_id=None,
        raw_response=None,
        last_polled_at=None,
    )

    class FakeScalars:
        def all(self):
            return [placeholder]

    class FakeResult:
        def scalars(self):
            return FakeScalars()

    added = []
    session = SimpleNamespace(
        execute=AsyncMock(return_value=FakeResult()),
        add=added.append,
        commit=AsyncMock(),
    )
    service = DakiniCallingService(session, ctx)
    service._request = AsyncMock(return_value={
        "success": True,
        "data": {
            "call_logs": [
                {
                    "call_id": "attempt-1",
                    "batch_id": "batch-200",
                    "call_status": "disconnected",
                    "recipient": {"phone": "+919876543210"},
                },
                {
                    "call_id": "attempt-2",
                    "batch_id": "batch-200",
                    "status": "connected",
                    "to": {"phone_number": "+919876543210"},
                },
            ]
        },
    })
    service._persist_call_log = AsyncMock()

    result = await service.poll_agent_call_logs("agent-1")

    assert result == {"call_logs_seen": 2, "calls_matched": 2, "attempts_created": 1}
    assert placeholder.dakini_call_id == "attempt-1"
    assert len(added) == 1
    assert added[0].dakini_call_id == "attempt-2"
    assert added[0].lead_id == lead_id
    assert added[0].dakini_batch_id == "batch-200"
    assert service._persist_call_log.await_count == 2
    session.commit.assert_awaited_once()


def test_batch_summary_counts_disconnected_as_completed_and_unique_leads_as_progress():
    batch = SimpleNamespace(
        dakini_batch_id="batch-300",
        status="completed",
        total_contacts=2,
        transcript_count=0,
        scheduled_at=None,
        last_polled_at=None,
    )
    summary = DakiniCallingService._batch_summary(
        batch,
        {"disconnected": 2},
        lead_records_created=3,
        triggered_count=3,
        transcript_count=2,
        analyzed_count=0,
        triggered_contacts_count=2,
        processed_contacts_count=2,
    )

    assert summary["triggered_count"] == 3  # three distinct call attempts / IDs
    assert summary["triggered_contacts_count"] == 2  # two unique leads
    assert summary["completed_count"] == 2
    assert summary["not_triggered_count"] == 0
    assert summary["progress_percent"] == 100.0


@pytest.mark.asyncio
async def test_lead_call_status_distinguishes_queued_placeholder_from_received_attempt():
    tenant_id = uuid.uuid4()
    user_id = uuid.uuid4()
    lead_id = uuid.uuid4()
    ctx = RequestContext(user_id=str(user_id), tenant_id=str(tenant_id), role="owner")
    lead = SimpleNamespace(id=lead_id, organization_id=tenant_id, deleted_at=None, name="Example Lead")
    queued = SimpleNamespace(
        id=uuid.uuid4(), lead_id=lead_id, status="pending", dakini_call_id=None,
        dakini_batch_id="batch-latest", transcript_id=None, analyzed_at=None,
        created_at=datetime(2026, 11, 17, 15, 0, tzinfo=timezone.utc), recording_url=None,
    )
    received = SimpleNamespace(
        id=uuid.uuid4(), lead_id=lead_id, status="disconnected", dakini_call_id="call-old",
        dakini_batch_id="batch-old", transcript_id=uuid.uuid4(), analyzed_at=None,
        created_at=datetime(2026, 11, 17, 14, 0, tzinfo=timezone.utc), recording_url="https://example.test/recording",
    )

    class FakeResult:
        def all(self):
            return [(queued, lead), (received, lead)]

    session = SimpleNamespace(execute=AsyncMock(return_value=FakeResult()))
    service = DakiniCallingService(session, ctx)
    service._can_access_lead = AsyncMock(return_value=True)

    rows = await service.get_lead_call_statuses([str(lead_id)])

    assert len(rows) == 1
    row = rows[0]
    assert row["has_ai_call"] is True
    assert row["has_received_call"] is True
    assert row["call_attempt_count"] == 1
    assert row["call_id"] == "call-old"
    assert row["is_active"] is True
    assert row["is_queued_without_call_id"] is True
    assert row["status"] == "pending"
    assert row["transcript_saved"] is True
    assert row["analysis_saved"] is False
