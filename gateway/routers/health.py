import time
from typing import Dict, Any
from fastapi import APIRouter, Request
import httpx
from gateway.config import settings

router = APIRouter(tags=["Health & Diagnostics"])


async def check_upstream_health() -> str:
    """Probe upstream Layer 3 API health endpoint."""
    try:
        async with httpx.AsyncClient(timeout=0.5) as client:
            resp = await client.get(f"{settings.UPSTREAM_API_URL.rstrip('/')}/health")
            if resp.status_code == 200:
                return "healthy"
            return f"degraded (HTTP {resp.status_code})"
    except Exception:
        return "unreachable / offline"


@router.get("/health", summary="E2: Gateway Health Check")
@router.get("/v1/health", summary="E2: Gateway Versioned Health Check")
async def health_check(request: Request) -> Dict[str, Any]:
    """
    E2: Health check endpoint for load balancers (AWS ALB, Nginx, Cloudflare),
    TLS terminators, and container orchestrators.
    """
    upstream_status = await check_upstream_health()
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": int(time.time()),
        "correlation_id": correlation_id,
        "upstream": {
            "url": settings.UPSTREAM_API_URL,
            "status": upstream_status,
        },
        "edge_shield": {
            "enabled": settings.EDGE_SHIELD_ENABLED,
        },
        "rate_limiting": {
            "enabled": settings.RATE_LIMIT_ENABLED,
            "backend": "redis" if settings.REDIS_URL else "in-memory",
        },
    }
