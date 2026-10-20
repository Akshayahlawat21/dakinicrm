import logging
import re
import time
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class CorrelationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "-"
        return True


# Configure safe logger
logger = logging.getLogger("gateway.access")
handler = logging.StreamHandler()
handler.addFilter(CorrelationFilter())
handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] [cid=%(correlation_id)s] %(message)s")
)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
# Ensure filter is applied across root handlers
for h in root_logger.handlers:
    h.addFilter(CorrelationFilter())
if not root_logger.handlers:
    root_logger.addHandler(handler)

# Correlation ID pattern: 1-64 chars, alphanumeric, hyphens, underscores
CORRELATION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")

# Sensitive headers to redact from logs
SENSITIVE_HEADERS = {
    "authorization",
    "proxy-authorization",
    "x-api-key",
    "cookie",
    "set-cookie",
    "x-edge-secret",
}

# Sensitive query params to redact
SENSITIVE_QUERY_PARAMS = {
    "token",
    "key",
    "secret",
    "password",
    "signature",
    "sig",
}


def sanitize_url(url_path: str, query_string: str) -> str:
    """Safely redact sensitive parameters from URLs."""
    if not query_string:
        return url_path
    pairs = query_string.split("&")
    clean_pairs = []
    for pair in pairs:
        if "=" in pair:
            k, _ = pair.split("=", 1)
            if k.lower() in SENSITIVE_QUERY_PARAMS:
                clean_pairs.append(f"{k}=[REDACTED]")
            else:
                clean_pairs.append(pair)
        else:
            clean_pairs.append(pair)
    return f"{url_path}?{'&'.join(clean_pairs)}"


def get_client_ip(request: Request) -> str:
    """Extract real client IP handling Cloudflare and reverse-proxy headers."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class CorrelationLoggingMiddleware(BaseHTTPMiddleware):
    """
    E7: Correlation ID injection, header validation, and safe access logging.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        # 1. Accept or generate correlation ID
        incoming_id = request.headers.get("x-correlation-id") or request.headers.get("x-request-id")
        if incoming_id and CORRELATION_ID_PATTERN.match(incoming_id):
            correlation_id = incoming_id
        else:
            correlation_id = f"req_{uuid.uuid4().hex}"

        request.state.correlation_id = correlation_id
        request.state.client_ip = get_client_ip(request)

        clean_path = sanitize_url(request.url.path, request.url.query)
        client_ip = request.state.client_ip

        # Extra dict for logger format
        log_extra = {"correlation_id": correlation_id}

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"{request.method} {clean_path} - 500 Internal Error in {duration_ms}ms (client={client_ip}) - error={str(exc)}",
                extra=log_extra,
            )
            raise exc

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 2. Attach correlation headers to outgoing response
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Request-ID"] = correlation_id

        # 3. Structured safe access log
        status_code = response.status_code
        if status_code >= 500:
            logger.error(
                f"{request.method} {clean_path} - {status_code} in {duration_ms}ms (client={client_ip})",
                extra=log_extra,
            )
        elif status_code == 429:
            logger.warning(
                f"{request.method} {clean_path} - 429 Rate Limited in {duration_ms}ms (client={client_ip})",
                extra=log_extra,
            )
        elif status_code >= 400:
            logger.warning(
                f"{request.method} {clean_path} - {status_code} in {duration_ms}ms (client={client_ip})",
                extra=log_extra,
            )
        else:
            logger.info(
                f"{request.method} {clean_path} - {status_code} in {duration_ms}ms (client={client_ip})",
                extra=log_extra,
            )

        return response
