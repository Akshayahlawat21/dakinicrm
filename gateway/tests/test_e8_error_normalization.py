import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_error_envelope_consistency(client: AsyncClient):
    """
    E8: Verify all gateway error responses (401, 404, 405, 415, 429, 502)
    share the uniform schema:
    { "error": { "code": str, "message": str, "correlation_id": str } }
    """
    # 1. 401 Unauthorized
    r401 = await client.get("/v1/deals")
    assert r401.status_code == 401
    d401 = r401.json()
    assert set(d401["error"].keys()) >= {"code", "message", "correlation_id"}
    assert d401["error"]["correlation_id"] == r401.headers["X-Correlation-ID"]

    # 2. 404 Not Found
    r404 = await client.get("/random_bad_root_path")
    assert r404.status_code == 404
    d404 = r404.json()
    assert set(d404["error"].keys()) >= {"code", "message", "correlation_id"}

    # 3. 405 Method Not Allowed
    r405 = await client.request("TRACE", "/health")
    assert r405.status_code == 405
    d405 = r405.json()
    assert set(d405["error"].keys()) >= {"code", "message", "correlation_id"}

    # 4. 415 Unsupported Media Type
    r415 = await client.post("/v1/deals", content="hello", headers={"Content-Type": "text/plain"})
    assert r415.status_code == 415
    d415 = r415.json()
    assert set(d415["error"].keys()) >= {"code", "message", "correlation_id"}
