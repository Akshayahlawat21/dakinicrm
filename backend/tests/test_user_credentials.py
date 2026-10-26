import uuid
import pytest
from backend.app.data.models.user import User
from backend.app.application.context import RequestContext
from backend.app.application.services.user_service import UserService, verify_password
from backend.app.application.exceptions import ForbiddenError, BadRequestError, ConflictError


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
async def test_user_creation_with_deterministic_login_and_temp_password(db_session, ctx_owner_a, seed_data):
    """TC-USER-01: User creation generates login_id, bcrypt temp password, and must_change_password=True."""
    user_service = UserService(db_session)

    user = await user_service.create_user(
        ctx=ctx_owner_a,
        name="John Doe",
        email="john.doe@acme.com",
        role_name="salesperson",
    )
    assert user.name == "John Doe"
    assert user.login_id == "johndoe"
    assert user.must_change_password is True
    assert user.token_version == 1
    assert user.temporary_password is not None
    assert len(user.temporary_password) >= 12
    # Verify bcrypt hash validates temporary password
    assert verify_password(user.temporary_password, user.hashed_password) is True


@pytest.mark.asyncio
async def test_login_id_collision_resolution(db_session, ctx_owner_a, seed_data):
    """TC-USER-05: Duplicate email prefixes receive sequential suffixes deterministically."""
    user_service = UserService(db_session)

    # First user
    u1 = await user_service.create_user(
        ctx=ctx_owner_a,
        name="Alex River",
        email="alex@acme.com",
    )
    assert u1.login_id == "alex"

    # Second user in same tenant with colliding prefix
    u2 = await user_service.create_user(
        ctx=ctx_owner_a,
        name="Alex Smith",
        email="alex.smith@different.com",
    )
    assert u2.login_id == "alexsmith"

    # Exact colliding prefix
    u3 = await user_service.create_user(
        ctx=ctx_owner_a,
        name="Alex Junior",
        email="alex@branch2.acme.com",
    )
    assert u3.login_id == "alex_2"


@pytest.mark.asyncio
async def test_self_service_password_change(db_session, ctx_owner_a, seed_data):
    """TC-AUTH-06: Self-service password change clears must_change_password and increments token_version."""
    user_service = UserService(db_session)

    user = await user_service.create_user(
        ctx=ctx_owner_a,
        name="Test Rep",
        email="test.rep@acme.com",
    )
    temp_pw = user.temporary_password

    ctx_rep = RequestContext(
        user_id=str(user.id),
        tenant_id=str(ctx_owner_a.tenant_id),
        role="salesperson",
        must_change_password=True,
    )

    # Change password
    updated = await user_service.change_password(
        ctx=ctx_rep,
        old_password=temp_pw,
        new_password="NewSecurePassword123!",
    )
    assert updated.must_change_password is False
    assert updated.token_version == 2
    assert verify_password("NewSecurePassword123!", updated.hashed_password) is True


@pytest.mark.asyncio
async def test_admin_password_reset_revokes_sessions(db_session, ctx_owner_a, seed_data):
    """TC-AUTH-07: Owner password reset generates new temp password and increments token_version."""
    user_service = UserService(db_session)
    sales_a1 = seed_data["sales_a1"]
    initial_tv = sales_a1.token_version or 1

    temp_pw = await user_service.reset_password(ctx_owner_a, sales_a1.id)
    assert len(temp_pw) >= 12
    assert sales_a1.must_change_password is True
    assert sales_a1.token_version == initial_tv + 1
    assert verify_password(temp_pw, sales_a1.hashed_password) is True


@pytest.mark.asyncio
async def test_user_deactivation_revokes_sessions(db_session, ctx_owner_a, seed_data):
    """TC-AUTH-08: Deactivating a user sets status=inactive and increments token_version."""
    user_service = UserService(db_session)
    sales_a1 = seed_data["sales_a1"]
    initial_tv = sales_a1.token_version or 1

    deactivated = await user_service.deactivate_user(ctx_owner_a, sales_a1.id)
    assert deactivated.status == "inactive"
    assert deactivated.token_version == initial_tv + 1
