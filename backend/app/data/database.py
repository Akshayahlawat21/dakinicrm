import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy import event
from sqlalchemy.pool import QueuePool, NullPool, StaticPool
from backend.app.core.config import settings
from backend.app.data.exceptions import DatabaseConnectionError

logger = logging.getLogger("backend.data.database")

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine_args(database_url: str) -> dict:
    """Builds appropriate engine configuration arguments based on dialect."""
    args = {
        "echo": settings.DEBUG,
        "future": True,
    }

    if "sqlite" in database_url.lower():
        if ":memory:" in database_url.lower():
            args["poolclass"] = StaticPool
            args["connect_args"] = {"check_same_thread": False}
        else:
            args["poolclass"] = NullPool
            args["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL / Supabase
        args["poolclass"] = QueuePool
        args["pool_size"] = settings.DB_POOL_SIZE
        args["max_overflow"] = settings.DB_MAX_OVERFLOW
        args["pool_timeout"] = settings.DB_POOL_TIMEOUT
        args["pool_recycle"] = settings.DB_POOL_RECYCLE
        args["pool_pre_ping"] = True
        
        # Statement timeout in connect_args for psycopg
        if "psycopg" in database_url.lower():
            args["connect_args"] = {
                "options": f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS}"
            }

    return args


def init_db(database_url: str | None = None) -> AsyncEngine:
    """Initializes the database engine and session maker."""
    global _engine, _session_factory
    url = database_url or settings.DATABASE_URL

    logger.info(f"Initializing database connection: {url.split('@')[-1] if '@' in url else url}")

    try:
        engine_args = get_engine_args(url)
        _engine = create_async_engine(url, **engine_args)

        # Enable foreign keys for SQLite
        if "sqlite" in url.lower():
            @event.listens_for(_engine.sync_engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        _session_factory = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
        return _engine

    except Exception as exc:
        logger.error(f"Failed to initialize database engine: {exc}", exc_info=True)
        raise DatabaseConnectionError(f"Database initialization failed: {exc}")


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        return init_db()
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        init_db()
    return _session_factory


async def close_db() -> None:
    """Closes database engine and releases connection pools."""
    global _engine, _session_factory
    if _engine is not None:
        logger.info("Disposing database connection pool.")
        await _engine.dispose()
        _engine = None
        _session_factory = None
