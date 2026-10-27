import logging
import ssl
from collections.abc import AsyncIterator
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from app.config import get_settings

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None

def _normalize_url(url: str) -> str:
    try:
        u = make_url(url)
        if u.drivername.startswith("sqlite"):
            return url
        if u.drivername in ("postgres", "postgresql", "postgresql+psycopg", "postgresql+psycopg2", "postgresql+asyncpg"):
            driver = "postgresql+asyncpg"
        else:
            driver = u.drivername
        query = dict(u.query)
        query.pop("sslmode", None)
        port = u.port
        if u.host and "pooler.supabase.com" in u.host and port == 5432:
            port = 6543
        return u.set(drivername=driver, port=port, query=query).render_as_string(hide_password=False)
    except Exception:
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url[len("postgresql://"):]
        if url.startswith("postgresql+psycopg://"):
            return "postgresql+asyncpg://" + url[len("postgresql+psycopg://"):]
        return url

def _get_connect_args(url: str) -> dict:
    connect_args = {
        "command_timeout": 15,
        "server_settings": {"application_name": "dakini-layer9-analytics"},
    }
    try:
        u = make_url(url)
        if u.drivername.startswith("sqlite"):
            return {}
        if u.host and "pooler.supabase.com" in u.host:
            connect_args["statement_cache_size"] = 0
            connect_args["prepared_statement_cache_size"] = 0
        if "supabase.com" in (u.host or "") or "ssl" in u.query or "sslmode" in u.query:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx
    except Exception:
        pass
    return connect_args

def get_engine() -> AsyncEngine:
    global _engine
    cfg = get_settings()
    if not cfg.database_url:
        raise RuntimeError("DATABASE_URL is required")
    if _engine is None:
        normalized_url = _normalize_url(cfg.database_url)
        connect_args = _get_connect_args(cfg.database_url)
        engine_kwargs = {
            "pool_pre_ping": True,
            "connect_args": connect_args,
        }
        if not normalized_url.startswith("sqlite"):
            engine_kwargs.update({
                "pool_size": cfg.pool_size,
                "max_overflow": cfg.max_overflow,
                "pool_timeout": cfg.pool_timeout,
            })
        _engine = create_async_engine(normalized_url, **engine_kwargs)
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
