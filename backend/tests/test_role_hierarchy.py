import pytest
from backend.app.application.services.user_service import UserService
from backend.app.application.exceptions import ForbiddenError


@pytest.mark.asyncio
async def test_owner_can_manage_managers_and_salespersons(db_session, ctx_owner_a, seed_data):
    """Owner can create new salespersons and update roles within the tenant."""
    user_service = UserService(db_session)

    # 1. Owner creates a new salesperson
    new_rep = await user_service.create_user(
        ctx=ctx_owner_a,
        name="New Rep",
        email="new.rep@acme.com",
        role_name="salesperson",
    )
    assert new_rep.role_name == "salesperson"

    # 2. Owner promotes rep to manager
    updated = await user_service.update_user(
        ctx=ctx_owner_a,
        user_id=new_rep.id,
        update_data={"role_name": "manager"},
    )
    assert updated.role_name == "manager"


@pytest.mark.asyncio
async def test_manager_cannot_modify_owner(db_session, ctx_manager_a1, seed_data):
    """Manager must be strictly forbidden from modifying the Owner."""
    user_service = UserService(db_session)
    owner_id = seed_data["owner_a"].id

    with pytest.raises(ForbiddenError):
        await user_service.update_user(
            ctx=ctx_manager_a1,
            user_id=owner_id,
            update_data={"name": "Compromised Owner"},
        )


@pytest.mark.asyncio
async def test_manager_cannot_modify_another_manager(db_session, ctx_manager_a1, seed_data):
    """Manager 1 cannot modify Manager 2."""
    user_service = UserService(db_session)
    manager_2_id = seed_data["manager_a2"].id

    with pytest.raises(ForbiddenError):
        await user_service.update_user(
            ctx=ctx_manager_a1,
            user_id=manager_2_id,
            update_data={"name": "Hacked Manager"},
        )


@pytest.mark.asyncio
async def test_manager_cannot_promote_to_manager_or_owner(db_session, ctx_manager_a1, seed_data):
    """Manager cannot promote a salesperson to Manager or Owner."""
    user_service = UserService(db_session)
    sales_id = seed_data["sales_a1"].id

    with pytest.raises(ForbiddenError):
        await user_service.update_user(
            ctx=ctx_manager_a1,
            user_id=sales_id,
            update_data={"role_name": "manager"},
        )

    with pytest.raises(ForbiddenError):
        await user_service.update_user(
            ctx=ctx_manager_a1,
            user_id=sales_id,
            update_data={"role_name": "owner"},
        )


@pytest.mark.asyncio
async def test_salesperson_cannot_modify_other_users(db_session, ctx_sales_a1, seed_data):
    """Salesperson cannot modify any other user."""
    user_service = UserService(db_session)
    manager_id = seed_data["manager_a1"].id
    owner_id = seed_data["owner_a"].id
    other_sales_id = seed_data["sales_a2"].id

    for target in (manager_id, owner_id, other_sales_id):
        with pytest.raises(ForbiddenError):
            await user_service.update_user(
                ctx=ctx_sales_a1,
                user_id=target,
                update_data={"name": "Unauthorized Change"},
            )


@pytest.mark.asyncio
async def test_self_privilege_escalation_forbidden(db_session, ctx_sales_a1, seed_data):
    """Users cannot modify their own role to elevate privileges."""
    user_service = UserService(db_session)
    my_id = seed_data["sales_a1"].id

    with pytest.raises(ForbiddenError):
        await user_service.update_user(
            ctx=ctx_sales_a1,
            user_id=my_id,
            update_data={"role_name": "owner"},
        )
