import logging
from typing import Set
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
import httpx
from gateway.config import settings
from gateway.errors import (
    NotFoundException,
    BadGatewayException,
    GatewayTimeoutException,
    GoneException,
)
from gateway.security.auth import validate_jwt_token
from gateway.middleware.rate_limiter import apply_rate_limit

logger = logging.getLogger("gateway.proxy")

router = APIRouter(prefix="/v1", tags=["Layer 3 API Proxy"])

# Known registered API resource modules (OpenAPI contract)
REGISTERED_RESOURCES: Set[str] = {
    "leads",
    "deals",
    "accounts",
    "contacts",
    "campaigns",
    "tasks",
    "agent",
    "reports",
    "dashboard",
    "users",
    "sales-targets",
    "settings",
    "automations",
    "notifications",
    "approvals",
    "export",
    "import",
}

# Hop-by-hop headers to strip when forwarding
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
}


def get_mock_data_for_resource(resource: str, method: str) -> dict:
    """Fallback mock data for development when Layer 3 backend is not yet started."""
    if resource == "leads":
        if method == "POST":
            return {"status": "success", "message": "Lead created via Layer 2 Gateway fallback", "id": "lead-new-123"}
        return {
            "status": "success",
            "source": "gateway_dev_mock_fallback",
            "data": [
                {
                    "id": "lead-1",
                    "name": "Aarav Patel",
                    "company": "Skyline Logistics Corp",
                    "score": 128,
                    "status": "Contacted",
                    "email": "aarav.patel@skylinelogistics.in",
                    "phone": "+91 98201 44521",
                    "owner": "Marcus Vance",
                },
                {
                    "id": "lead-2",
                    "name": "Meera Sundaram",
                    "company": "Apex Supply Chains",
                    "score": 94,
                    "status": "Qualified",
                    "email": "meera@apexsupply.com",
                    "phone": "+91 97112 88304",
                    "owner": "Elena Rostova",
                },
            ],
        }
    elif resource == "deals":
        return {
            "status": "success",
            "source": "gateway_dev_mock_fallback",
            "data": [
                {
                    "id": "deal-1",
                    "name": "Skyline - Fleet Telematics Expansion",
                    "company": "Skyline Logistics Corp",
                    "value": 48000,
                    "stage": "Discovery",
                }
            ],
        }
    elif resource == "agent":
        return {
            "status": "success",
            "reply": "Layer 2 Gateway received message: Lead score 128 is driven by executive engagement.",
            "sender": "dakini",
        }
    return {
        "status": "success",
        "source": "gateway_dev_mock_fallback",
        "resource": resource,
        "message": f"Development mock response for /{resource}. Connect Layer 3 backend at {settings.UPSTREAM_API_URL} for live data.",
    }


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_to_upstream(path: str, request: Request) -> Response:
    """
    E3: Versioned API Gateway Router.
    - Validates route exists in registered OpenAPI contract (or returns 404)
    - Validates JWT token and extracts claims (E4)
    - Applies rate limiting according to endpoint policy (E5)
    - Forwards clean request to Layer 3 Application API with identity headers
    - Normalizes errors and handles upstream connectivity failures (502 / 504)
    """
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")

    # 1. Route validation (E3)
    resource = path.split("/")[0].lower() if path else ""
    if resource not in REGISTERED_RESOURCES:
        logger.warning(
            f"Unknown route requested: /v1/{path}",
            extra={"correlation_id": correlation_id},
        )
        raise NotFoundException(
            message=f"API resource '/v1/{resource}' is not recognized in the Layer 2 OpenAPI routing table"
        )

    # 2. Token validation (E4)
    await validate_jwt_token(request)

    # 3. Rate limiting (E5)
    rate_limit_headers = await apply_rate_limit(request)

    # 4. Prepare forwarded headers
    forward_headers = {}
    for k, v in request.headers.items():
        if k.lower() not in HOP_BY_HOP_HEADERS:
            forward_headers[k] = v

    # Inject verified identity headers from gateway to Layer 3
    if hasattr(request.state, "user_id") and request.state.user_id:
        forward_headers["X-User-Id"] = str(request.state.user_id)
    if hasattr(request.state, "tenant_id") and request.state.tenant_id:
        forward_headers["X-Tenant-Id"] = str(request.state.tenant_id)
    if hasattr(request.state, "roles") and request.state.roles:
        forward_headers["X-User-Roles"] = ",".join(request.state.roles)

    forward_headers["X-Correlation-ID"] = correlation_id
    forward_headers["X-Forwarded-For"] = getattr(request.state, "client_ip", "127.0.0.1")
    forward_headers["X-Forwarded-Proto"] = request.url.scheme

    # Check if client explicitly requested no mock fallback
    disable_mock_fallback = request.headers.get("x-mock-fallback") == "false"

    target_url = f"{settings.UPSTREAM_API_URL.rstrip('/')}/v1/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body()

    # 5. Forward request to Layer 3 upstream
    try:
        async with httpx.AsyncClient(timeout=settings.UPSTREAM_TIMEOUT_SECONDS) as client:
            upstream_resp = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body,
            )

            # Build gateway response with rate-limit and correlation headers
            resp_headers = dict(upstream_resp.headers)
            for h in HOP_BY_HOP_HEADERS:
                resp_headers.pop(h, None)
            resp_headers["X-Correlation-ID"] = correlation_id
            resp_headers.update(rate_limit_headers)

            print(f"[GATEWAY PROXY] >> {request.method} /v1/{path} -> Forwarded to Layer 3 API -> HTTP {upstream_resp.status_code} ({len(upstream_resp.content)} bytes)", flush=True)

            return Response(
                content=upstream_resp.content,
                status_code=upstream_resp.status_code,
                headers=resp_headers,
                media_type=upstream_resp.headers.get("content-type"),
            )

    except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
        logger.warning(
            f"Upstream Layer 3 connection error ({target_url}): {exc}",
            extra={"correlation_id": correlation_id},
        )
        # Development fallback mode (strictly forbidden in production / staging)
        if settings.can_mock_upstream and not disable_mock_fallback:
            mock_payload = get_mock_data_for_resource(resource, request.method)
            resp_headers = {
                "X-Correlation-ID": correlation_id,
                "X-Gateway-Fallback": "mock-upstream-offline",
            }
            resp_headers.update(rate_limit_headers)
            return JSONResponse(content=mock_payload, status_code=200, headers=resp_headers)

        raise BadGatewayException(
            message=f"Upstream application API service is unreachable at {settings.UPSTREAM_API_URL}"
        )

    except httpx.ReadTimeout:
        logger.error(
            f"Upstream Layer 3 read timeout ({target_url}) after {settings.UPSTREAM_TIMEOUT_SECONDS}s",
            extra={"correlation_id": correlation_id},
        )
        raise GatewayTimeoutException(
            message=f"Upstream service timed out after {settings.UPSTREAM_TIMEOUT_SECONDS} seconds"
        )
