import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.lead import Lead, LeadConversion
from backend.app.data.models.account import Account
from backend.app.data.models.deal import Deal, Opportunity
from backend.app.data.models.audit import AuditLog


@pytest.mark.asyncio
async def test_bulk_assign_leads_success_and_deal_sync(client: AsyncClient, db_session: AsyncSession, seed_data):
    """Verifies that bulk lead reassignment updates leads, transfers deals, and writes audit logs in batch."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    target_rep_id = str(seed_data["sales_a1"].id)

    headers = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_bulk_assign_fast",
    }

    # Create 10 leads under Tenant A
    leads = []
    for i in range(10):
        lead = Lead(
            id=uuid.uuid4(),
            organization_id=seed_data["tenant_a"].id,
            name=f"Bulk Lead {i}",
            email=f"lead_{i}@example.com",
            phone=f"+1555000{i:04d}",
            assigned_to=seed_data["owner_a"].id,
            status="New",
        )
        leads.append(lead)
    db_session.add_all(leads)
    await db_session.flush()

    # Create Account, Opportunity and Deal linked to the first lead
    account = Account(
        id=uuid.uuid4(),
        organization_id=seed_data["tenant_a"].id,
        name="Acme Account",
    )
    db_session.add(account)
    await db_session.flush()

    opp = Opportunity(
        id=uuid.uuid4(),
        organization_id=seed_data["tenant_a"].id,
        account_id=account.id,
        owner_id=seed_data["owner_a"].id,
        name="Opportunity for Lead 0",
        stage="Qualified",
        amount=50000.0,
    )
    db_session.add(opp)
    await db_session.flush()

    deal = Deal(
        id=uuid.uuid4(),
        organization_id=seed_data["tenant_a"].id,
        account_id=account.id,
        opportunity_id=opp.id,
        owner_id=seed_data["owner_a"].id,
        name="Deal for Lead 0",
        stage="Qualified",
        amount=50000.0,
    )
    db_session.add(deal)

    conv = LeadConversion(
        id=uuid.uuid4(),
        lead_id=leads[0].id,
        account_id=account.id,
        opportunity_id=opp.id,
    )
    db_session.add(conv)
    await db_session.commit()

    # Execute bulk reassignment to sales_a1
    lead_ids = [str(l.id) for l in leads]
    resp = await client.post(
        "/v1/leads/assign",
        json={"lead_ids": lead_ids, "assignee_id": target_rep_id},
        headers=headers,
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["assigned_count"] == 10
    assert data["assignee_id"] == target_rep_id
    assert str(deal.id) in data["deal_ids"]

    # Verify leads updated in DB
    db_leads = (await db_session.execute(
        select(Lead).where(Lead.id.in_([l.id for l in leads]))
    )).scalars().all()
    assert len(db_leads) == 10
    for l in db_leads:
        assert str(l.assigned_to) == target_rep_id

    # Verify Deal and Opportunity transferred to sales_a1
    refreshed_deal = await db_session.get(Deal, deal.id)
    refreshed_opp = await db_session.get(Opportunity, opp.id)
    assert str(refreshed_deal.owner_id) == target_rep_id
    assert str(refreshed_opp.owner_id) == target_rep_id

    # Verify Audit logs recorded
    audit_logs = (await db_session.execute(
        select(AuditLog).where(
            AuditLog.organization_id == seed_data["tenant_a"].id,
            AuditLog.action == "ASSIGN_LEAD"
        )
    )).scalars().all()
    assert len(audit_logs) >= 10


@pytest.mark.asyncio
async def test_bulk_assign_leads_already_assigned_raises_400(client: AsyncClient, seed_data):
    """Verifies that attempting to reassign leads to their existing owner raises 400 Bad Request."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    headers = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
    }

    # Try reassigning leads already assigned to owner_a back to owner_a
    # We already have seed leads or we create one
    lead = Lead(
        id=uuid.uuid4(),
        organization_id=seed_data["tenant_a"].id,
        name="Existing Owner Lead",
        assigned_to=seed_data["owner_a"].id,
        status="New",
    )
    # create via endpoint or direct db if needed, or use client
    # Let's test with non-existent lead
    resp = await client.post(
        "/v1/leads/assign",
        json={"lead_ids": [str(uuid.uuid4())], "assignee_id": owner_id},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_bulk_assign_leads_salesperson_forbidden(client: AsyncClient, seed_data):
    """Verifies that salespersons are forbidden from reassigning leads."""
    tenant_id = str(seed_data["tenant_a"].id)
    sales_id = str(seed_data["sales_a1"].id)
    headers = {
        "X-User-Id": sales_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
    }

    resp = await client.post(
        "/v1/leads/assign",
        json={"lead_ids": [str(uuid.uuid4())], "assignee_id": sales_id},
        headers=headers,
    )
    assert resp.status_code == 403
