import pytest
from backend.app.application.services.lead_service import LeadService
from backend.app.application.services.deal_service import DealService
from backend.app.application.services.task_service import TaskService
from backend.app.application.services.sales_target_service import SalesTargetService
from backend.app.application.services.account_service import AccountService
from backend.app.application.services.contact_service import ContactService
from backend.app.application.services.user_service import UserService
from backend.app.application.exceptions import NotFoundError, ForbiddenError, ConflictError


@pytest.mark.asyncio
async def test_tenant_isolation_leads(db_session, ctx_owner_a, ctx_owner_b):
    """Tenant A creates a lead; Tenant B must never be able to read or modify it."""
    lead_service = LeadService(db_session)

    # 1. Tenant A creates a lead
    lead_a = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Confidential Prospect A",
        company="Secret Aero Ltd",
        email="ceo@secretaero.com",
    )
    await db_session.flush()

    # Tenant A can read it
    read_a = await lead_service.get_lead(ctx_owner_a, lead_a.id)
    assert read_a.name == "Confidential Prospect A"

    # 2. Tenant B attempts to read Tenant A's lead -> 404 (or Forbidden)
    with pytest.raises(NotFoundError):
        await lead_service.get_lead(ctx_owner_b, lead_a.id)

    # 3. Tenant B lists leads -> Lead A is NOT returned
    leads_b, total_b = await lead_service.list_leads(ctx_owner_b)
    lead_ids_b = [str(l.id) for l in leads_b]
    assert str(lead_a.id) not in lead_ids_b


@pytest.mark.asyncio
async def test_tenant_isolation_users(db_session, ctx_owner_a, ctx_owner_b, seed_data):
    """Owner A cannot view or manage Tenant B's users."""
    user_service = UserService(db_session)
    user_b_id = seed_data["sales_b"].id

    with pytest.raises(NotFoundError):
        await user_service.get_user(ctx_owner_a, user_b_id)


@pytest.mark.asyncio
async def test_tenant_isolation_tasks(db_session, ctx_owner_a, ctx_owner_b, seed_data):
    """Owner A cannot assign a task to a user belonging to Tenant B."""
    task_service = TaskService(db_session)
    user_b_id = seed_data["sales_b"].id

    # Cross-tenant task assignment must be rejected
    with pytest.raises(NotFoundError):
        await task_service.assign_task(
            ctx=ctx_owner_a,
            assignee_id=user_b_id,
            subject="Illicit cross-tenant task",
        )


@pytest.mark.asyncio
async def test_tenant_isolation_sales_targets(db_session, ctx_owner_a, ctx_owner_b, seed_data):
    """Owner A cannot set a sales target for a user in Tenant B."""
    from datetime import date
    target_service = SalesTargetService(db_session)
    user_b_id = seed_data["sales_b"].id

    with pytest.raises(NotFoundError):
        await target_service.set_sales_target(
            ctx=ctx_owner_a,
            assigned_to_user_id=user_b_id,
            target_amount=100000.0,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 1, 31),
        )


@pytest.mark.asyncio
async def test_cross_tenant_foreign_key_prevention(db_session, ctx_owner_a, ctx_owner_b):
    """Creating a contact referencing an account from another tenant must be rejected."""
    account_service = AccountService(db_session)
    contact_service = ContactService(db_session)

    # 1. Tenant B creates an account
    acc_b = await account_service.create_account(
        ctx=ctx_owner_b,
        name="Globex Holding",
    )
    await db_session.flush()

    # 2. Tenant A tries to create a contact linked to Tenant B's account
    with pytest.raises(NotFoundError):
        await contact_service.create_contact(
            ctx=ctx_owner_a,
            account_id=acc_b.id,
            first_name="Spy",
            last_name="Infiltrator",
            email="spy@infiltrator.com",
        )
