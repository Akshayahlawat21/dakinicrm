import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.application.services.team_service import TeamService
from backend.app.api.schemas.team import (
    TeamCreateRequest,
    TeamUpdateRequest,
    TeamMemberAddRequest,
    TeamMemberTransferRequest,
    TeamResponse,
    TeamDetailResponse,
    TeamManagerDTO,
    TeamMemberDTO,
)
from backend.app.api.schemas.common import StandardResponse, PaginatedResponse

router = APIRouter(prefix="/v1/teams", tags=["Teams"])


@router.get("", response_model=StandardResponse[List[TeamResponse]])
async def list_teams(
    status_filter: Optional[str] = Query("active", alias="status"),
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    teams_with_stats = await service.list_teams(ctx, status=status_filter)

    team_dtos = [
        TeamResponse(
            id=str(team.id),
            organization_id=str(team.organization_id),
            name=team.name,
            description=team.description,
            status=team.status,
            manager=TeamManagerDTO(
                id=str(team.manager.id),
                name=team.manager.name,
                email=team.manager.email,
                login_id=team.manager.login_id,
            )
            if team.manager
            else None,
            salesperson_count=count,
            created_at=team.created_at,
        )
        for team, count in teams_with_stats
    ]

    return StandardResponse(
        status="success",
        data=team_dtos,
        correlation_id=ctx.correlation_id,
    )


@router.post("", response_model=StandardResponse[TeamResponse], status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    team = await service.create_team(
        ctx=ctx,
        name=body.name,
        description=body.description,
        manager_id=body.manager_id,
    )
    await session.commit()

    # Reload with manager relation if assigned
    detail = await service.get_team(ctx, team.id)
    return StandardResponse(
        status="success",
        data=TeamResponse(
            id=str(detail.id),
            organization_id=str(detail.organization_id),
            name=detail.name,
            description=detail.description,
            status=detail.status,
            manager=TeamManagerDTO(
                id=str(detail.manager.id),
                name=detail.manager.name,
                email=detail.manager.email,
                login_id=detail.manager.login_id,
            )
            if detail.manager
            else None,
            salesperson_count=0,
            created_at=detail.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.get("/{team_id}", response_model=StandardResponse[TeamDetailResponse])
async def get_team_detail(
    team_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    team = await service.get_team(ctx, team_id)

    member_dtos = []
    if team.members:
        for m in team.members:
            if m.is_active and m.user:
                member_dtos.append(
                    TeamMemberDTO(
                        id=str(m.id),
                        user_id=str(m.user.id),
                        name=m.user.name,
                        email=m.user.email,
                        login_id=m.user.login_id,
                        role_name=m.user.role_name,
                        joined_at=m.joined_at,
                    )
                )

    return StandardResponse(
        status="success",
        data=TeamDetailResponse(
            id=str(team.id),
            organization_id=str(team.organization_id),
            name=team.name,
            description=team.description,
            status=team.status,
            manager=TeamManagerDTO(
                id=str(team.manager.id),
                name=team.manager.name,
                email=team.manager.email,
                login_id=team.manager.login_id,
            )
            if team.manager
            else None,
            members=member_dtos,
            created_at=team.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.patch("/{team_id}", response_model=StandardResponse[TeamResponse])
async def update_team(
    team_id: str,
    body: TeamUpdateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    team = await service.update_team(ctx, team_id, update_data)
    await session.commit()

    detail = await service.get_team(ctx, team.id)
    return StandardResponse(
        status="success",
        data=TeamResponse(
            id=str(detail.id),
            organization_id=str(detail.organization_id),
            name=detail.name,
            description=detail.description,
            status=detail.status,
            manager=TeamManagerDTO(
                id=str(detail.manager.id),
                name=detail.manager.name,
                email=detail.manager.email,
                login_id=detail.manager.login_id,
            )
            if detail.manager
            else None,
            salesperson_count=len(detail.members) if detail.members else 0,
            created_at=detail.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{team_id}/deactivate", response_model=StandardResponse[TeamResponse])
async def deactivate_team(
    team_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    team = await service.deactivate_team(ctx, team_id)
    await session.commit()

    return StandardResponse(
        status="success",
        data=TeamResponse(
            id=str(team.id),
            organization_id=str(team.organization_id),
            name=team.name,
            description=team.description,
            status=team.status,
            manager=None,
            salesperson_count=0,
            created_at=team.created_at,
        ),
        correlation_id=ctx.correlation_id,
    )


@router.post("/{team_id}/members", response_model=StandardResponse[dict], status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: str,
    body: TeamMemberAddRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    member = await service.add_member(ctx, team_id, body.user_id)
    await session.commit()

    return StandardResponse(
        status="success",
        data={"team_id": str(member.team_id), "user_id": str(member.user_id), "is_active": member.is_active},
        correlation_id=ctx.correlation_id,
    )


@router.delete("/{team_id}/members/{user_id}", response_model=StandardResponse[dict])
async def remove_team_member(
    team_id: str,
    user_id: str,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    removed = await service.remove_member(ctx, team_id, user_id)
    await session.commit()

    return StandardResponse(
        status="success",
        data={"removed": removed, "team_id": team_id, "user_id": user_id},
        correlation_id=ctx.correlation_id,
    )


@router.post("/{team_id}/members/{user_id}/transfer", response_model=StandardResponse[dict])
async def transfer_team_member(
    team_id: str,
    user_id: str,
    body: TeamMemberTransferRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    service = TeamService(session)
    member = await service.transfer_member(
        ctx=ctx,
        user_id=user_id,
        source_team_id=team_id,
        target_team_id=body.target_team_id,
    )
    await session.commit()

    return StandardResponse(
        status="success",
        data={
            "transferred": True,
            "user_id": str(member.user_id),
            "source_team_id": team_id,
            "target_team_id": str(member.team_id),
        },
        correlation_id=ctx.correlation_id,
    )
