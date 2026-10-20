import logging
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from gateway.config import settings
from gateway.errors import create_error_response

logger = logging.getLogger("gateway.edge_shield")


class EdgeShieldMiddleware(BaseHTTPMiddleware):
    """
    E1: Edge shield validation.
    Ensures that when edge protection (Cloudflare/CDN/WAF) is enabled,
    direct requests to the origin are blocked with 403 Forbidden.
    Also ensures sensitive /v1 responses are never cached by intermediate proxies.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")

        # 1. Edge Shield bypass verification
        if settings.EDGE_SHIELD_ENABLED:
            edge_header = request.headers.get(settings.EDGE_SHIELD_HEADER_NAME.lower())
            if not edge_header or edge_header != settings.EDGE_SHIELD_SECRET:
                logger.warning(
                    f"Direct origin bypass blocked for {request.client.host if request.client else 'unknown'}",
                    extra={"correlation_id": correlation_id},
                )
                return create_error_response(
                    status_code=403,
                    code="EDGE_SHIELD_REQUIRED",
                    message="Direct origin access is forbidden. Requests must route through the configured CDN/WAF edge shield.",
                    correlation_id=correlation_id,
                )

        response = await call_next(request)

        # 2. Never cache authenticated /v1 API responses (E1 requirement)
        if request.url.path.startswith("/v1"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response
