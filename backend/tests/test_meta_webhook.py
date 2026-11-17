import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_meta_webhook_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/meta-ads/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert data["webhook_endpoint"] == "/v1/meta-ads/webhook"


@pytest.mark.asyncio
async def test_meta_webhook_verification_success():
    challenge = "1158201444"
    verify_token = settings.META_VERIFY_TOKEN

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/v1/meta-ads/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": challenge,
                "hub.verify_token": verify_token,
            },
        )
        assert resp.status_code == 200
        assert resp.text == challenge


@pytest.mark.asyncio
async def test_meta_webhook_verification_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/v1/meta-ads/webhook",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": "12345",
                "hub.verify_token": "wrong_token",
            },
        )
        assert resp.status_code == 403
        assert "mismatch" in resp.text


@pytest.mark.asyncio
async def test_meta_webhook_sample_event():
    sample_payload = {
        "sample": {
            "field": "leadgen",
            "value": {
                "ad_id": "444444444",
                "form_id": "444444444444",
                "leadgen_id": "444444444444",
                "created_time": 1794904262,
                "page_id": "444444444444",
                "adgroup_id": "444444444444",
            },
        }
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/v1/meta-ads/webhook", json=sample_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "EVENT_RECEIVED"
        assert data["count"] == 1

