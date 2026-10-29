import uuid
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.application.context import RequestContext
from backend.app.application.services.lead_service import LeadService
from backend.app.application.services.deal_service import DealService
from backend.app.application.services.account_service import AccountService
from backend.app.application.exceptions import ConflictError
from backend.app.data.models.lead import Lead, LeadSignal
from backend.app.data.models.deal import Deal
from backend.app.data.models.account import Account
from backend.app.data.models.contact import Contact


# ---------------------------------------------------------------------------
# Test 1: Same email with different capitalization and surrounding whitespace
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_lead_email_normalization_and_whitespace(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    # Lead A: Dinesh with uppercase and whitespace
    lead_a = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="  Dinesh@Microsoft.com  ",
        title="CEO",
    )
    await db_session.flush()

    assert lead_a.email == "dinesh@microsoft.com"

    # Lead B: duplicate check with lowercase and no whitespace
    dup_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        email="dinesh@microsoft.com",
        company="Microsoft",
        title="Sales Director",
    )
    assert dup_check is not None
    assert dup_check["is_duplicate_warning"] is True
    assert dup_check["existing_lead_id"] == str(lead_a.id)

    # Attempting to create duplicate without allow_separate_inquiry raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await lead_service.create_lead(
            ctx=ctx_owner_a,
            name="Dinesh",
            company="Microsoft",
            email="dinesh@microsoft.com",
            title="Sales Director",
            allow_separate_inquiry=False,
        )
    assert "already exists" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Test 2: Same person and inquiry with different job titles
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_lead_different_job_title_does_not_make_unique(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    lead_a = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
        title="CEO",
    )
    await db_session.flush()

    # Even with a different job title, system flags it as duplicate
    dup_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        email="Dinesh@microsoft.com",
        company="Microsoft",
        title="Senior Vice President of Engineering",
    )
    assert dup_check is not None
    assert dup_check["is_duplicate_warning"] is True
    assert "different job title" in dup_check["warning_message"].lower()


# ---------------------------------------------------------------------------
# Test 3: Same person submitting a genuinely separate inquiry
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_separate_inquiry_preserved_without_deleting_prior(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    lead_1 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
        title="CEO",
    )
    await db_session.flush()

    # Confirmed separate inquiry
    lead_2 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
        title="Sales Director",
        allow_separate_inquiry=True,
    )
    await db_session.flush()

    assert lead_1.id != lead_2.id
    # CRITICAL: Verify neither lead was soft-deleted!
    fresh_lead_1 = await db_session.get(Lead, lead_1.id)
    fresh_lead_2 = await db_session.get(Lead, lead_2.id)
    assert fresh_lead_1.deleted_at is None
    assert fresh_lead_2.deleted_at is None

    # Check signal on lead 2
    signals = (await db_session.execute(select(LeadSignal).where(LeadSignal.lead_id == lead_2.id))).scalars().all()
    assert any(s.signal_type == "separate_inquiry" for s in signals)


# ---------------------------------------------------------------------------
# Test 4: Duplicate Lead submission after the original Lead has been converted
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_duplicate_lead_submission_after_conversion(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    # 1. Create and convert original lead
    lead_1 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
        title="CEO",
    )
    await db_session.flush()

    conv_res = await lead_service.convert_lead(
        ctx=ctx_owner_a,
        lead_id=lead_1.id,
        deal_name="Microsoft - CRM subscription",
        deal_amount=45000.0,
    )
    await db_session.flush()
    assert conv_res["contact_id"] is not None

    # Verify original lead is Converted and NOT deleted
    l1 = await db_session.get(Lead, lead_1.id)
    assert l1.status == "Converted"
    assert l1.deleted_at is None

    # 2. Check duplicate advisor for converted lead
    dup_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        email="dinesh@microsoft.com",
    )
    # Identifies existing Contact!
    assert dup_check is not None
    assert dup_check.get("has_existing_contact") is True
    assert dup_check.get("existing_contact_id") == str(conv_res["contact_id"])

    # 3. New lead submitted for the returning contact
    lead_2 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
        title="Board Member",
    )
    await db_session.flush()

    # Original lead remains intact and not soft-deleted
    l1_after = await db_session.get(Lead, lead_1.id)
    assert l1_after.deleted_at is None
    assert l1_after.status == "Converted"


