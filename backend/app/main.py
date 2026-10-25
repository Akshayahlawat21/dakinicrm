import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.core.config import settings
from backend.app.core.logging import get_logger
from backend.app.data.database import init_db, close_db, get_engine
from backend.app.data.models.base import Base
from backend.app.application.exceptions import ApplicationError
from backend.app.data.exceptions import DataLayerError, RecordNotFoundError, UniqueViolationError, ForeignKeyViolationError

# Import routes
from backend.app.api.routes import health, users, leads, deals, accounts, contacts, tasks, targets, dashboard, agent, campaigns

logger = get_logger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle."""
    logger.info("=" * 60)
    logger.info(f"Starting Dakini CRM - Layer 3 Application API (Port {settings.PORT})")
    logger.info(f"Environment:       {settings.ENVIRONMENT}")
    logger.info(f"Database dialect:  {'PostgreSQL (Supabase)' if settings.is_postgres else 'SQLite'}")
    logger.info("=" * 60)

    # Initialize Supabase PostgreSQL database connection
    engine = init_db()

    # NOTE: SQLite local mock auto-seeding is commented out per user request.
    # The application connects exclusively to live Supabase PostgreSQL.
    # if settings.is_sqlite:
    #     async with engine.begin() as conn:
    #         await conn.run_sync(Base.metadata.create_all)
    #     logger.info("Auto-created development tables in SQLite database.")
    #     import uuid
    #     from backend.app.data.database import get_session_factory
    #     from backend.app.data.models.organization import Organization
    #     from backend.app.data.models.user import User
    #     session_factory = get_session_factory()
    #     async with session_factory() as session:
    #         async with session.begin():
    #             ...
    #     logger.info("Auto-seeded development organizations and users (owner, manager, salespersons).")

    yield

    logger.info("Shutting down Dakini CRM - Layer 3 Application API.")
    await close_db()


app = FastAPI(
    title="Dakini CRM — Layer 3 Application API",
    description="Application Layer (Layer 3) providing multi-tenant CRM business services, permission governance, and Data Layer (Layer 6) integration.",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# --------------------------------------------------------------------------
# Global Exception Handlers (Normalized Gateway E8 Schema)
# --------------------------------------------------------------------------

@app.exception_handler(ApplicationError)
async def application_error_handler(request: Request, exc: ApplicationError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "correlation_id": cid,
                "details": exc.details,
            }
        },
    )


@app.exception_handler(RecordNotFoundError)
async def not_found_handler(request: Request, exc: RecordNotFoundError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "code": "NOT_FOUND",
                "message": exc.message,
                "correlation_id": cid,
            }
        },
    )


@app.exception_handler(UniqueViolationError)
async def unique_error_handler(request: Request, exc: UniqueViolationError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=409,
        content={
            "error": {
                "code": "CONFLICT",
                "message": exc.message,
                "correlation_id": cid,
            }
        },
    )


@app.exception_handler(ForeignKeyViolationError)
async def fk_error_handler(request: Request, exc: ForeignKeyViolationError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "FOREIGN_KEY_VIOLATION",
                "message": exc.message,
                "correlation_id": cid,
            }
        },
    )


@app.exception_handler(DataLayerError)
async def data_layer_error_handler(request: Request, exc: DataLayerError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "DATABASE_ERROR",
                "message": exc.message,
                "correlation_id": cid,
            }
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        500: "INTERNAL_SERVER_ERROR",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code_map.get(exc.status_code, f"HTTP_{exc.status_code}"),
                "message": str(exc.detail),
                "correlation_id": cid,
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation error",
                "correlation_id": cid,
                "details": exc.errors(),
            }
        },
    )


@app.exception_handler(Exception)
async def catchall_exception_handler(request: Request, exc: Exception):
    cid = getattr(request.state, "correlation_id", "req_unknown")
    logger.error(f"Unhandled error: {exc}", exc_info=True, extra={"correlation_id": cid})
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred",
                "correlation_id": cid,
            }
        },
    )

# --------------------------------------------------------------------------
# Middleware Chain
# --------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------
# Routers
# --------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(users.router)
app.include_router(leads.router)
app.include_router(deals.router)
app.include_router(accounts.router)
app.include_router(contacts.router)
app.include_router(tasks.router)
app.include_router(targets.router)
app.include_router(dashboard.router)
app.include_router(agent.router)
app.include_router(campaigns.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
