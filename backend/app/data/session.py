from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.database import get_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding request-scoped AsyncSession."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
