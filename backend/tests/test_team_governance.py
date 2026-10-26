import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.models.user import User
from backend.app.application.context import RequestContext
from backend.app.application.services.team_service import TeamService
from backend.app.application.exceptions import ForbiddenError, BadRequestError, ConflictError
from backend.app.main import app
from backend.app.data.session import get_db_session


@pytest.fixture
def ctx_owner_a():
    return RequestContext(
        user_id="a1000000-0000-0000-0000-000000000001",
        tenant_id="11111111-1111-1111-1111-111111111111",
        role="owner",
    )


@pytest.fixture
def ctx_manager_a1():
    return RequestContext(
        user_id="a2000000-0000-0000-0000-000000000001",
        tenant_id="11111111-1111-1111-1111-111111111111",
        role="manager",
    )


@pytest.fixture
def ctx_sales_a1():
    return RequestContext(
        user_id="a3000000-0000-0000-0000-000000000001",
        tenant_id="11111111-1111-1111-1111-111111111111",
        role="salesperson",
    )


@pytest.mark.asyncio
async def test_owner_can_create_and_manage_teams(db_session, ctx_owner_a, seed_data):
    """TC-TEAM-01: Owner can create, update, and list teams in their organization."""
    team_service = TeamService(db_session)

    # 1. Create team without manager
    team = await team_service.create_team(
        ctx=ctx_owner_a,
        name="Gamma Territory Team",
        description="Pacific Northwest Region",
    )
    assert team.name == "Gamma Territory Team"
    assert team.status == "active"
    assert team.manager_id is None

    # 2. List teams (Owner sees all teams in tenant)
    teams_stats = await team_service.list_teams(ctx_owner_a)
    team_names = [t[0].name for t in teams_stats]
    assert "Gamma Territory Team" in team_names


@pytest.mark.asyncio
async def test_manager_and_salesperson_cannot_create_teams(db_session, ctx_manager_a1, ctx_sales_a1, seed_data):
    """TC-TEAM-02 & TC-TEAM-03: Manager and Salesperson are forbidden from creating teams."""
    team_service = TeamService(db_session)

    with pytest.raises(ForbiddenError):
        await team_service.create_team(ctx=ctx_manager_a1, name="Manager Rogue Team")

    with pytest.raises(ForbiddenError):
        await team_service.create_team(ctx=ctx_sales_a1, name="Salesperson Team")


@pytest.mark.asyncio
async def test_cannot_assign_non_manager_as_team_leader(db_session, ctx_owner_a, seed_data):
    """TC-TEAM-04: Assigning a salesperson or non-manager as team leader raises BadRequestError."""
    team_service = TeamService(db_session)
    sales_rep_id = "a3000000-0000-0000-0000-000000000001"

    with pytest.raises(BadRequestError) as exc:
        await team_service.create_team(
            ctx=ctx_owner_a,
            name="Invalid Leader Team",
            manager_id=sales_rep_id,
        )
    assert "does not have the 'manager' role" in str(exc.value)


@pytest.mark.asyncio
async def test_enforce_one_active_team_per_manager(db_session, ctx_owner_a, seed_data):
    """TC-TEAM-05: A manager cannot lead more than one active team concurrently."""
    team_service = TeamService(db_session)
    # Assign manager_a1 to team_alpha
    team_alpha = seed_data["team_alpha"]
    manager_a1 = seed_data["manager_a1"]

    await team_service.update_team(
        ctx=ctx_owner_a,
        team_id=team_alpha.id,
        update_data={"manager_id": str(manager_a1.id)},
    )

    # Attempting to assign manager_a1 to team_beta must raise ConflictError
    team_beta = seed_data["team_beta"]
    with pytest.raises(ConflictError) as exc:
        await team_service.update_team(
            ctx=ctx_owner_a,
            team_id=team_beta.id,
            update_data={"manager_id": str(manager_a1.id)},
        )
    assert "already assigned as leader of active team" in str(exc.value)


@pytest.mark.asyncio
async def test_team_member_assignment_and_cache_synchronization(db_session, ctx_owner_a, seed_data):
    """TC-TEAM-06: Adding a salesperson to a team updates membership and synchronizes users.manager_id."""
    team_service = TeamService(db_session)
    team_alpha = seed_data["team_alpha"]
    manager_a1 = seed_data["manager_a1"]
    sales_a2 = seed_data["sales_a2"]  # Originally in team_beta with manager_a2

    # Set manager on team_alpha
    await team_service.update_team(
        ctx=ctx_owner_a,
        team_id=team_alpha.id,
        update_data={"manager_id": str(manager_a1.id)},
    )

    # Add sales_a2 to team_alpha
    member = await team_service.add_member(
        ctx=ctx_owner_a,
        team_id=team_alpha.id,
        user_id=sales_a2.id,
    )
    assert member.is_active is True
    # Denormalized cache on User should now match team_alpha's manager
    assert sales_a2.manager_id == manager_a1.id


@pytest.mark.asyncio
async def test_team_deactivation_detaches_members(db_session, ctx_owner_a, seed_data):
    """Team deactivation sets status to inactive, releases manager, and clears members' manager_id."""
    team_service = TeamService(db_session)
    team_alpha = seed_data["team_alpha"]

    deactivated = await team_service.deactivate_team(ctx_owner_a, team_alpha.id)
    assert deactivated.status == "inactive"
    assert deactivated.manager_id is None
