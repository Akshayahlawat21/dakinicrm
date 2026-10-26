from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.user_service import UserService
from backend.app.api.schemas.user import (
    UserCreateRequest,
    UserUpdateRequest,
    UserResponse,
    PasswordChangeRequest,
    PasswordResetResponse,
)
from backend.app.api.schemas.common import PaginatedResponse, StandardResponse

router = APIRouter(prefix="/v1/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    team_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    users, total = await service.list_users(
        ctx, skip=skip, limit=limit, team_id=team_id, role=role, status=status_filter
    )
    user_dtos = [
        UserResponse(
            id=str(u.id),
            organization_id=str(u.organization_id),
            name=u.name,
            email=u.email,
            login_id=u.login_id,
            role_name=u.role_name,
            status=u.status,
            must_change_password=u.must_change_password or False,
            created_at=u.created_at,
        )
        for u in users
    ]
    return PaginatedResponse(
        status="success",
        data=user_dtos,
        total=total,
        skip=skip,
        limit=limit,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[UserResponse], status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    user = await service.create_user(
        ctx=ctx,
        name=body.name,
        email=body.email,
        role_name=body.role_name,
        team_id=body.team_id,
        manager_id=body.manager_id,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            name=user.name,
            email=user.email,
            login_id=user.login_id,
            role_name=user.role_name,
            status=user.status,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
            temporary_password=getattr(user, "temporary_password", None),
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/me", response_model=StandardResponse[UserResponse])
async def get_current_user_profile(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    user = await service.get_user(ctx, ctx.user_id)
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            name=user.name,
            email=user.email,
            login_id=user.login_id,
            role_name=user.role_name,
            status=user.status,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/change-password", response_model=StandardResponse[UserResponse])
async def change_password(
    body: PasswordChangeRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    updated = await service.change_password(
        ctx=ctx,
        old_password=body.old_password,
        new_password=body.new_password,
    )
    await session.commit()
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(updated.id),
            organization_id=str(updated.organization_id),
            name=updated.name,
            email=updated.email,
            login_id=updated.login_id,
            role_name=updated.role_name,
            status=updated.status,
            must_change_password=updated.must_change_password,
            created_at=updated.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{user_id}", response_model=StandardResponse[UserResponse])
async def get_user(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    user = await service.get_user(ctx, user_id)
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            name=user.name,
            email=user.email,
            login_id=user.login_id,
            role_name=user.role_name,
            status=user.status,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{user_id}", response_model=StandardResponse[UserResponse])
async def update_user(
    user_id: str,
    body: UserUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await service.update_user(ctx, user_id, update_data)
    await session.commit()
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(updated.id),
            organization_id=str(updated.organization_id),
            name=updated.name,
            email=updated.email,
            login_id=updated.login_id,
            role_name=updated.role_name,
            status=updated.status,
            must_change_password=updated.must_change_password,
            created_at=updated.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{user_id}/reset-password", response_model=StandardResponse[PasswordResetResponse])
async def reset_password(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    temp_password = await service.reset_password(ctx, user_id)
    await session.commit()
    return StandardResponse(
        status="success",
        data=PasswordResetResponse(
            status="success",
            temporary_password=temp_password,
            message="Temporary password generated. It must be changed upon first login.",
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{user_id}/deactivate", response_model=StandardResponse[UserResponse])
async def deactivate_user(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    user = await service.deactivate_user(ctx, user_id)
    await session.commit()
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            name=user.name,
            email=user.email,
            login_id=user.login_id,
            role_name=user.role_name,
            status=user.status,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{user_id}/reactivate", response_model=StandardResponse[UserResponse])
async def reactivate_user(
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = UserService(session)
    user = await service.reactivate_user(ctx, user_id)
    await session.commit()
    return StandardResponse(
        status="success",
        data=UserResponse(
            id=str(user.id),
            organization_id=str(user.organization_id),
            name=user.name,
            email=user.email,
            login_id=user.login_id,
            role_name=user.role_name,
            status=user.status,
            must_change_password=user.must_change_password,
            created_at=user.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )
