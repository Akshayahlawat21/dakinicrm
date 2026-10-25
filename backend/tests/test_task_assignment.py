import pytest
from backend.app.application.services.task_service import TaskService
from backend.app.application.exceptions import ForbiddenError, NotFoundError


@pytest.mark.asyncio
async def test_owner_assign_task_to_manager_allowed(db_session, ctx_owner_a, seed_data):
    """Owner can assign tasks to Managers within tenant."""
    task_service = TaskService(db_session)
    manager_id = seed_data["manager_a1"].id

    task = await task_service.assign_task(
        ctx=ctx_owner_a,
        assignee_id=manager_id,
        subject="Prepare Q4 Regional Strategy",
    )
    assert task.subject == "Prepare Q4 Regional Strategy"
    assert task.user_id == manager_id


@pytest.mark.asyncio
async def test_owner_assign_task_to_salesperson_allowed(db_session, ctx_owner_a, seed_data):
    """Owner can assign tasks to Salespersons within tenant."""
    task_service = TaskService(db_session)
    sales_id = seed_data["sales_a1"].id

    task = await task_service.assign_task(
        ctx=ctx_owner_a,
        assignee_id=sales_id,
        subject="Follow up with Key Accounts",
    )
    assert task.user_id == sales_id


@pytest.mark.asyncio
async def test_manager_assign_task_to_team_salesperson_allowed(db_session, ctx_manager_a1, seed_data):
    """Manager 1 can assign tasks to Salesperson 1 in their authorized team."""
    task_service = TaskService(db_session)
    sales_1_id = seed_data["sales_a1"].id

    task = await task_service.assign_task(
        ctx=ctx_manager_a1,
        assignee_id=sales_1_id,
        subject="Call Acme Prospect",
    )
    assert task.user_id == sales_1_id


@pytest.mark.asyncio
async def test_manager_assign_task_to_non_team_salesperson_forbidden(db_session, ctx_manager_a1, seed_data):
    """Manager 1 cannot assign tasks to Salesperson 2 (who is in Team Beta, not Team Alpha)."""
    task_service = TaskService(db_session)
    sales_2_id = seed_data["sales_a2"].id

    with pytest.raises(ForbiddenError):
        await task_service.assign_task(
            ctx=ctx_manager_a1,
            assignee_id=sales_2_id,
            subject="Intrusion into other team",
        )


@pytest.mark.asyncio
async def test_manager_assign_task_to_owner_forbidden(db_session, ctx_manager_a1, seed_data):
    """Manager cannot assign tasks to the Owner."""
    task_service = TaskService(db_session)
    owner_id = seed_data["owner_a"].id

    with pytest.raises(ForbiddenError):
        await task_service.assign_task(
            ctx=ctx_manager_a1,
            assignee_id=owner_id,
            subject="Delegating to the Owner",
        )


@pytest.mark.asyncio
async def test_manager_assign_task_to_another_manager_forbidden(db_session, ctx_manager_a1, seed_data):
    """Manager 1 cannot assign tasks to Manager 2."""
    task_service = TaskService(db_session)
    manager_2_id = seed_data["manager_a2"].id

    with pytest.raises(ForbiddenError):
        await task_service.assign_task(
            ctx=ctx_manager_a1,
            assignee_id=manager_2_id,
            subject="Delegating to peer manager",
        )


@pytest.mark.asyncio
async def test_salesperson_assign_task_to_anyone_forbidden(db_session, ctx_sales_a1, seed_data):
    """Salesperson cannot assign tasks to Owner, Manager, or other Salespersons."""
    task_service = TaskService(db_session)
    owner_id = seed_data["owner_a"].id
    manager_id = seed_data["manager_a1"].id
    peer_sales_id = seed_data["sales_a2"].id

    for target in (owner_id, manager_id, peer_sales_id):
        with pytest.raises(ForbiddenError):
            await task_service.assign_task(
                ctx=ctx_sales_a1,
                assignee_id=target,
                subject="Unauthorized salesperson assignment",
            )
