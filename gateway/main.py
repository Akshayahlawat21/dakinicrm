import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from gateway.config import settings
from gateway.errors import GatewayException, create_error_response
from gateway.middleware.correlation import CorrelationLoggingMiddleware
from gateway.middleware.edge_shield import EdgeShieldMiddleware
from gateway.middleware.request_validation import RequestValidationMiddleware
from gateway.routers import health, auth, webhooks, analytics, proxy

logger = logging.getLogger("gateway.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle management."""
    logger.info("=" * 60)
    logger.info("Starting Dakini CRM - Layer 2 (Edge / API Gateway)")
    logger.info(f"Environment:       {settings.ENVIRONMENT}")
    logger.info(f"Listen Address:    {settings.HOST}:{settings.PORT}")
    logger.info(f"Upstream Layer 3:  {settings.UPSTREAM_API_URL}")
    logger.info(f"Edge Shield:       {'ENABLED' if settings.EDGE_SHIELD_ENABLED else 'DISABLED (Local Dev)'}")
    logger.info(f"Rate Limiting:     {'ENABLED' if settings.RATE_LIMIT_ENABLED else 'DISABLED'} (store={settings.REDIS_URL or 'in-memory'})")
    logger.info(f"Allowed CORS:      {settings.CORS_ALLOWED_ORIGINS}")
    logger.info(f"Mock Upstream:     {'ALLOWED (Dev)' if settings.can_mock_upstream else 'DISABLED'}")
    logger.info("=" * 60)

    # Enforce security constraints if in production mode
    settings.validate_production_security()
    yield
    logger.info("Shutting down Dakini CRM - Layer 2 Gateway.")


app = FastAPI(
    title="Dakini CRM - Layer 2 Edge / API Gateway",
    description="Edge / API Gateway implementing LLD Modules E1-E8: Edge Shield, TLS Termination Compatibility, Versioned Routing, Token Validation, Rate Limiting, Request Validation, Correlation Tracing, and Normalized Error Handling.",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --------------------------------------------------------------------------
# E8: Global Exception Handlers (Normalized JSON Envelopes)
# --------------------------------------------------------------------------

@app.exception_handler(GatewayException)
async def gateway_exception_handler(request: Request, exc: GatewayException):
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")
    print(f"\n[GATEWAY REJECT] >> {request.method} {request.url.path} -> {exc.code}: {exc.message}", flush=True)
    return create_error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        correlation_id=correlation_id,
        headers=exc.headers,
    )



@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        429: "RATE_LIMITED",
        500: "INTERNAL_SERVER_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
        504: "GATEWAY_TIMEOUT",
    }
    code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    return create_error_response(
        status_code=exc.status_code,
        code=code,
        message=str(exc.detail),
        correlation_id=correlation_id,
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")
    return create_error_response(
        status_code=400,
        code="VALIDATION_ERROR",
        message="Request validation failed. Ensure required fields and formats are valid.",
        correlation_id=correlation_id,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", "req_unknown")
    logger.error(
        f"Unhandled server error: {exc}",
        exc_info=True,
        extra={"correlation_id": correlation_id},
    )
    return create_error_response(
        status_code=500,
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected internal gateway error occurred",
        correlation_id=correlation_id,
    )


# --------------------------------------------------------------------------
# Middleware Chain (Execution order: outer to inner)
# 1. CORS
# 2. E7 Correlation & Safe Logging
# 3. E1 Edge Shield Check
# 4. E6 Request Validation (Size, Method, Content-Type)
# --------------------------------------------------------------------------

app.add_middleware(RequestValidationMiddleware)
app.add_middleware(EdgeShieldMiddleware)
app.add_middleware(CorrelationLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Correlation-ID",
        "X-Request-ID",
        "X-Edge-Secret",
        "X-Mock-Fallback",
        "If-None-Match",
    ],
    expose_headers=[
        "X-Correlation-ID",
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "Retry-After",
        "Deprecation",
        "Sunset",
    ],
)

# --------------------------------------------------------------------------
# Routers (Order matters: public and health before generic proxy catch-all)
# --------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(webhooks.router)
app.include_router(analytics.router)
app.include_router(proxy.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gateway.main:app", host=settings.HOST, port=settings.PORT, reload=True)