# ---------------------------------------------------------------------------
# Test 5: Returning Lead after 30 days
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_returning_lead_after_30_days(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    # Stale lead created 45 days ago
    lead_1 = Lead(
        organization_id=ctx_owner_a.tenant_uuid,
        name="Rahul Sharma",
        company="ABC Technologies",
        email="rahul@abc.com",
        status="New",
        created_at=datetime.now(timezone.utc) - timedelta(days=45),
    )
    db_session.add(lead_1)
    await db_session.flush()

    # Lead returns with new inquiry after 45 days
    lead_2 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Rahul Sharma",
        company="ABC Technologies",
        email="rahul@abc.com",
    )
    await db_session.flush()

    # Both records remain in database (lead 1 is not deleted)
    l1 = await db_session.get(Lead, lead_1.id)
    l2 = await db_session.get(Lead, lead_2.id)
    assert l1.deleted_at is None
    assert l2.deleted_at is None
    assert l1.id != l2.id


# ---------------------------------------------------------------------------
# Test 6: Same customer, same product, and same active opportunity
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_duplicate_deal_warning_on_same_active_opportunity(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # Active opportunity in Negotiation stage
    deal_1 = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Negotiation",
    )
    await db_session.flush()

    # Duplicate check for new deal
    dup_check = await deal_service.check_duplicate_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
    )
    assert dup_check is not None
    assert dup_check["is_duplicate_warning"] is True
    assert dup_check["existing_deal_id"] == str(deal_1.id)
    assert dup_check["existing_stage"] == "Negotiation"
    assert dup_check["existing_amount"] == 45000.0


# ---------------------------------------------------------------------------
# Test 7: Same customer and product with a distinct opportunity
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_distinct_deal_opportunity_reference(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Negotiation",
    )
    await db_session.flush()

    # When an opportunity_reference denoting a distinct project/order is supplied:
    dup_check = await deal_service.check_duplicate_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        opportunity_reference="PO-2026-DISTINCT-001",
    )
    assert dup_check["is_duplicate_warning"] is False
    assert dup_check.get("is_distinct_opportunity") is True


# ---------------------------------------------------------------------------
# Test 8: New purchase after a Closed Lost Deal
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_new_purchase_after_closed_lost_deal(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # Historical Closed Lost deal
    lost_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Lost",
    )
    await db_session.flush()

    # New deal inquiry for same product
    dup_check = await deal_service.check_duplicate_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
    )
    # Closed Lost deal NEVER triggers duplicate warning
    assert dup_check is None

    # New deal can be created cleanly
    new_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=50000.0,
        stage="Qualified",
    )
    await db_session.flush()

    # Both deals exist in database
    d_lost = await db_session.get(Deal, lost_deal.id)
    d_new = await db_session.get(Deal, new_deal.id)
    assert d_lost.stage == "Lost"
    assert d_new.stage == "Qualified"


# ---------------------------------------------------------------------------
# Test 9: New purchase after a Closed Won Deal
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_new_purchase_after_closed_won_deal(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # Historical Closed Won deal
    won_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Won",
    )
    await db_session.flush()

    # Customer returns for a renewal / new purchase
    dup_check = await deal_service.check_duplicate_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
    )
    # Closed Won deal NEVER triggers duplicate warning
    assert dup_check is None

    renewal_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=48000.0,
        stage="Proposal",
    )
    await db_session.flush()

    assert (await db_session.get(Deal, won_deal.id)).stage == "Won"
    assert (await db_session.get(Deal, renewal_deal.id)).stage == "Proposal"


# ---------------------------------------------------------------------------
# Test 10: Additional licenses for the same product
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_additional_licenses_opportunity(db_session: AsyncSession, ctx_owner_a: RequestContext):
    deal_service = DealService(db_session)
    acc_service = AccountService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # Main active subscription
    await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Negotiation",
    )
    await db_session.flush()

    # Add-on licenses with explicit reference
    dup_check = await deal_service.check_duplicate_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription - Addon 50 Seats",
        opportunity_reference="ADDON-50-LICENSES",
    )
    assert dup_check["is_duplicate_warning"] is False


