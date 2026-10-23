from collections.abc import AsyncIterator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None

def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url

def get_engine() -> AsyncEngine:
    global _engine
    cfg = get_settings()
    if not cfg.database_url:
        raise RuntimeError("DATABASE_URL is required")
    if _engine is None:
        _engine = create_async_engine(
            _normalize_url(cfg.database_url),
            pool_size=cfg.pool_size,
            max_overflow=cfg.max_overflow,
            pool_timeout=cfg.pool_timeout,
            pool_pre_ping=True,
            connect_args={"command_timeout": 15, "server_settings": {"application_name": "dakini-layer9-analytics"}},
        )
    return _engine

async def get_connection() -> AsyncIterator:
    async with get_engine().connect() as conn:
        yield conn

async def database_ready() -> bool:
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Database health check failed")
        return False

async def dispose_engine() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None
