import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.audit import AuditLog, OutboxEvent
from backend.app.data.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    """Tenant-scoped append-only audit repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)

    async def record_event(
        self,
        tenant_id: str | uuid.UUID,
        user_id: Optional[str | uuid.UUID],
        action: str,
        resource_type: str,
        resource_id: str | uuid.UUID,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
    ) -> Optional[AuditLog]:
        """Records an append-only audit trail record safely without breaking caller transaction."""
        try:
            org_uuid = self._parse_uuid(tenant_id)
            u_uuid = None
            if user_id:
                try:
                    cand_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
                    from backend.app.data.models.user import User
                    user_row = await self.session.get(User, cand_uuid)
                    if user_row:
                        u_uuid = cand_uuid
                except Exception:
                    u_uuid = None

            r_uuid = self._parse_uuid(resource_id)

            entry = AuditLog(
                organization_id=org_uuid,
                user_id=u_uuid,
                action=action.upper(),
                resource_type=resource_type.lower(),
                resource_id=r_uuid,
                old_values=old_values,
                new_values=new_values,
            )
            self.session.add(entry)
            await self.session.flush()
            return entry
        except Exception:
            # Audit logging must NEVER fail the primary business operation
            return None


    async def record_outbox_event(
        self,
        tenant_id: str | uuid.UUID,
        event_type: str,
        payload: Dict[str, Any],
    ) -> OutboxEvent:
        """Writes domain event into transactional outbox."""
        org_uuid = self._parse_uuid(tenant_id)
        outbox = OutboxEvent(
            organization_id=org_uuid,
            event_type=event_type,
            payload=payload,
        )
        self.session.add(outbox)
        await self.session.flush()
        return outbox
