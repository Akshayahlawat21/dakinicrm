import uuid
from typing import Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.data.models.lead import Lead
from backend.app.data.models.deal import Deal
from backend.app.data.models.activity import Activity
from backend.app.data.models.target import SalesTarget


class DashboardService:
    """Dashboard and KPI aggregation service with tenant and role scoping."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_kpi_summary(self, ctx: RequestContext) -> Dict[str, Any]:
        tenant_uuid = ctx.tenant_uuid

        # 1. Total Leads
        lead_stmt = select(func.count(Lead.id)).where(
            Lead.organization_id == tenant_uuid,
            Lead.deleted_at.is_(None),
        )
        if ctx.is_salesperson:
            lead_stmt = lead_stmt.where(Lead.assigned_to == ctx.user_uuid)
        lead_count = (await self.session.execute(lead_stmt)).scalar_one()

        # 2. Deals and Pipeline
        deal_stmt = select(
            func.count(Deal.id),
            func.sum(Deal.amount),
        ).where(
            Deal.organization_id == tenant_uuid,
            Deal.stage != "Lost",
            Deal.deleted_at.is_(None),
        )
        deal_count, pipeline_val = (await self.session.execute(deal_stmt)).one()

        won_stmt = select(func.sum(Deal.amount)).where(
            Deal.organization_id == tenant_uuid,
            Deal.stage == "Won",
            Deal.deleted_at.is_(None),
        )
        won_val = (await self.session.execute(won_stmt)).scalar_one_or_none() or 0.0

        # 3. Tasks
        task_stmt = select(func.count(Activity.id)).where(
            Activity.organization_id == tenant_uuid,
            Activity.type == "task",
            Activity.status != "completed",
        )
        if ctx.is_salesperson:
            task_stmt = task_stmt.where(Activity.user_id == ctx.user_uuid)
        task_count = (await self.session.execute(task_stmt)).scalar_one()

        # 4. Target & Quota
        target_stmt = select(func.sum(SalesTarget.target_amount)).where(
            SalesTarget.organization_id == tenant_uuid,
            SalesTarget.status == "active",
        )
        if ctx.is_salesperson:
            target_stmt = target_stmt.where(SalesTarget.assigned_to_user_id == ctx.user_uuid)
        total_target = (await self.session.execute(target_stmt)).scalar_one_or_none() or 0.0

        quota_attainment = 0.0
        if total_target > 0:
            quota_attainment = round((float(won_val) / float(total_target)) * 100, 1)

        return {
            "tenant_id": str(ctx.tenant_id),
            "total_leads": lead_count,
            "active_deals_count": deal_count or 0,
            "pipeline_value": float(pipeline_val or 0.0),
            "won_revenue": float(won_val),
            "pending_tasks": task_count,
            "total_quota": float(total_target),
            "quota_attainment_percent": quota_attainment,
        }
