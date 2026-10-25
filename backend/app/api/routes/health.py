from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.app.data.session import get_db_session
from backend.app.core.config import settings

router = APIRouter(tags=["Health & Telemetry"])


@router.get("/health")
@router.get("/v1/health")
async def health_check(session: AsyncSession = Depends(get_db_session)):
    """Health check probe verifying Layer 3 application and database readiness."""
    db_status = "healthy"
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {str(exc)}"

    return {
        "status": "healthy" if "healthy" == db_status else "degraded",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
