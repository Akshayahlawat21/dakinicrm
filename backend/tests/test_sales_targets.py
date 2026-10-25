import pytest
from datetime import date
from backend.app.application.services.sales_target_service import SalesTargetService
from backend.app.application.exceptions import BadRequestError, ForbiddenError, ConflictError


@pytest.mark.asyncio
async def test_owner_set_target_for_manager_allowed(db_session, ctx_owner_a, seed_data):
    """Owner can set sales targets for managers."""
    target_service = SalesTargetService(db_session)
    manager_id = seed_data["manager_a1"].id

    target = await target_service.set_sales_target(
        ctx=ctx_owner_a,
        assigned_to_user_id=manager_id,
        target_amount=150000.0,
        period_start=date(2026, 2, 1),
        period_end=date(2026, 2, 28),
    )
    assert target.target_amount == 150000.0
    assert target.assigned_to_user_id == manager_id


@pytest.mark.asyncio
async def test_manager_set_target_for_team_salesperson_allowed(db_session, ctx_manager_a1, seed_data):
    """Manager 1 can set sales targets for Salesperson 1 in their team."""
    target_service = SalesTargetService(db_session)
    sales_1_id = seed_data["sales_a1"].id

    target = await target_service.set_sales_target(
        ctx=ctx_manager_a1,
        assigned_to_user_id=sales_1_id,
        target_amount=45000.0,
        period_start=date(2026, 3, 1),
        period_end=date(2026, 3, 31),
    )
    assert target.target_amount == 45000.0


@pytest.mark.asyncio
async def test_manager_set_target_for_non_team_salesperson_forbidden(db_session, ctx_manager_a1, seed_data):
    """Manager 1 cannot set targets for Salesperson 2 (outside their team)."""
    target_service = SalesTargetService(db_session)
    sales_2_id = seed_data["sales_a2"].id

    with pytest.raises(ForbiddenError):
        await target_service.set_sales_target(
            ctx=ctx_manager_a1,
            assigned_to_user_id=sales_2_id,
            target_amount=50000.0,
            period_start=date(2026, 3, 1),
            period_end=date(2026, 3, 31),
        )


@pytest.mark.asyncio
async def test_manager_set_target_for_owner_forbidden(db_session, ctx_manager_a1, seed_data):
    """Manager cannot set target for Owner."""
    target_service = SalesTargetService(db_session)
    owner_id = seed_data["owner_a"].id

    with pytest.raises(ForbiddenError):
        await target_service.set_sales_target(
            ctx=ctx_manager_a1,
            assigned_to_user_id=owner_id,
            target_amount=200000.0,
            period_start=date(2026, 3, 1),
            period_end=date(2026, 3, 31),
        )


@pytest.mark.asyncio
async def test_salesperson_cannot_set_targets(db_session, ctx_sales_a1, seed_data):
    """Salesperson cannot set targets for anyone or themselves."""
    target_service = SalesTargetService(db_session)
    my_id = seed_data["sales_a1"].id

    with pytest.raises(ForbiddenError):
        await target_service.set_sales_target(
            ctx=ctx_sales_a1,
            assigned_to_user_id=my_id,
            target_amount=10000.0,
            period_start=date(2026, 3, 1),
            period_end=date(2026, 3, 31),
        )


@pytest.mark.asyncio
async def test_invalid_target_amount_and_dates_rejected(db_session, ctx_owner_a, seed_data):
    """Target amount must be > 0 and period_end >= period_start."""
    target_service = SalesTargetService(db_session)
    rep_id = seed_data["sales_a1"].id

    # Amount <= 0
    with pytest.raises(BadRequestError):
        await target_service.set_sales_target(
            ctx=ctx_owner_a,
            assigned_to_user_id=rep_id,
            target_amount=0.0,
            period_start=date(2026, 4, 1),
            period_end=date(2026, 4, 30),
        )

    # Inverted dates
    with pytest.raises(BadRequestError):
        await target_service.set_sales_target(
            ctx=ctx_owner_a,
            assigned_to_user_id=rep_id,
            target_amount=50000.0,
            period_start=date(2026, 4, 30),
            period_end=date(2026, 4, 1),
        )


@pytest.mark.asyncio
async def test_duplicate_target_in_same_period_rejected(db_session, ctx_owner_a, seed_data):
    """Cannot set two active targets for the same user in the identical period."""
    target_service = SalesTargetService(db_session)
    rep_id = seed_data["sales_a1"].id

    await target_service.set_sales_target(
        ctx=ctx_owner_a,
        assigned_to_user_id=rep_id,
        target_amount=40000.0,
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
    )

    with pytest.raises(ConflictError):
        await target_service.set_sales_target(
            ctx=ctx_owner_a,
            assigned_to_user_id=rep_id,
            target_amount=50000.0,
            period_start=date(2026, 5, 1),
            period_end=date(2026, 5, 31),
        )
