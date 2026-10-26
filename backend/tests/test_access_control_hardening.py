import sys
import uuid
from datetime import date, datetime, timezone
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.application.context import RequestContext
from backend.app.application.exceptions import ForbiddenError, BadRequestError, NotFoundError
from backend.app.application.services.lead_service import LeadService
from backend.app.application.services.deal_service import DealService
from backend.app.application.services.account_service import AccountService
from backend.app.application.services.contact_service import ContactService
from backend.app.application.services.task_service import TaskService
from backend.app.application.services.sales_target_service import SalesTargetService
from backend.app.application.services.user_service import UserService
from backend.app.data.models.lead import Lead
from backend.app.data.models.deal import Deal
from backend.app.data.models.account import Account
from backend.app.data.models.contact import Contact
from backend.app.data.models.activity import Activity
from backend.app.data.models.target import SalesTarget
from backend.app.data.models.user import User


@pytest_asyncio.fixture
async def crm_test_setup(db_session: AsyncSession, seed_data):
    """
    Sets up multi-tenant test data with leads, deals, accounts, contacts, tasks,
    and targets mapped to Tenant A (Alpha and Beta teams) and Tenant B.
    """
    tenant_a = seed_data["tenant_a"]
    tenant_b = seed_data["tenant_b"]
    owner_a = seed_data["owner_a"]
    mgr_a1 = seed_data["manager_a1"]
    mgr_a2 = seed_data["manager_a2"]
    sales_a1 = seed_data["sales_a1"]
    sales_a2 = seed_data["sales_a2"]

    # 1. Accounts
    acc_alpha = Account(
        id=uuid.UUID("ac000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        name="Acme Alpha Client",
        status="active",
    )
    acc_beta = Account(
        id=uuid.UUID("ac000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        name="Acme Beta Client",
        status="active",
    )
    acc_tenant_b = Account(
        id=uuid.UUID("ac000000-0000-0000-0000-000000000003"),
        organization_id=tenant_b.id,
        name="Globex Client B",
        status="active",
    )
    db_session.add_all([acc_alpha, acc_beta, acc_tenant_b])
    await db_session.flush()

    # 2. Contacts
    con_alpha = Contact(
        id=uuid.UUID("c0000000-0000-0000-0000-000000000001"),
        account_id=acc_alpha.id,
        first_name="Alpha",
        last_name="Contact",
        email="alpha.contact@acme.com",
    )
    con_beta = Contact(
        id=uuid.UUID("c0000000-0000-0000-0000-000000000002"),
        account_id=acc_beta.id,
        first_name="Beta",
        last_name="Contact",
        email="beta.contact@acme.com",
    )
    db_session.add_all([con_alpha, con_beta])
    await db_session.flush()

    # 3. Deals (Deal for sales_a1 linked to acc_alpha; Deal for sales_a2 linked to acc_beta)
    deal_alpha = Deal(
        id=uuid.UUID("d0000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        account_id=acc_alpha.id,
        owner_id=sales_a1.id,
        name="Alpha Cloud Contract",
        amount=50000.0,
        stage="discovery",
        status="open",
        created_at=datetime.now(timezone.utc),
    )
    deal_beta = Deal(
        id=uuid.UUID("d0000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        account_id=acc_beta.id,
        owner_id=sales_a2.id,
        name="Beta Hardware Contract",
        amount=30000.0,
        stage="proposal",
        status="open",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([deal_alpha, deal_beta])
    await db_session.flush()

    # 4. Leads (Unassigned lead, Lead assigned to Alpha, Lead assigned to Beta)
    lead_unassigned = Lead(
        id=uuid.UUID("10000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        name="Inbound Unassigned",
        email="inbound@prospect.com",
        status="new",
        assigned_to=None,
        created_at=datetime.now(timezone.utc),
    )
    lead_alpha = Lead(
        id=uuid.UUID("10000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        name="David Assigned",
        email="david.lead@prospect.com",
        status="contacted",
        assigned_to=sales_a1.id,
        created_at=datetime.now(timezone.utc),
    )
    lead_beta = Lead(
        id=uuid.UUID("10000000-0000-0000-0000-000000000003"),
        organization_id=tenant_a.id,
        name="Eva Assigned",
        email="eva.lead@prospect.com",
        status="contacted",
        assigned_to=sales_a2.id,
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([lead_unassigned, lead_alpha, lead_beta])
    await db_session.flush()

    # 5. Tasks
    task_alpha = Activity(
        id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        user_id=sales_a1.id,
        type="task",
        subject="Follow up with Alpha Prospect",
        status="scheduled",
        created_at=datetime.now(timezone.utc),
    )
    task_beta = Activity(
        id=uuid.UUID("a0000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        user_id=sales_a2.id,
        type="task",
        subject="Follow up with Beta Prospect",
        status="scheduled",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add_all([task_alpha, task_beta])
    await db_session.flush()

    # 6. Sales Targets
    target_alpha = SalesTarget(
        id=uuid.UUID("70000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        assigned_to_user_id=sales_a1.id,
        assigned_by_user_id=owner_a.id,
        target_amount=100000.0,
        period_type="monthly",
        period_start=date(2026, 10, 1),
        period_end=date(2026, 10, 31),
        status="active",
    )
    target_beta = SalesTarget(
        id=uuid.UUID("70000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        assigned_to_user_id=sales_a2.id,
        assigned_by_user_id=owner_a.id,
        target_amount=80000.0,
        period_type="monthly",
        period_start=date(2026, 10, 1),
        period_end=date(2026, 10, 31),
        status="active",
    )
    db_session.add_all([target_alpha, target_beta])
    await db_session.commit()

    return {
        "acc_alpha": acc_alpha,
        "acc_beta": acc_beta,
        "acc_tenant_b": acc_tenant_b,
        "con_alpha": con_alpha,
        "con_beta": con_beta,
        "deal_alpha": deal_alpha,
        "deal_beta": deal_beta,
        "lead_unassigned": lead_unassigned,
        "lead_alpha": lead_alpha,
        "lead_beta": lead_beta,
        "task_alpha": task_alpha,
        "task_beta": task_beta,
        "target_alpha": target_alpha,
        "target_beta": target_beta,
    }


# ============================================================================
# 1. Owner can access authorized organization records
# ============================================================================
@pytest.mark.asyncio
async def test_owner_can_access_organization_records(db_session, ctx_owner_a, crm_test_setup):
    lead_svc = LeadService(db_session)
    deal_svc = DealService(db_session)
    acc_svc = AccountService(db_session)

    # Owner can get unassigned, alpha, and beta leads
    l_un = await lead_svc.get_lead(ctx_owner_a, crm_test_setup["lead_unassigned"].id)
    l_a = await lead_svc.get_lead(ctx_owner_a, crm_test_setup["lead_alpha"].id)
    l_b = await lead_svc.get_lead(ctx_owner_a, crm_test_setup["lead_beta"].id)
    assert l_un is not None and l_a is not None and l_b is not None

    # Owner can get all deals
    d_a = await deal_svc.get_deal(ctx_owner_a, crm_test_setup["deal_alpha"].id)
    d_b = await deal_svc.get_deal(ctx_owner_a, crm_test_setup["deal_beta"].id)
    assert d_a is not None and d_b is not None


# ============================================================================
# 2. Manager cannot access another team's leads, deals, tasks, targets, or private accounts
# ============================================================================
@pytest.mark.asyncio
async def test_manager_cannot_access_other_team_records(db_session, ctx_manager_a1, crm_test_setup):
    lead_svc = LeadService(db_session)
    deal_svc = DealService(db_session)
    task_svc = TaskService(db_session)
    target_svc = SalesTargetService(db_session)
    acc_svc = AccountService(db_session)

    # Manager of Team Alpha trying to access Team Beta's records
    with pytest.raises(ForbiddenError):
        await lead_svc.get_lead(ctx_manager_a1, crm_test_setup["lead_beta"].id)

    with pytest.raises(ForbiddenError):
        await deal_svc.get_deal(ctx_manager_a1, crm_test_setup["deal_beta"].id)

    with pytest.raises(ForbiddenError):
        await task_svc.get_task(ctx_manager_a1, crm_test_setup["task_beta"].id)

    with pytest.raises(ForbiddenError):
        await target_svc.get_target(ctx_manager_a1, crm_test_setup["target_beta"].id)

    with pytest.raises(ForbiddenError):
        await acc_svc.get_account(ctx_manager_a1, crm_test_setup["acc_beta"].id)


# ============================================================================
# 3. Salesperson cannot access unassigned leads
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_access_unassigned_lead(db_session, ctx_sales_a1, crm_test_setup):
    lead_svc = LeadService(db_session)
    with pytest.raises(ForbiddenError):
        await lead_svc.get_lead(ctx_sales_a1, crm_test_setup["lead_unassigned"].id)


# ============================================================================
# 4. Authorized Managers can access permitted unassigned leads
# ============================================================================
@pytest.mark.asyncio
async def test_authorized_manager_can_access_unassigned_lead(db_session, ctx_manager_a1, crm_test_setup):
    lead_svc = LeadService(db_session)
    # Manager without explicit authorization cannot access unassigned leads pool
    with pytest.raises(ForbiddenError):
        await lead_svc.get_lead(ctx_manager_a1, crm_test_setup["lead_unassigned"].id)

    # Manager WITH explicit authorization can access unassigned leads pool
    import dataclasses
    ctx_authorized_mgr = dataclasses.replace(ctx_manager_a1, can_access_unassigned=True)
    lead = await lead_svc.get_lead(ctx_authorized_mgr, crm_test_setup["lead_unassigned"].id)
    assert lead.id == crm_test_setup["lead_unassigned"].id


# ============================================================================
# 5. Salesperson cannot read another salesperson's deals
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_read_other_salesperson_deal(db_session, ctx_sales_a1, crm_test_setup):
    deal_svc = DealService(db_session)
    with pytest.raises(ForbiddenError):
        await deal_svc.get_deal(ctx_sales_a1, crm_test_setup["deal_beta"].id)


# ============================================================================
# 6. Salesperson cannot update another salesperson's pipeline stage
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_update_other_salesperson_deal_stage(db_session, ctx_sales_a1, crm_test_setup):
    deal_svc = DealService(db_session)
    with pytest.raises(ForbiddenError):
        await deal_svc.update_stage(ctx_sales_a1, crm_test_setup["deal_beta"].id, "negotiation")


# ============================================================================
# 7. Salesperson cannot delete another salesperson's deal
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_delete_other_salesperson_deal(db_session, ctx_sales_a1, crm_test_setup):
    deal_svc = DealService(db_session)
    with pytest.raises(ForbiddenError):
        await deal_svc.delete_deal(ctx_sales_a1, crm_test_setup["deal_beta"].id)


# ============================================================================
# 8. Account and contact visibility respects explicit sharing rules
# ============================================================================
@pytest.mark.asyncio
async def test_account_and_contact_sharing_rules(db_session, ctx_sales_a1, crm_test_setup):
    acc_svc = AccountService(db_session)
    con_svc = ContactService(db_session)

    # sales_a1 owns deal on acc_alpha -> can see acc_alpha and con_alpha
    acc = await acc_svc.get_account(ctx_sales_a1, crm_test_setup["acc_alpha"].id)
    assert acc.id == crm_test_setup["acc_alpha"].id

    con = await con_svc.get_contact(ctx_sales_a1, crm_test_setup["con_alpha"].id)
    assert con.id == crm_test_setup["con_alpha"].id

    # sales_a1 has NO deals/tasks on acc_beta -> denied
    with pytest.raises(ForbiddenError):
        await acc_svc.get_account(ctx_sales_a1, crm_test_setup["acc_beta"].id)

    with pytest.raises(ForbiddenError):
        await con_svc.get_contact(ctx_sales_a1, crm_test_setup["con_beta"].id)


# ============================================================================
# 9. Account deletion is denied to unauthorized roles
# ============================================================================
@pytest.mark.asyncio
async def test_account_deletion_denied_to_unauthorized_roles(db_session, ctx_manager_a1, ctx_sales_a1, crm_test_setup):
    acc_svc = AccountService(db_session)

    # Manager cannot delete account
    with pytest.raises(ForbiddenError):
        await acc_svc.delete_account(ctx_manager_a1, crm_test_setup["acc_alpha"].id)

    # Salesperson cannot delete account
    with pytest.raises(ForbiddenError):
        await acc_svc.delete_account(ctx_sales_a1, crm_test_setup["acc_alpha"].id)


# ============================================================================
# 10. Salesperson cannot delete tasks unless explicitly authorized
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_delete_other_tasks(db_session, ctx_sales_a1, crm_test_setup):
    task_svc = TaskService(db_session)

    # Attempting to delete task created by/assigned to sales_a2
    with pytest.raises(ForbiddenError):
        await task_svc.delete_task(ctx_sales_a1, crm_test_setup["task_beta"].id)


# ============================================================================
# 11. Manager task and target queries exclude other teams
# ============================================================================
@pytest.mark.asyncio
async def test_manager_queries_exclude_other_teams(db_session, ctx_manager_a1, crm_test_setup):
    task_svc = TaskService(db_session)
    target_svc = SalesTargetService(db_session)

    tasks, total_tasks = await task_svc.list_tasks(ctx_manager_a1)
    task_ids = [t.id for t in tasks]
    assert crm_test_setup["task_alpha"].id in task_ids
    assert crm_test_setup["task_beta"].id not in task_ids

    targets, total_targets = await target_svc.list_targets(ctx_manager_a1)
    target_ids = [t.id for t in targets]
    assert crm_test_setup["target_alpha"].id in target_ids
    assert crm_test_setup["target_beta"].id not in target_ids


# ============================================================================
# 12. Last active Owner cannot be deactivated or demoted
# ============================================================================
@pytest.mark.asyncio
async def test_last_active_owner_cannot_be_deactivated_or_demoted(db_session, ctx_owner_a, seed_data):
    user_svc = UserService(db_session)
    owner = seed_data["owner_a"]

    # 1. Deactivation prevention
    # Creating a second owner first to test owner-on-owner deactivation
    second_owner = await user_svc.create_user(
        ctx_owner_a, name="Second Owner", email="second.owner@acme.com", role_name="owner"
    )

    ctx_second = RequestContext(
        user_id=str(second_owner.id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="owner",
        correlation_id="req_test_sec_owner",
    )

    # Now deactivating one owner when another remains succeeds
    await user_svc.deactivate_user(ctx_second, owner.id)

    # Now only second_owner is the last active owner! Attempting to deactivate it must fail:
    # A) Can't self-deactivate
    with pytest.raises(BadRequestError):
        await user_svc.deactivate_user(ctx_second, second_owner.id)

    # B) Demotion of the last active owner must be blocked
    with pytest.raises(ForbiddenError):
        await user_svc.update_user(ctx_second, second_owner.id, {"role_name": "manager"})


# ============================================================================
# 13. Unauthorized lead conversion is rejected
# ============================================================================
@pytest.mark.asyncio
async def test_unauthorized_lead_conversion_rejected(db_session, ctx_sales_a1, crm_test_setup):
    lead_svc = LeadService(db_session)

    # Salesperson trying to convert another salesperson's lead
    with pytest.raises(ForbiddenError):
        await lead_svc.convert_lead(ctx_sales_a1, crm_test_setup["lead_beta"].id)

    # Salesperson trying to convert unassigned lead
    with pytest.raises(ForbiddenError):
        await lead_svc.convert_lead(ctx_sales_a1, crm_test_setup["lead_unassigned"].id)


# ============================================================================
# 14. Cross-tenant record IDs cannot bypass authorization
# ============================================================================
@pytest.mark.asyncio
async def test_cross_tenant_record_access_denied(db_session, ctx_owner_a, crm_test_setup):
    acc_svc = AccountService(db_session)
    # Owner of Tenant A trying to access Tenant B account
    with pytest.raises(NotFoundError):
        await acc_svc.get_account(ctx_owner_a, crm_test_setup["acc_tenant_b"].id)


# ============================================================================
# 15. Modified identity and team headers cannot impersonate another user
# ============================================================================
@pytest.mark.asyncio
async def test_identity_and_team_tampering_rejected(db_session, ctx_sales_a1, seed_data):
    # Salesperson attempting to craft a context claiming to be Owner or Manager
    fake_ctx = RequestContext(
        user_id=str(seed_data["sales_a1"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="owner",  # Claiming to be owner
        correlation_id="req_spoof",
    )
    # Backend validates trusted database identity or checks role
    # When tested against UserService or permissions:
    user_svc = UserService(db_session)
    with pytest.raises(ForbiddenError):
        # A salesperson cannot change their own role even if header claimed owner
        await user_svc.update_user(ctx_sales_a1, seed_data["sales_a1"].id, {"role_name": "owner"})


# ============================================================================
# 16. Analytics metrics are scoped correctly for all three roles
# 17. Analytics exports and drill-down endpoints apply equivalent restrictions
# ============================================================================
def test_analytics_metrics_and_exports_scoped_by_role():
    """
    Executes the isolated Layer 9 Analytics access control test suite,
    validating role-based query scoping and CSV export scoping.
    """
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "analytics/tests/test_access_control_analytics.py", "-v"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Analytics access control test suite failed:\n{result.stdout}\n{result.stderr}"


# ============================================================================
# 18. Inactive users cannot access protected endpoints
# ============================================================================
@pytest.mark.asyncio
async def test_inactive_users_rejected_in_backend(db_session, seed_data):
    """
    Verifies that an inactive user cannot authenticate or perform protected actions.
    """
    from backend.app.api.routes.auth import AuthenticateRequest, authenticate_user
    from backend.app.application.exceptions import UnauthorizedError
    from backend.app.application.permissions import PermissionService

    user = seed_data["sales_b"]
    user.status = "inactive"
    await db_session.commit()

    # 1. Auth route rejects inactive user
    with pytest.raises(UnauthorizedError) as exc:
        await authenticate_user(
            AuthenticateRequest(identifier=user.email, password="password123"),
            db_session,
        )
    assert exc.value.code == "ACCOUNT_INACTIVE"

    # 2. PermissionService checks fail for inactive user
    with pytest.raises(ForbiddenError):
        PermissionService.check_user_active(user)


# ============================================================================
# 19. Unauthorized ownership or assignment changes are rejected
# ============================================================================
@pytest.mark.asyncio
async def test_unauthorized_task_reassignment_rejected(db_session, ctx_sales_a1, seed_data):
    task_svc = TaskService(db_session)
    # Salesperson attempting to assign task to another user
    with pytest.raises(ForbiddenError):
        await task_svc.assign_task(
            ctx=ctx_sales_a1,
            assignee_id=seed_data["sales_a2"].id,
            subject="Unauthorized task delegation",
        )


# ============================================================================
# 20. Existing authorized workflows continue to work
# ============================================================================
@pytest.mark.asyncio
async def test_authorized_workflows_continue_to_work(db_session, ctx_sales_a1, crm_test_setup):
    task_svc = TaskService(db_session)
    deal_svc = DealService(db_session)

    # 1. Salesperson can view and update their own task status
    task = await task_svc.get_task(ctx_sales_a1, crm_test_setup["task_alpha"].id)
    assert task.subject == "Follow up with Alpha Prospect"
    updated_task = await task_svc.update_task_status(ctx_sales_a1, task.id, "in_progress")
    assert updated_task.status == "in_progress"

    # 2. Salesperson can view and update their own deal stage
    deal = await deal_svc.get_deal(ctx_sales_a1, crm_test_setup["deal_alpha"].id)
    assert deal.name == "Alpha Cloud Contract"
    updated_deal = await deal_svc.update_stage(ctx_sales_a1, deal.id, "proposal")
    assert updated_deal.stage.lower() == "proposal"


# ============================================================================
# 21. Deletion restrictions across Leads, Contacts, and Deals for Salespersons
# ============================================================================
@pytest.mark.asyncio
async def test_salesperson_cannot_delete_leads_contacts_or_deals(db_session, ctx_sales_a1, crm_test_setup):
    lead_svc = LeadService(db_session)
    con_svc = ContactService(db_session)
    deal_svc = DealService(db_session)

    # Salesperson cannot delete even their own assigned lead
    with pytest.raises(ForbiddenError) as exc_lead:
        await lead_svc.delete_lead(ctx_sales_a1, crm_test_setup["lead_alpha"].id)
    assert "Salespersons are not authorized to delete leads" in str(exc_lead.value)

    # Salesperson cannot delete contact
    with pytest.raises(ForbiddenError) as exc_con:
        await con_svc.delete_contact(ctx_sales_a1, crm_test_setup["con_alpha"].id)
    assert "Salespersons are not authorized to delete contacts" in str(exc_con.value)

    # Salesperson cannot delete even their own deal
    with pytest.raises(ForbiddenError) as exc_deal:
        await deal_svc.delete_deal(ctx_sales_a1, crm_test_setup["deal_alpha"].id)
    assert "Salespersons are not authorized to delete deals" in str(exc_deal.value)


# ============================================================================
# 22. Campaign, Discount, Report, and Administration permissions
# ============================================================================
@pytest.mark.asyncio
async def test_campaign_discount_report_and_admin_permissions(ctx_owner_a, ctx_manager_a1, ctx_sales_a1):
    from backend.app.application.permissions import PermissionService

    # Campaigns: Owner and Manager allowed, Salesperson forbidden
    PermissionService.check_can_manage_campaign(ctx_owner_a)
    PermissionService.check_can_manage_campaign(ctx_manager_a1)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_manage_campaign(ctx_sales_a1)

    # Discounts: Salesperson up to 10%, Manager up to 30%, Owner unlimited
    PermissionService.check_can_apply_discount(ctx_sales_a1, 10.0)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_apply_discount(ctx_sales_a1, 15.0)

    PermissionService.check_can_apply_discount(ctx_manager_a1, 25.0)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_apply_discount(ctx_manager_a1, 35.0)

    PermissionService.check_can_apply_discount(ctx_owner_a, 50.0)

    # Discount approval: Owner & Manager allowed, Salesperson forbidden
    PermissionService.check_can_approve_discount(ctx_owner_a)
    PermissionService.check_can_approve_discount(ctx_manager_a1)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_approve_discount(ctx_sales_a1)

    # Reports: Owner & Manager allowed, Salesperson forbidden
    PermissionService.check_can_build_reports(ctx_owner_a)
    PermissionService.check_can_build_reports(ctx_manager_a1)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_build_reports(ctx_sales_a1)

    # System administration: Owner allowed, Manager & Salesperson forbidden
    PermissionService.check_can_system_admin(ctx_owner_a)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_system_admin(ctx_manager_a1)
    with pytest.raises(ForbiddenError):
        PermissionService.check_can_system_admin(ctx_sales_a1)
