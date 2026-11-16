import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from backend.app.main import app
from backend.app.application.services.telephony_service import (
    normalize_phone_number,
    TelephonyService,
    classify_carrier_call,
    redact_tokens_recursive,
)
from backend.app.application.exceptions import BadRequestError


def test_normalize_phone_number():
    # Valid E.164 numbers
    assert normalize_phone_number("+919025996477") == "+919025996477"
    assert normalize_phone_number("+14155552671") == "+14155552671"

    # Formatted numbers with spaces, brackets, hyphens
    assert normalize_phone_number("+91 9025-996-477") == "+919025996477"
    assert normalize_phone_number("+1 (415) 555-2671") == "+14155552671"

    # 10-digit Indian numbers without country code
    assert normalize_phone_number("9025996477") == "+919025996477"
    assert normalize_phone_number("9876543210") == "+919876543210"

    # Invalid / empty numbers
    with pytest.raises(BadRequestError):
        normalize_phone_number("")

    with pytest.raises(BadRequestError):
        normalize_phone_number("   ")

    with pytest.raises(BadRequestError):
        normalize_phone_number("abc")


@pytest.mark.asyncio
async def test_telephony_config_endpoint():
    transport = ASGITransport(app=app)
    headers = {
        "X-User-Id": "usr_elena",
        "X-Tenant-Id": "tenant_enterprise_01",
        "X-User-Roles": "owner",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/v1/telephony/config", headers=headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["from_number"] == "+918064264223"
        assert data["outbound_mode"] == "HUMAN_ONLY"
        assert "wss://" in data["signaling_url"]


@pytest.mark.asyncio
async def test_telephony_service_methods():
    service = TelephonyService()

    # 1. Test generate_token with mock
    mock_token_resp = {
        "success": True,
        "token": "test-jwt-token-123",
        "server_url": "wss://telephony-z5x8uya8.livekit.cloud",
        "room": "test-room-svc",
        "identity": "webrtc-agent",
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_token_resp,
            raise_for_status=lambda: None,
        )
        res = await service.generate_token(room="test-room-svc")
        assert res["success"] is True
        assert res["token"] == "test-jwt-token-123"
        assert res["url"] == "wss://telephony-z5x8uya8.livekit.cloud"

    # 2. Test initiate_call with mock
    mock_call_resp = {
        "success": True,
        "call_id": "call-123",
        "call_uuid": "uuid-456",
        "room": "test-room-svc",
        "status": "dialing",
        "token": "call-token",
        "server_url": "wss://telephony-z5x8uya8.livekit.cloud",
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_call_resp,
            raise_for_status=lambda: None,
        )
        call_res = await service.initiate_call(
            to_number="+919025996477",
            room="test-room-svc",
            contact_name="Test Lead",
        )
        assert call_res["success"] is True
        assert call_res["call_id"] == "call-123"
        assert call_res["mode"] == "HUMAN_ONLY"

    # 3. Test hangup with new documented contract {"ok": True, "status": "terminated", "room_deleted": True}
    mock_hangup_doc = {
        "ok": True,
        "status": "terminated",
        "room_deleted": True,
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_hangup_doc,
            raise_for_status=lambda: None,
        )
        h_res = await service.hangup(room="test-room-svc", call_id="call-123")
        assert h_res["ok"] is True
        assert h_res["status"] == "terminated"
        assert h_res["room_deleted"] is True

    # 4. Test hangup with legacy response {"success": True, "status": "completed"}
    mock_hangup_legacy = {
        "success": True,
        "status": "completed",
        "room": "test-room-svc",
        "duration_seconds": 22,
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_hangup_legacy,
            raise_for_status=lambda: None,
        )
        h_res_legacy = await service.hangup(room="test-room-svc", call_id="call-123")
        assert h_res_legacy["ok"] is True
        assert h_res_legacy["status"] == "terminated"
        assert h_res_legacy["room_deleted"] is True


@pytest.mark.asyncio
async def test_telephony_api_endpoints_integration():
    transport = ASGITransport(app=app)
    headers = {
        "X-User-Id": "usr_elena",
        "X-Tenant-Id": "tenant_enterprise_01",
        "X-User-Roles": "owner",
    }

    # Test DTMF endpoint
    with patch.object(TelephonyService, "send_dtmf", new_callable=AsyncMock) as mock_dtmf:
        mock_dtmf.return_value = {"ok": True, "room": "room-abc", "digit": "1"}
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/v1/telephony/dtmf",
                json={"room": "room-abc", "digit": "1"},
                headers=headers,
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["ok"] is True
            assert resp.json()["data"]["digit"] == "1"

    # Test Room Status endpoint
    with patch.object(TelephonyService, "get_room_status", new_callable=AsyncMock) as mock_st:
        mock_st.return_value = {
            "exists": True,
            "pstn_connected": True,
            "agent_connected": True,
            "participants": [],
            "room": "room-abc",
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/v1/telephony/room-status?room=room-abc", headers=headers)
            assert resp.status_code == 200
            assert resp.json()["data"]["pstn_connected"] is True

    # Test Headless Call endpoint
    with patch.object(TelephonyService, "initiate_headless_call", new_callable=AsyncMock) as mock_hl:
        mock_hl.return_value = {
            "ok": True,
            "call_id": "call-_09025996477_qqst9B7Fxv7H",
            "room_name": "call-_09025996477_qqst9B7Fxv7H",
            "status": "initiated",
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/v1/telephony/headless-call",
                json={"to": "+919025996477", "mode": "auto"},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["ok"] is True
            assert "call-" in data["call_id"]
            assert data["status"] == "initiated"

    # Test /v1/telephony/call endpoint returning simulated response fields
    mock_sim_call = {
        "ok": True,
        "success": True,
        "call_id": "sim-1794836629",
        "call_uuid": None,
        "room": "crm_room_test_api",
        "to_number": "+918700311630",
        "from_number": "+918064264223",
        "status": "simulated",
        "mode": "HUMAN_ONLY",
        "token": "test-tok",
        "server_url": "wss://test.livekit.cloud",
        "api_accepted": True,
        "carrier_status": "simulated",
        "carrier_warning": "Telephony gateway is in simulation mode. No real phone call was placed.",
        "upstream_raw": {"call_id": "sim-1794836629", "token": "<redacted>", "mode_used": "carrier_simulated"},
    }
    with patch.object(TelephonyService, "initiate_call", new_callable=AsyncMock) as mock_ic:
        mock_ic.return_value = mock_sim_call
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/v1/telephony/call",
                json={"to_number": "+918700311630", "room": "crm_room_test_api"},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            assert data["carrier_status"] == "simulated"
            assert data["api_accepted"] is True
            assert "simulation mode" in data["carrier_warning"]
            assert "token" not in data
            assert data["upstream_raw"]["token"] == "<redacted>"
            assert data["call_id"] == "sim-1794836629"


@pytest.mark.asyncio
async def test_carrier_scenario_01_mode_used_carrier_simulated():
    """Scenario 1: mode_used 'carrier_simulated' -> simulated"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "call-real-looking-id",
        "mode_used": "carrier_simulated",
        "room": "test-room-1",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-1")
            assert res["carrier_status"] == "simulated"
            assert res["api_accepted"] is True
            assert "simulation mode" in (res["carrier_warning"] or "")


@pytest.mark.asyncio
async def test_carrier_scenario_02_call_id_sim_prefix():
    """Scenario 2: call_id 'sim-123' with a different mode_used -> simulated"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "sim-123",
        "mode_used": "HUMAN_ONLY",
        "room": "test-room-2",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-2")
            assert res["carrier_status"] == "simulated"
            assert res["api_accepted"] is True


@pytest.mark.asyncio
async def test_carrier_scenario_03_call_id_uppercase_sim_prefix():
    """Scenario 3: call_id 'SIM-123' (uppercase case-insensitive) -> simulated"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "SIM-998877",
        "room": "test-room-3",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-3")
            assert res["carrier_status"] == "simulated"
            assert res["api_accepted"] is True


@pytest.mark.asyncio
async def test_carrier_scenario_04_call_id_with_uuid_dispatched_unverified():
    """Scenario 4: call_id 'call-...' with call_uuid, not simulated -> dispatched_unverified"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "call-vobiz-7788",
        "call_uuid": "uuid-vobiz-carrier-99",
        "mode_used": "carrier_active",
        "room": "test-room-4",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-4")
            assert res["carrier_status"] == "dispatched_unverified"
            assert res["api_accepted"] is True
            assert res["carrier_warning"] is None


@pytest.mark.asyncio
async def test_carrier_scenario_05_missing_mode_used_and_null_call_id():
    """Scenario 5: missing mode_used and null call_id -> no crash (returns dispatched_unverified)"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": None,
        "mode_used": None,
        "room": "test-room-5",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-5")
            assert res["carrier_status"] == "dispatched_unverified"
            assert res["api_accepted"] is True


@pytest.mark.asyncio
async def test_carrier_scenario_06_upstream_http_500():
    """Scenario 6: upstream HTTP 500 -> failed, api_accepted false"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(
                status_code=500,
                json=lambda: {"error": "Internal Server Error"},
                text='{"error":"Internal Server Error"}',
            )
            res = await service.initiate_call("+918700311630", room="test-room-6")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is False
            assert res["ok"] is False


@pytest.mark.asyncio
async def test_carrier_scenario_07_upstream_timeout_network_error():
    """Scenario 7: upstream timeout/network error -> failed, api_accepted false"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post", side_effect=Exception("Connection timed out")):
            res = await service.initiate_call("+918700311630", room="test-room-7")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is False
            assert res["ok"] is False
            assert "Connection timed out" in str(res["message"])


@pytest.mark.asyncio
async def test_carrier_scenario_08_http_200_with_success_false():
    """Scenario 8: HTTP 200 with success:false -> failed, api_accepted true"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": False,
        "call_id": "call-rejected-1",
        "message": "Trunk authorization failed",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-8")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is True
            assert res["ok"] is False
            assert "Trunk authorization failed" in res["message"]


@pytest.mark.asyncio
async def test_carrier_scenario_09_http_200_with_ok_false_and_error():
    """Scenario 9: HTTP 200 with ok:false -> failed; HTTP 200 with non-empty error -> failed"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}

    # 9a. HTTP 200 with ok:false -> failed
    mock_resp_9a = {
        "ok": False,
        "message": "SIP line busy",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp_9a, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-9a")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is True
            assert res["ok"] is False

    # 9b. HTTP 200 with non-empty error -> failed
    mock_resp_9b = {
        "success": True,
        "error": "Destination unroutable",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp_9b, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-9b")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is True
            assert "Destination unroutable" in res["message"]


@pytest.mark.asyncio
async def test_carrier_scenario_10_precedence_failed_over_simulated():
    """Scenario 10: response that is both failed and simulated -> failed (precedence)"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": False,
        "call_id": "sim-12345",
        "mode_used": "carrier_simulated",
        "error": "Simulated dispatcher out of memory",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-10")
            assert res["carrier_status"] == "failed"
            assert res["api_accepted"] is True


@pytest.mark.asyncio
async def test_carrier_scenario_11_notice_fallback_simulated():
    """Scenario 11: details.notice containing 'Fallback Simulated' -> simulated"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "carrier-sid-9999",
        "details": {
            "notice": "Carrier call queued (Fallback Simulated): None"
        },
        "room": "test-room-11",
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-11")
            assert res["carrier_status"] == "simulated"
            assert res["api_accepted"] is True
            assert res["carrier_warning"] == "Telephony gateway is in simulation mode. No real phone call was placed."


@pytest.mark.asyncio
async def test_carrier_scenario_12_upstream_raw_preserved_unchanged_except_token():
    """Scenario 12: upstream_raw preserved unchanged except token"""
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "sim-987",
        "provider": "vobiz",
        "custom_int": 42,
        "custom_float": 3.14,
        "custom_bool": True,
        "token": "secret-jwt-upstream-123",
        "sub_obj": {"status": "dialing", "nested_key": "val123"},
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-12")
            raw = res["upstream_raw"]
            assert raw["provider"] == "vobiz"
            assert raw["custom_int"] == 42
            assert raw["custom_float"] == 3.14
            assert raw["custom_bool"] is True
            assert raw["sub_obj"]["nested_key"] == "val123"


@pytest.mark.asyncio
async def test_carrier_scenario_13_token_redaction_recursive_and_top_level_omitted():
    """Scenario 13: token redaction: upstream contains token; upstream_raw.token equals '<redacted>'; no other fields modified; nested token redacted"""
    import json
    service = TelephonyService()
    mock_token = {"success": True, "token": "agent-tok-999", "server_url": "wss://test.livekit.cloud"}
    mock_resp = {
        "success": True,
        "call_id": "call-token-test",
        "token": "livekit-jwt-secret-xyz-top",
        "nested": {
            "token": "livekit-jwt-secret-nested",
            "other_field": "keep-me-intact",
        },
        "nested_list": [
            {"token": "livekit-jwt-secret-in-list", "name": "agent1"},
        ],
    }
    with patch.object(service, "generate_token", AsyncMock(return_value=mock_token)):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = AsyncMock(status_code=200, json=lambda: mock_resp, text="{}")
            res = await service.initiate_call("+918700311630", room="test-room-13")
            raw = res["upstream_raw"]
            assert raw["token"] == "<redacted>"
            assert raw["nested"]["token"] == "<redacted>"
            assert raw["nested"]["other_field"] == "keep-me-intact"
            assert raw["nested_list"][0]["token"] == "<redacted>"
            assert raw["nested_list"][0]["name"] == "agent1"
            # Ensure unredacted token strings never appear in serialized raw
            raw_str = json.dumps(raw)
            assert "livekit-jwt-secret-xyz-top" not in raw_str
            assert "livekit-jwt-secret-nested" not in raw_str
            assert "livekit-jwt-secret-in-list" not in raw_str
            # Ensure top-level token is not exposed in service response
            assert "token" not in res or res.get("token") is None


@pytest.mark.asyncio
async def test_regression_token_exposure_prevention():
    """
    Regression test ensuring:
    1. The dial response does not expose a top-level token.
    2. upstream_raw.token remains redacted (including nested objects/arrays).
    3. The separate token endpoint (/v1/telephony/token) continues working.
    """
    transport = ASGITransport(app=app)
    headers = {
        "X-User-Id": "usr_elena",
        "X-Tenant-Id": "tenant_enterprise_01",
        "X-User-Roles": "owner",
    }
    service = TelephonyService()

    # 1 & 2: Test dial response via Service and API route
    upstream_mock_with_jwt = {
        "success": True,
        "call_id": "sim-1794836629",
        "room": "reg-test-room",
        "token": "secret-upstream-jwt-do-not-leak",
        "nested": {"token": "secret-nested-jwt"},
        "mode_used": "carrier_simulated",
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(status_code=200, json=lambda: upstream_mock_with_jwt, text="{}")
        service_res = await service.initiate_call("+918700311630", room="reg-test-room")

        # Verify no top-level token in service response
        assert "token" not in service_res or service_res.get("token") is None
        # Verify upstream_raw tokens are recursively redacted
        assert service_res["upstream_raw"]["token"] == "<redacted>"
        assert service_res["upstream_raw"]["nested"]["token"] == "<redacted>"

    # Verify via HTTP API route
    with patch.object(TelephonyService, "initiate_call", new_callable=AsyncMock) as mock_ic:
        mock_ic.return_value = {
            "ok": True,
            "success": True,
            "call_id": "sim-1794836629",
            "call_uuid": None,
            "room": "reg-test-room",
            "to_number": "+918700311630",
            "from_number": "+918064264223",
            "status": "simulated",
            "mode": "HUMAN_ONLY",
            "server_url": "wss://test.livekit.cloud",
            "api_accepted": True,
            "carrier_status": "simulated",
            "carrier_warning": "Telephony gateway is in simulation mode. No real phone call was placed.",
            "upstream_raw": {"token": "<redacted>", "nested": {"token": "<redacted>"}},
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/v1/telephony/call",
                json={"to_number": "+918700311630", "room": "reg-test-room"},
                headers=headers,
            )
            assert resp.status_code == 200
            data = resp.json()["data"]
            # Top-level token MUST NOT exist
            assert "token" not in data
            # upstream_raw.token MUST be redacted
            assert data["upstream_raw"]["token"] == "<redacted>"
            assert data["upstream_raw"]["nested"]["token"] == "<redacted>"

    # 3: Verify the separate token endpoint (/v1/telephony/token) continues working
    with patch.object(TelephonyService, "generate_token", new_callable=AsyncMock) as mock_gt:
        mock_gt.return_value = {
            "success": True,
            "token": "valid-livekit-jwt-for-browser-softphone",
            "url": "wss://telephony-z5x8uya8.livekit.cloud",
            "room": "reg-test-room",
            "identity": "agent-123",
        }
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            token_resp = await client.post(
                "/v1/telephony/token",
                json={"room": "reg-test-room", "identity": "agent-123"},
                headers=headers,
            )
            assert token_resp.status_code == 200
            tok_data = token_resp.json()["data"]
            # The separate token endpoint DOES return the livekit token as required
            assert tok_data["success"] is True
            assert tok_data["token"] == "valid-livekit-jwt-for-browser-softphone"
            assert tok_data["url"] == "wss://telephony-z5x8uya8.livekit.cloud"
