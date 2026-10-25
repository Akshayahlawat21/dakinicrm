import pytest
from httpx import AsyncClient
from gateway.config import settings


@pytest.mark.asyncio
async def test_unsupported_http_method_rejected(client: AsyncClient):
    """E6: Unsupported HTTP method (e.g. TRACE) rejected with 405."""
    resp = await client.request("TRACE", "/health")
    assert resp.status_code == 405
    data = resp.json()
    assert data["error"]["code"] == "METHOD_NOT_ALLOWED"


@pytest.mark.asyncio
async def test_payload_too_large_rejected(client: AsyncClient, auth_headers: dict):
    """E6: Request body exceeding MAX_BODY_SIZE_BYTES rejected with 413."""
    # Temporarily set max body to 100 bytes for testing
    original_size = settings.MAX_BODY_SIZE_BYTES
    settings.MAX_BODY_SIZE_BYTES = 100
    try:
        large_body = {"data": "x" * 200}
        resp = await client.post("/v1/leads", json=large_body, headers=auth_headers)
        assert resp.status_code == 413
        data = resp.json()
        assert data["error"]["code"] == "PAYLOAD_TOO_LARGE"
    finally:
        settings.MAX_BODY_SIZE_BYTES = original_size


@pytest.mark.asyncio
async def test_unsupported_media_type_on_write(client: AsyncClient, auth_headers: dict):
    """E6: Non-JSON body on POST without multipart rejected with 415."""
    headers = {
        "Authorization": auth_headers["Authorization"],
        "Content-Type": "text/xml",
    }
    resp = await client.post("/v1/leads", content="<xml></xml>", headers=headers)
    assert resp.status_code == 415
    data = resp.json()
    assert data["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


@pytest.mark.asyncio
async def test_cors_preflight_options(client: AsyncClient):
    """E6: Restrictive CORS preflight response."""
    resp = await client.options(
        "/v1/leads",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization,Content-Type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
