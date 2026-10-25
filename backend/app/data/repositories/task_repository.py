import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.activity import Activity
from backend.app.data.repositories.base import BaseRepository
from backend.app.data.exceptions import RecordNotFoundError


class TaskRepository(BaseRepository[Activity]):
    """
    Tenant-scoped task repository.
    Operates on `activities` table where type='task'.
    """

    def __init__(self, session: AsyncSession):
        super().__init__(Activity, session)

    async def get_by_id_scoped(
        self, record_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> Activity:
        rec_uuid = self._parse_uuid(record_id)
        tenant_uuid = self._parse_uuid(tenant_id)

        stmt = select(Activity).where(
            Activity.id == rec_uuid,
            Activity.organization_id == tenant_uuid,
            Activity.type == "task",
        )
        res = await self.session.execute(stmt)
        record = res.scalar_one_or_none()
        if not record:
            raise RecordNotFoundError("Task", str(record_id))
        return record

    async def list_scoped(
        self,
        tenant_id: str | uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Any = None,
    ) -> tuple[List[Activity], int]:
        tenant_uuid = self._parse_uuid(tenant_id)
        base_filter = [
            Activity.organization_id == tenant_uuid,
            Activity.type == "task",
        ]

        if filters:
            for field, val in filters.items():
                if hasattr(Activity, field) and val is not None:
                    base_filter.append(getattr(Activity, field) == val)

        count_stmt = select(func.count(Activity.id)).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        stmt = select(Activity).where(*base_filter)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        else:
            stmt = stmt.order_by(Activity.created_at.desc())

        stmt = stmt.offset(skip).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def create_task(
        self,
        tenant_id: str | uuid.UUID,
        subject: str,
        assigned_user_id: str | uuid.UUID,
        description: Optional[str] = None,
        priority: str = "medium",
        start_at: Optional[Any] = None,
        account_id: Optional[str | uuid.UUID] = None,
        contact_id: Optional[str | uuid.UUID] = None,
        opportunity_id: Optional[str | uuid.UUID] = None,
    ) -> Activity:
        task = Activity(
            organization_id=self._parse_uuid(tenant_id),
            user_id=self._parse_uuid(assigned_user_id),
            type="task",
            subject=subject,
            description=description,
            priority=priority,
            status="scheduled",
            start_at=start_at,
            account_id=self._parse_uuid(account_id),
            contact_id=self._parse_uuid(contact_id),
            opportunity_id=self._parse_uuid(opportunity_id),
        )
        return await self.create(task, tenant_id)
