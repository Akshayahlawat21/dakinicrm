"""
Authenticated Layer 9 proxy for the Dakini CRM Layer 2 Gateway.

This router must be registered before the generic /v1/{path:path} proxy router.
The tenant header passed to Layer 9 is derived from the verified JWT context,
never trusted from an incoming client header.
"""
from typing import Set

import httpx
import logging
from fastapi import APIRouter, Request, Response
from gateway.config import settings
from gateway.errors import BadGatewayException, GatewayTimeoutException, NotFoundException
from gateway.middleware.rate_limiter import apply_rate_limit
from gateway.security.auth import validate_jwt_token

logger = logging.getLogger("gateway.analytics_proxy")

router = APIRouter(prefix="/v1/analytics", tags=["Layer 9 Analytics Proxy"])

ALLOWED_ANALYTICS_PATHS: Set[str] = {
    "reports/overview",
    "reports/revenue-trend",
    "reports/pipeline-by-stage",
    "reports/lead-sources",
    "reports/conversion-funnel",
    "reports/activity-performance",
    "reports/quota-leaderboard",
    "reports/target-pace",
    "reports/export.csv",
}

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}

UNTRUSTED_IDENTITY_HEADERS = {
    "x-tenant-id",
    "x-user-id",
    "x-user-roles",
    "x-team-id",
    "authorization",  # Token has already been validated by the Gateway.
}


@router.api_route("/{path:path}", methods=["GET"])
async def proxy_analytics(path: str, request: Request) -> Response:
    """Forward a registered analytics GET request to the private Layer 9 service."""
    if path not in ALLOWED_ANALYTICS_PATHS:
        raise NotFoundException(
            message=f"Analytics endpoint '/v1/analytics/{path}' is not registered",
            code="ANALYTICS_ROUTE_NOT_FOUND",
        )

    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    # Validates Bearer JWT and sets request.state.user_id / tenant_id / roles.
    await validate_jwt_token(request)
    verified_tenant_id = getattr(request.state, "tenant_id", None)
    if not verified_tenant_id:
        raise NotFoundException(
            message="The authenticated token does not contain an organization context",
            code="TENANT_CONTEXT_MISSING",
        )

    rate_limit_headers = await apply_rate_limit(request)

    forward_headers = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in HOP_BY_HOP_HEADERS or lower in UNTRUSTED_IDENTITY_HEADERS:
            continue
        forward_headers[key] = value

    # Replace caller-supplied identity with the context validated from JWT claims.
    forward_headers["X-Tenant-Id"] = str(verified_tenant_id)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        forward_headers["X-User-Id"] = str(user_id)
    roles = getattr(request.state, "roles", None) or []
    if isinstance(roles, str):
        roles = [roles]
    if roles:
        forward_headers["X-User-Roles"] = ",".join(str(role) for role in roles)
    team_id = getattr(request.state, "team_id", None)
    if team_id:
        forward_headers["X-Team-Id"] = str(team_id)
    forward_headers["X-Correlation-ID"] = correlation_id
    forward_headers["X-Forwarded-For"] = getattr(request.state, "client_ip", "127.0.0.1")
    forward_headers["X-Forwarded-Proto"] = request.url.scheme

    target_url = f"{settings.ANALYTICS_API_URL.rstrip('/')}/v1/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    try:
        async with httpx.AsyncClient(timeout=settings.UPSTREAM_TIMEOUT_SECONDS) as client:
            upstream = await client.get(target_url, headers=forward_headers)

        logger.info(
            "Forwarded authenticated analytics report to Layer 9: path=%s status=%s correlation_id=%s",
            path,
            upstream.status_code,
            correlation_id,
        )
        response_headers = {}
        for key, value in upstream.headers.items():
            if key.lower() not in HOP_BY_HOP_HEADERS:
                response_headers[key] = value
        response_headers["X-Correlation-ID"] = correlation_id
        response_headers.update(rate_limit_headers)
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=response_headers,
            media_type=upstream.headers.get("content-type"),
        )
    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        raise BadGatewayException(
            message=f"Layer 9 Analytics service is unreachable at {settings.ANALYTICS_API_URL}"
        ) from exc
    except httpx.ReadTimeout as exc:
        raise GatewayTimeoutException(
            message=f"Layer 9 Analytics service timed out after {settings.UPSTREAM_TIMEOUT_SECONDS} seconds"
        ) from exc
