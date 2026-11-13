import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from backend.app.main import app
from backend.app.application.services.telephony_service import normalize_phone_number, TelephonyService
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
        assert data["from_number"] == "+917971443119"
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

    # 3. Test hangup with mock
    mock_hangup = {
        "success": True,
        "status": "completed",
        "room": "test-room-svc",
        "duration_seconds": 22,
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_hangup,
            raise_for_status=lambda: None,
        )
        h_res = await service.hangup(room="test-room-svc", call_id="call-123")
        assert h_res["success"] is True
        assert h_res["status"] == "terminated"


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
