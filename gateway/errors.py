from typing import Optional, Dict, Any
from fastapi import Request, status
from fastapi.responses import JSONResponse


class GatewayException(Exception):
    """Base exception for all Layer 2 Gateway errors with normalized response schema."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers or {}
        super().__init__(message)


class BadRequestException(GatewayException):
    def __init__(self, message: str = "Bad Request", code: str = "BAD_REQUEST"):
        super().__init__(status.HTTP_400_BAD_REQUEST, code, message)


class UnauthorizedException(GatewayException):
    def __init__(self, message: str = "Unauthorized: Missing or invalid token", code: str = "UNAUTHORIZED"):
        super().__init__(
            status.HTTP_401_UNAUTHORIZED,
            code,
            message,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(GatewayException):
    def __init__(self, message: str = "Forbidden", code: str = "FORBIDDEN"):
        super().__init__(status.HTTP_403_FORBIDDEN, code, message)


class NotFoundException(GatewayException):
    def __init__(self, message: str = "Endpoint not found", code: str = "NOT_FOUND"):
        super().__init__(status.HTTP_404_NOT_FOUND, code, message)


class MethodNotAllowedException(GatewayException):
    def __init__(self, message: str = "Method Not Allowed", code: str = "METHOD_NOT_ALLOWED"):
        super().__init__(status.HTTP_405_METHOD_NOT_ALLOWED, code, message)


class GoneException(GatewayException):
    def __init__(self, message: str = "API version or resource has been permanently retired", code: str = "GONE"):
        super().__init__(status.HTTP_410_GONE, code, message)


class PayloadTooLargeException(GatewayException):
    def __init__(self, message: str = "Request payload exceeds size limit", code: str = "PAYLOAD_TOO_LARGE"):
        super().__init__(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, code, message)


class UnsupportedMediaTypeException(GatewayException):
    def __init__(self, message: str = "Unsupported Media Type. Expected application/json", code: str = "UNSUPPORTED_MEDIA_TYPE"):
        super().__init__(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, code, message)


class RateLimitedException(GatewayException):
    def __init__(self, retry_after: int = 60, message: str = "Rate limit exceeded. Please retry later.", code: str = "RATE_LIMITED"):
        super().__init__(
            status.HTTP_429_TOO_MANY_REQUESTS,
            code,
            message,
            headers={"Retry-After": str(retry_after)},
        )
        self.retry_after = retry_after


class BadGatewayException(GatewayException):
    def __init__(self, message: str = "Bad Gateway: Upstream service unavailable or returned an invalid response", code: str = "BAD_GATEWAY"):
        super().__init__(status.HTTP_502_BAD_GATEWAY, code, message)


class ServiceUnavailableException(GatewayException):
    def __init__(self, message: str = "Service Unavailable: Upstream service is temporarily down", code: str = "SERVICE_UNAVAILABLE"):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, code, message)


class GatewayTimeoutException(GatewayException):
    def __init__(self, message: str = "Gateway Timeout: Upstream service did not respond in time", code: str = "GATEWAY_TIMEOUT"):
        super().__init__(status.HTTP_504_GATEWAY_TIMEOUT, code, message)


def build_error_envelope(code: str, message: str, correlation_id: str) -> Dict[str, Any]:
    """Build standard E8 error response envelope."""
    return {
        "error": {
            "code": code,
            "message": message,
            "correlation_id": correlation_id,
        }
    }


def create_error_response(
    status_code: int,
    code: str,
    message: str,
    correlation_id: str,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Create normalized JSON error response with correlation ID header."""
    response_headers = headers.copy() if headers else {}
    response_headers["X-Correlation-ID"] = correlation_id
    response_headers["X-Request-ID"] = correlation_id

    content = build_error_envelope(code, message, correlation_id)
    return JSONResponse(status_code=status_code, content=content, headers=response_headers)
