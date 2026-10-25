import uuid
from datetime import date
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ForbiddenError, ConflictError, NotFoundError
from backend.app.data.models.target import SalesTarget
from backend.app.data.repositories.target_repository import SalesTargetRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class SalesTargetService:
    """
    Dedicated Sales Target & Quota Service.
    Enforces amount validation (> 0), valid period dates, duplicate-period prevention,
    hierarchy rules (Owner -> Manager/Salesperson, Manager -> Team Salesperson),
    and audit tracking.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.target_repo = SalesTargetRepository(session)
        self.user_repo = UserRepository(session)
        self.team_repo = TeamRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def set_sales_target(
        self,
        ctx: RequestContext,
        assigned_to_user_id: str | uuid.UUID,
        target_amount: float,
        period_start: date,
        period_end: date,
        period_type: str = "monthly",
        currency: str = "USD",
        team_id: Optional[str | uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> SalesTarget:
        # Validate business rules
        if target_amount <= 0:
            raise BadRequestError("Sales target amount must be strictly greater than 0")

        if period_end < period_start:
            raise BadRequestError("Period end date cannot precede period start date")

        # Load target user
        try:
            target_user = await self.user_repo.get_by_id_scoped(assigned_to_user_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Target user '{assigned_to_user_id}' was not found in this organization")

        # Check team membership for managers
        is_in_team = False
        if ctx.is_manager and ctx.team_id:
            is_in_team = await self.team_repo.is_user_in_team(
                user_id=target_user.id, team_id=ctx.team_id, tenant_id=ctx.tenant_id
            )

        # Enforce role hierarchy permissions
        PermissionService.check_can_manage_sales_target(
            ctx=ctx, target_user=target_user, is_in_manager_team=is_in_team
        )

        # Check duplicate target in same period
        existing = await self.target_repo.find_existing_target(
            user_id=target_user.id,
            period_start=period_start,
            period_end=period_end,
            tenant_id=ctx.tenant_id,
        )
        if existing:
            raise ConflictError(
                f"An active sales target already exists for user '{target_user.name}' in this period"
            )

        target = SalesTarget(
            organization_id=ctx.tenant_uuid,
            assigned_to_user_id=target_user.id,
            assigned_by_user_id=ctx.user_uuid,
            team_id=uuid.UUID(str(team_id)) if team_id else None,
            period_type=period_type,
            period_start=period_start,
            period_end=period_end,
            target_amount=target_amount,
            currency=currency,
            status="active",
            notes=notes,
        )
        created = await self.target_repo.create(target, ctx.tenant_id)

        # Audit log entry
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="SET_TARGET",
            resource_type="sales_target",
            resource_id=created.id,
            new_values={
                "assigned_to": str(target_user.id),
                "amount": target_amount,
                "period_start": str(period_start),
                "period_end": str(period_end),
            },
        )
        return created

    async def get_my_targets(self, ctx: RequestContext) -> List[SalesTarget]:
        """Returns all targets assigned to the calling user."""
        return await self.target_repo.list_by_user(ctx.user_id, ctx.tenant_id)

    async def list_targets(
        self, ctx: RequestContext, skip: int = 0, limit: int = 50
    ) -> tuple[List[SalesTarget], int]:
        filters = {}
        if ctx.is_salesperson:
            # Salespersons can only view their own targets
            filters["assigned_to_user_id"] = ctx.user_uuid

        return await self.target_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
        )
