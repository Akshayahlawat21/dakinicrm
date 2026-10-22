import uuid
from typing import Generic, TypeVar, Type, Optional, List, Any, Dict
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from backend.app.data.models.base import Base, SoftDeleteMixin
from backend.app.data.exceptions import (
    RecordNotFoundError,
    UniqueViolationError,
    ForeignKeyViolationError,
    TenantIsolationViolationError,
    DataLayerError,
)

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Abstract base repository providing tenant-scoped persistence operations.
    All tenant-owned queries enforce `organization_id == tenant_id`.
    Never fetches by ID alone.
    """

    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    def _parse_uuid(self, val: str | uuid.UUID | None) -> uuid.UUID | None:
        if val is None:
            return None
        if isinstance(val, uuid.UUID):
            return val
        try:
            return uuid.UUID(str(val))
        except (ValueError, TypeError):
            # Deterministic namespace UUID for string IDs like 'tenant_enterprise_01'
            return uuid.uuid5(uuid.NAMESPACE_DNS, str(val))

    async def get_by_id_scoped(
        self, record_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> ModelType:
        """
        Retrieves a record scoped to tenant_id.
        Raises RecordNotFoundError if record does not exist or belongs to another tenant.
        """
        rec_uuid = self._parse_uuid(record_id)
        tenant_uuid = self._parse_uuid(tenant_id)

        stmt = select(self.model).where(
            self.model.id == rec_uuid,
            getattr(self.model, "organization_id") == tenant_uuid,
        )

        if issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))

        result = await self.session.execute(stmt)
        record = result.scalar_one_or_none()

        if record is None:
            raise RecordNotFoundError(self.model.__name__, str(record_id))

        return record

    async def list_scoped(
        self,
        tenant_id: str | uuid.UUID,
        skip: int = 0,
        limit: int = 50,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Any = None,
    ) -> tuple[List[ModelType], int]:
        """
        Lists tenant-scoped records with optional filters, pagination, and sorting.
        Returns (records, total_count).
        """
        tenant_uuid = self._parse_uuid(tenant_id)
        base_filter = [getattr(self.model, "organization_id") == tenant_uuid]

        if issubclass(self.model, SoftDeleteMixin):
            base_filter.append(self.model.deleted_at.is_(None))

        if filters:
            for field, val in filters.items():
                if hasattr(self.model, field) and val is not None:
                    base_filter.append(getattr(self.model, field) == val)

        # Count total
        count_stmt = select(func.count(self.model.id)).where(*base_filter)
        count_res = await self.session.execute(count_stmt)
        total = count_res.scalar_one()

        # Query records
        stmt = select(self.model).where(*base_filter)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        else:
            if hasattr(self.model, "created_at"):
                stmt = stmt.order_by(getattr(self.model, "created_at").desc())

        stmt = stmt.offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        records = list(result.scalars().all())

        return records, total

    async def create(self, entity: ModelType, tenant_id: str | uuid.UUID) -> ModelType:
        """
        Persists a new tenant entity.
        Enforces organization_id matching trusted tenant_id.
        """
        tenant_uuid = self._parse_uuid(tenant_id)
        if hasattr(entity, "organization_id"):
            setattr(entity, "organization_id", tenant_uuid)

        try:
            self.session.add(entity)
            await self.session.flush()
            return entity
        except IntegrityError as exc:
            self._handle_integrity_error(exc)

    async def update_scoped(
        self,
        record_id: str | uuid.UUID,
        tenant_id: str | uuid.UUID,
        update_data: Dict[str, Any],
    ) -> ModelType:
        """
        Updates permitted fields on a tenant-scoped record.
        Prevents updating id or organization_id.
        """
        record = await self.get_by_id_scoped(record_id, tenant_id)

        # Disallow tampering with immutable identity/tenant keys
        update_data.pop("id", None)
        update_data.pop("organization_id", None)
        update_data.pop("created_at", None)

        for key, val in update_data.items():
            if hasattr(record, key):
                setattr(record, key, val)

        try:
            await self.session.flush()
            return record
        except IntegrityError as exc:
            self._handle_integrity_error(exc)

    async def delete_scoped(
        self,
        record_id: str | uuid.UUID,
        tenant_id: str | uuid.UUID,
        soft_delete: bool = True,
    ) -> bool:
        """
        Deletes or soft-deletes a tenant record.
        """
        record = await self.get_by_id_scoped(record_id, tenant_id)

        if soft_delete and issubclass(self.model, SoftDeleteMixin):
            from datetime import datetime, timezone
            setattr(record, "deleted_at", datetime.now(timezone.utc))
            await self.session.flush()
            return True
        else:
            await self.session.delete(record)
            await self.session.flush()
            return True

    def _handle_integrity_error(self, exc: IntegrityError) -> None:
        err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
        err_lower = err_msg.lower()
        if "unique" in err_lower or "duplicate key" in err_lower:
            raise UniqueViolationError(f"Duplicate record violation: {err_msg}") from exc
        if "foreign key" in err_lower:
            raise ForeignKeyViolationError(f"Foreign key constraint violation: {err_msg}") from exc
        raise DataLayerError(f"Database constraint error: {err_msg}") from exc
