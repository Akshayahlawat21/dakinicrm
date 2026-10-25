import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_correlation_id_generated_when_missing(client: AsyncClient):
    """E7: Generates a new correlation ID when client does not supply one."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    cid = resp.headers.get("X-Correlation-ID")
    assert cid is not None
    assert cid.startswith("req_")


@pytest.mark.asyncio
async def test_correlation_id_accepted_when_valid(client: AsyncClient):
    """E7: Accepts and forwards valid client-supplied correlation ID."""
    custom_cid = "client-txn-abc-12345"
    resp = await client.get("/health", headers={"X-Correlation-ID": custom_cid})
    assert resp.status_code == 200
    assert resp.headers.get("X-Correlation-ID") == custom_cid


@pytest.mark.asyncio
async def test_correlation_id_sanitized_when_malicious_or_invalid(client: AsyncClient):
    """E7: Replaces invalid/injection correlation ID with safe generated one."""
    malicious_cid = "req_\r\nInjected-Header: evil\x00<script>"
    resp = await client.get("/health", headers={"X-Correlation-ID": malicious_cid})
    assert resp.status_code == 200
    cid = resp.headers.get("X-Correlation-ID")
    assert cid != malicious_cid
    assert cid.startswith("req_")
