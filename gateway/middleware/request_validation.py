from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from gateway.config import settings
from gateway.errors import create_error_response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    E6: Gateway request validation.
    Enforces maximum header size, payload size (stricter for non-upload routes),
    allowed HTTP methods, and Content-Type inspection for body-carrying requests.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")

        # 1. Method check (cheap reject)
        if request.method not in settings.ALLOWED_HTTP_METHODS:
            return create_error_response(
                status_code=405,
                code="METHOD_NOT_ALLOWED",
                message=f"HTTP method {request.method} is not supported by this gateway",
                correlation_id=correlation_id,
            )

        # 2. Header size check
        total_header_size = sum(len(k) + len(v) for k, v in request.headers.items())
        if total_header_size > settings.MAX_HEADER_SIZE_BYTES:
            return create_error_response(
                status_code=400,
                code="HEADER_SIZE_EXCEEDED",
                message="Request headers exceed maximum allowable size limit",
                correlation_id=correlation_id,
            )

        # 3. Payload size check
        path = request.url.path.lower()
        content_type = request.headers.get("content-type", "").lower()
        is_upload_route = "upload" in path or content_type.startswith("multipart/form-data")
        max_allowed_body = settings.MAX_UPLOAD_SIZE_BYTES if is_upload_route else settings.MAX_BODY_SIZE_BYTES

        content_length_str = request.headers.get("content-length")
        if content_length_str:
            try:
                content_length = int(content_length_str)
                if content_length > max_allowed_body:
                    return create_error_response(
                        status_code=413,
                        code="PAYLOAD_TOO_LARGE",
                        message=f"Request body exceeds size limit ({max_allowed_body} bytes)",
                        correlation_id=correlation_id,
                    )
            except ValueError:
                return create_error_response(
                    status_code=400,
                    code="INVALID_CONTENT_LENGTH",
                    message="Malformed Content-Length header",
                    correlation_id=correlation_id,
                )

        # 4. Content-Type check on POST/PUT/PATCH when body is present
        if request.method in ("POST", "PUT", "PATCH"):
            has_body = (content_length_str and int(content_length_str) > 0) or request.headers.get("transfer-encoding") == "chunked"
            if has_body:
                # Allowed content types: application/json or multipart/form-data for uploads
                is_json = content_type.startswith("application/json")
                is_multipart = content_type.startswith("multipart/form-data")
                is_form = content_type.startswith("application/x-www-form-urlencoded") and "webhook" in path

                if not (is_json or (is_upload_route and is_multipart) or is_form):
                    return create_error_response(
                        status_code=415,
                        code="UNSUPPORTED_MEDIA_TYPE",
                        message="Unsupported Media Type: Request body must be application/json",
                        correlation_id=correlation_id,
                    )

        # 5. Security headers on response (E2 TLS / HSTS / Clickjacking / Sniffing)
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response
