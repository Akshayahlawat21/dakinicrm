from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.dashboard_service import DashboardService

router = APIRouter(tags=["Dashboard & Analytics"])


@router.get("/v1/dashboard")
@router.get("/v1/dashboard/metrics")
@router.get("/v1/dashboard/kpis")
@router.get("/v1/reports")
async def get_dashboard_kpis(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = DashboardService(session)
    kpis = await service.get_kpi_summary(ctx)
    kpis["correlation_id"] = ctx.correlation_id
    return {"status": "success", "data": kpis}
