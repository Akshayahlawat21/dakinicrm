import logging
from typing import AsyncGenerator, Optional
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.data.database import get_session_factory
from backend.app.data.exceptions import (
    DataLayerError,
    UniqueViolationError,
    ForeignKeyViolationError,
    TenantIsolationViolationError,
)

logger = logging.getLogger("backend.data.transactions")


class UnitOfWork:
    """
    Unit of Work & Transaction Manager.
    Guarantees atomic multi-record operations, automatic rollback on error,
    and enforces PostgreSQL transaction-local tenant context (`SET LOCAL app.current_tenant`).
    """

    def __init__(self, tenant_id: str, session: Optional[AsyncSession] = None):
        self.tenant_id = str(tenant_id)
        self._external_session = session
        self.session: Optional[AsyncSession] = session

    async def __aenter__(self) -> "UnitOfWork":
        if self._external_session is None:
            factory = get_session_factory()
            self.session = factory()
        
        # Start transaction block if not already inside one
        if not self.session.in_transaction():
            await self.session.begin()

        # Enforce transaction-local tenant isolation for PostgreSQL RLS
        if settings.is_postgres and settings.DB_ENABLE_RLS and self.tenant_id:
            try:
                # SET LOCAL ensures tenant scope exists only for this transaction and never leaks in pool
                await self.session.execute(
                    text("SET LOCAL app.current_tenant = :tenant_id"),
                    {"tenant_id": self.tenant_id},
                )
            except Exception as exc:
                logger.warning(f"Could not apply SET LOCAL app.current_tenant: {exc}")

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                logger.warning(f"Transaction failed with {exc_type.__name__}: {exc_val}. Rolling back.")
                await self.rollback()
                self._translate_database_error(exc_val)
            else:
                await self.commit()
        finally:
            if self._external_session is None and self.session is not None:
                await self.session.close()

    async def commit(self) -> None:
        """Commits the active transaction."""
        if self.session and self.session.in_transaction():
            try:
                await self.session.commit()
            except IntegrityError as exc:
                await self.session.rollback()
                self._translate_database_error(exc)

    async def rollback(self) -> None:
        """Rolls back the active transaction."""
        if self.session and self.session.in_transaction():
            await self.session.rollback()

    def _translate_database_error(self, exc: Exception) -> None:
        """Maps SQLAlchemy DBAPI errors to domain data layer exceptions."""
        if isinstance(exc, IntegrityError):
            err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
            err_lower = err_msg.lower()
            if "unique" in err_lower or "duplicate key" in err_lower:
                raise UniqueViolationError(
                    f"A record with this unique field already exists: {err_msg}",
                    details={"raw_error": err_msg}
                ) from exc
            if "foreign key" in err_lower:
                raise ForeignKeyViolationError(
                    f"Referenced foreign record does not exist or belongs to another tenant: {err_msg}",
                    details={"raw_error": err_msg}
                ) from exc
        # Other exceptions pass through or re-raise as DataLayerError
        if not isinstance(exc, DataLayerError):
            raise DataLayerError(f"Database operation failed: {exc}") from exc


@asynccontextmanager
async def transactional_uow(tenant_id: str, session: Optional[AsyncSession] = None) -> AsyncGenerator[UnitOfWork, None]:
    """Helper context manager for UnitOfWork transactions."""
    uow = UnitOfWork(tenant_id=tenant_id, session=session)
    async with uow:
        yield uow
