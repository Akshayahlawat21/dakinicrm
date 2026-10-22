import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ConflictError, NotFoundError
from backend.app.data.models.user import User
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError, UniqueViolationError


class UserService:
    """Service for managing tenant users and enforcing role governance."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_user(self, ctx: RequestContext, user_id: str | uuid.UUID) -> User:
        try:
            return await self.user_repo.get_by_id_scoped(user_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"User '{user_id}' was not found in this organization")

    async def list_users(
        self, ctx: RequestContext, skip: int = 0, limit: int = 50
    ) -> tuple[List[User], int]:
        return await self.user_repo.list_scoped(
            tenant_id=ctx.tenant_id,
            skip=skip,
            limit=limit,
        )

    async def create_user(
        self,
        ctx: RequestContext,
        name: str,
        email: str,
        role_name: str = "salesperson",
        manager_id: Optional[str | uuid.UUID] = None,
    ) -> User:
        clean_email = email.lower().strip()
        clean_role = role_name.lower().strip()

        # Validate caller can create this role
        dummy_user = User(
            organization_id=ctx.tenant_uuid,
            name=name,
            email=clean_email,
            role_name=clean_role,
        )
        PermissionService.check_can_manage_user(ctx, dummy_user, new_role=clean_role)

        existing = await self.user_repo.get_by_email(clean_email, ctx.tenant_id)
        if existing:
            raise ConflictError(f"A user with email '{clean_email}' already exists in this organization")

        m_uuid = None
        if manager_id:
            try:
                manager = await self.user_repo.get_by_id_scoped(manager_id, ctx.tenant_id)
                m_uuid = manager.id
            except RecordNotFoundError:
                raise BadRequestError(f"Manager ID '{manager_id}' does not exist in this organization")

        new_user = User(
            name=name.strip(),
            email=clean_email,
            role_name=clean_role,
            manager_id=m_uuid,
            status="active",
        )
        try:
            created = await self.user_repo.create(new_user, ctx.tenant_id)
            await self.audit_repo.record_event(
                tenant_id=ctx.tenant_id,
                user_id=ctx.user_id,
                action="CREATE",
                resource_type="user",
                resource_id=created.id,
                new_values={"email": clean_email, "role": clean_role, "name": name},
            )
            return created
        except UniqueViolationError:
            raise ConflictError(f"User with email '{clean_email}' already exists")

    async def update_user(
        self, ctx: RequestContext, user_id: str | uuid.UUID, update_data: Dict[str, Any]
    ) -> User:
        target_user = await self.get_user(ctx, user_id)
        new_role = update_data.get("role_name")

        # Enforce role hierarchy
        PermissionService.check_can_manage_user(ctx, target_user, new_role=new_role)

        old_values = {
            "name": target_user.name,
            "role_name": target_user.role_name,
            "status": target_user.status,
        }

        updated = await self.user_repo.update_scoped(user_id, ctx.tenant_id, update_data)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="UPDATE",
            resource_type="user",
            resource_id=user_id,
            old_values=old_values,
            new_values=update_data,
        )
        return updated