# ---------------------------------------------------------------------------
# Test 11: Concurrent submissions attempting to create the same record
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_concurrency_protection_on_contacts(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # First contact
    c1 = Contact(
        account_id=acc.id,
        first_name="Dinesh",
        last_name="",
        email="dinesh@microsoft.com",
    )
    db_session.add(c1)
    await db_session.flush()

    # Attempting to insert a duplicate active contact with the exact same account and email
    # Contact deduplication in contact_repo / lead_service prevents duplicate creation:
    from backend.app.data.repositories.contact_repository import ContactRepository
    con_repo = ContactRepository(db_session)
    existing_c = await con_repo.get_by_normalized_email(
        tenant_id=ctx_owner_a.tenant_id,
        email="  DINESH@MICROSOFT.COM  ",
        account_id=acc.id,
    )
    assert existing_c is not None
    assert existing_c.id == c1.id


# ---------------------------------------------------------------------------
# Test 12: Unauthorized users attempting to access duplicate-record details
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unauthorized_user_duplicate_check_data_leakage(
    db_session: AsyncSession,
    ctx_sales_a1: RequestContext,
    ctx_sales_a2: RequestContext,
):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)
    lead_service = LeadService(db_session)

    acc = await acc_service.create_account(ctx_sales_a1, name="Confidential Corp")
    await db_session.flush()

    # Rep 1 creates an active deal
    deal_1 = await deal_service.create_deal(
        ctx=ctx_sales_a1,
        account_id=acc.id,
        name="Top Secret Project",
        amount=99000.0,
        stage="Negotiation",
    )
    await db_session.flush()

    # Rep 2 checks duplicate deal on this account
    dup_deal = await deal_service.check_duplicate_deal(
        ctx=ctx_sales_a2,
        account_id=acc.id,
        name="Top Secret Project",
    )
    assert dup_deal is not None
    assert dup_deal["is_duplicate_warning"] is True
    # CRITICAL SECURITY CHECK: Sensitive details must be redacted for unauthorized reps!
    assert dup_deal.get("is_restricted") is True
    assert "existing_deal_id" not in dup_deal
    assert "existing_deal_name" not in dup_deal
    assert "existing_amount" not in dup_deal
    assert "another sales representative" in dup_deal["warning_message"]

    # Rep 1 creates an active lead
    lead_1 = await lead_service.create_lead(
        ctx=ctx_sales_a1,
        name="Private Executive",
        company="Confidential Corp",
        email="exec@confidential.com",
        assigned_to=ctx_sales_a1.user_uuid,
    )
    await db_session.flush()

    # Rep 2 checks duplicate lead
    dup_lead = await lead_service.check_duplicate_lead(
        ctx=ctx_sales_a2,
        email="exec@confidential.com",
    )
    assert dup_lead is not None
    assert dup_lead["is_duplicate_warning"] is True
    assert dup_lead.get("is_restricted") is True
    assert "existing_lead_id" not in dup_lead
    assert "another team member" in dup_lead["warning_message"]


# ---------------------------------------------------------------------------
# Test 13: Cross-tenant duplicate detection and data isolation
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cross_tenant_isolation(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
    ctx_owner_b: RequestContext,
):
    lead_service = LeadService(db_session)

    # Tenant A creates lead
    lead_a = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
    )
    await db_session.flush()

    # Tenant B checks duplicate with exact same email
    dup_check_b = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_b,
        email="dinesh@microsoft.com",
    )
    # Tenant B must NOT detect Tenant A's lead!
    assert dup_check_b is None

    # Tenant B can create their own Dinesh with same email without conflict
    lead_b = await lead_service.create_lead(
        ctx=ctx_owner_b,
        name="Dinesh",
        company="Microsoft",
        email="dinesh@microsoft.com",
    )
    await db_session.flush()

    assert lead_a.organization_id != lead_b.organization_id


# ---------------------------------------------------------------------------
# Test 14: Lead conversion without creating duplicate Contacts or Accounts
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_lead_conversion_deduplication(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    # Lead 1
    l1 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Rahul Sharma",
        company="ABC Technologies",
        email="rahul@abc.com",
    )
    await db_session.flush()

    # Lead 2 (from same company)
    l2 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Priya Kumar",
        company="ABC Technologies",
        email="priya@abc.com",
    )
    await db_session.flush()

    # Convert Lead 1
    res1 = await lead_service.convert_lead(ctx=ctx_owner_a, lead_id=l1.id)
    await db_session.flush()

    # Convert Lead 2
    res2 = await lead_service.convert_lead(ctx=ctx_owner_a, lead_id=l2.id)
    await db_session.flush()

    # Same Account reused for both!
    assert res1["account_id"] == res2["account_id"]

    # Two separate Contacts created
    assert res1["contact_id"] != res2["contact_id"]

    # Now Rahul submits another inquiry after conversion and is converted again
    l3 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Rahul Sharma",
        company="ABC Technologies",
        email="rahul@abc.com",
        title="Senior Director",
    )
    await db_session.flush()

    res3 = await lead_service.convert_lead(ctx=ctx_owner_a, lead_id=l3.id)
    await db_session.flush()

    # Rahul's Contact is REUSED, NOT DUPLICATED!
    assert res3["contact_id"] == res1["contact_id"]


# ---------------------------------------------------------------------------
# Test 15: Existing historical Deals remaining intact
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_historical_deals_remain_intact(db_session: AsyncSession, ctx_owner_a: RequestContext):
    acc_service = AccountService(db_session)
    deal_service = DealService(db_session)

    acc = await acc_service.create_account(ctx_owner_a, name="Microsoft")
    await db_session.flush()

    # 1. Historical Won Deal ($45,000)
    won_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - CRM subscription",
        amount=45000.0,
        stage="Won",
    )
    await db_session.flush()

    # 2. Historical Lost Deal ($20,000)
    lost_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - Support Package",
        amount=20000.0,
        stage="Lost",
    )
    await db_session.flush()

    # 3. New Active Deal ($60,000)
    active_deal = await deal_service.create_deal(
        ctx=ctx_owner_a,
        account_id=acc.id,
        name="Microsoft - Enterprise AI Suite",
        amount=60000.0,
        stage="Negotiation",
    )
    await db_session.flush()

    # Verify all 3 deals remain in database with correct stages and amounts
    d_won = await db_session.get(Deal, won_deal.id)
    d_lost = await db_session.get(Deal, lost_deal.id)
    d_act = await db_session.get(Deal, active_deal.id)

    assert d_won.stage == "Won" and float(d_won.amount) == 45000.0 and d_won.deleted_at is None
    assert d_lost.stage == "Lost" and float(d_lost.amount) == 20000.0 and d_lost.deleted_at is None
    assert d_act.stage == "Negotiation" and float(d_act.amount) == 60000.0 and d_act.deleted_at is None


# ---------------------------------------------------------------------------
# Test 16: Salesperson Type-to-Create Product Linking with Catalog UUID & SKU
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_salesperson_type_to_create_product_linking(db_session: AsyncSession, ctx_owner_a: RequestContext):
    from backend.app.data.models.deal import Product

    lead_service = LeadService(db_session)

    # 1. Salesperson types a custom product name: "AI Predictive Analytics Suite"
    lead = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Vikram Sethi",
        company="Global Logistics Corp",
        email="vikram@globallogistics.com",
        title="VP Operations",
        interested_product="AI Predictive Analytics Suite",
    )
    await db_session.flush()

    # Verify lead has both interested_product and resolved product_id
    assert lead.interested_product == "AI Predictive Analytics Suite"
    assert lead.product_id is not None

    # Verify the product was saved to the products table with SKU and ID
    prod_stmt = select(Product).where(Product.id == lead.product_id)
    prod_res = await db_session.execute(prod_stmt)
    prod = prod_res.scalar_one_or_none()

    assert prod is not None
    assert prod.name == "AI Predictive Analytics Suite"
    assert prod.sku is not None
    assert prod.sku.startswith("SKU-")
    assert prod.organization_id == ctx_owner_a.tenant_uuid

    # 2. On subsequent lead creation, selecting the same product by name or ID links to the same catalog product
    lead_2 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Ananya Roy",
        company="Global Logistics Corp",
        email="ananya@globallogistics.com",
        title="CTO",
        interested_product="AI Predictive Analytics Suite",
    )
    await db_session.flush()

    assert lead_2.product_id == prod.id
    assert lead_2.interested_product == "AI Predictive Analytics Suite"


# ---------------------------------------------------------------------------
# Test 17: Product-Aware Duplicate Detection (name + email + interested_product)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_product_aware_lead_duplicate_detection(db_session: AsyncSession, ctx_owner_a: RequestContext):
    lead_service = LeadService(db_session)

    # 1. Create an active lead for "Fleet Telematics"
    lead_1 = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Karan Mehta",
        company="Nexus Logistics",
        email="karan@nexus.com",
        title="Head of Supply Chain",
        interested_product="Fleet Telematics",
    )
    await db_session.flush()

    # 2. Same email + SAME product -> Flagged as duplicate warning
    same_prod_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        email="karan@nexus.com",
        company="Nexus Logistics",
        title="VP Supply Chain",
        interested_product="Fleet Telematics",
    )
    assert same_prod_check is not None
    assert same_prod_check["is_duplicate_warning"] is True
    assert same_prod_check["existing_lead_id"] == str(lead_1.id)

    # 3. Same email + DIFFERENT product -> Valid Cross-Sell Opportunity (NOT blocked as duplicate)
    diff_prod_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        email="karan@nexus.com",
        company="Nexus Logistics",
        title="VP Supply Chain",
        interested_product="Autonomous Route Planning",
    )
    assert diff_prod_check is not None
    assert diff_prod_check["is_duplicate_warning"] is False
    assert diff_prod_check.get("is_cross_sell") is True
    assert "cross-sell" in diff_prod_check["notice_message"].lower()

    # 4. Creating the cross-sell lead succeeds cleanly
    cross_sell_lead = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Karan Mehta",
        company="Nexus Logistics",
        email="karan@nexus.com",
        title="VP Supply Chain",
        interested_product="Autonomous Route Planning",
    )
    await db_session.flush()

    assert cross_sell_lead.id != lead_1.id
    assert cross_sell_lead.interested_product == "Autonomous Route Planning"
    assert lead_1.interested_product == "Fleet Telematics"

