"""Integration coverage for AI CRM tool counts, filters, and tenant/role scope.

Uses synchronous SQLite behind a tiny async-session adapter so this module can
run without requiring the optional aiosqlite driver in CI.
"""
from datetime import datetime, timezone
import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from backend.app.application.context import RequestContext
from backend.app.application.services.ai_crm_tools import (
    CRM_TOOL_DEFINITIONS,
    execute_crm_tool,
    get_account_summary,
    get_campaign_performance,
    get_crm_overview,
    get_leads_summary,
    get_pipeline_summary,
    get_product_performance,
    get_team_performance,
    search_activities,
    search_contacts,
    search_deals,
    search_leads,
)
from backend.app.data.models.base import Base
from backend.app.data.models.account import Account
from backend.app.data.models.activity import Activity
from backend.app.data.models.campaign import Campaign
from backend.app.data.models.contact import Contact
from backend.app.data.models.deal import Deal, DealProduct, Opportunity, Product
from backend.app.data.models.lead import Lead, LeadConversion
from backend.app.data.models.organization import Organization
from backend.app.data.models.user import User


class AsyncSessionAdapter:
    def __init__(self, session: Session):
        self.session = session

    async def execute(self, statement):
        return self.session.execute(statement)



def dt(day: int) -> datetime:
    return datetime(2026, 11, day, 10, 0, tzinfo=timezone.utc)


@pytest.fixture
def crm_test_data():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = Session(engine)

    tenant_a = Organization(name="Tenant A", slug="tenant-a")
    tenant_b = Organization(name="Tenant B", slug="tenant-b")
    session.add_all([tenant_a, tenant_b])
    session.flush()

    owner = User(organization_id=tenant_a.id, name="Owner A", email="owner-a@test.local", role_name="owner", status="active")
    rep_a = User(organization_id=tenant_a.id, name="David Sales Alpha", email="rep-a@test.local", role_name="salesperson", status="active")
    rep_b = User(organization_id=tenant_a.id, name="Eva Sales Beta", email="rep-b@test.local", role_name="salesperson", status="active")
    owner_b = User(organization_id=tenant_b.id, name="Owner B", email="owner-b@test.local", role_name="owner", status="active")
    rep_other_tenant = User(organization_id=tenant_b.id, name="Other Tenant Rep", email="rep-b@test.local.2", role_name="salesperson", status="active")
    session.add_all([owner, rep_a, rep_b, owner_b, rep_other_tenant])
    session.flush()

    campaign_a = Campaign(organization_id=tenant_a.id, name="November Launch", type="email", status="active", budget=1000)
    campaign_b = Campaign(organization_id=tenant_a.id, name="Dormant Webinar", type="webinar", status="paused", budget=500)
    campaign_zero = Campaign(organization_id=tenant_a.id, name="Zero Lead Campaign", type="webinar", status="paused", budget=250)
    product_a = Product(organization_id=tenant_a.id, name="CRM Pro", sku="CRM-PRO", category="Software", price=100, currency="USD", is_active=True)
    product_b = Product(organization_id=tenant_a.id, name="Analytics Add-on", sku="AN-ADD", category="Analytics", price=50, currency="USD", is_active=True)
    account_a = Account(organization_id=tenant_a.id, name="Acme Industries", industry="Technology")
    account_b = Account(organization_id=tenant_a.id, name="Northwind Group", industry="Retail")
    session.add_all([campaign_a, campaign_b, campaign_zero, product_a, product_b, account_a, account_b])
    session.flush()

    lead_a = Lead(organization_id=tenant_a.id, assigned_to=rep_a.id, campaign_id=campaign_a.id,
                  product_id=product_a.id, source="Organic Search", status="Qualified",
                  name="Lead One", company="Acme Industries", score=92, created_at=dt(5))
    lead_b = Lead(organization_id=tenant_a.id, assigned_to=rep_a.id, campaign_id=campaign_b.id,
                  product_id=product_b.id, source="Referral", status="New",
                  name="Lead Two", company="Northwind Group", score=45, created_at=dt(10))
    lead_c = Lead(organization_id=tenant_a.id, assigned_to=rep_b.id, campaign_id=campaign_a.id,
                  product_id=product_a.id, source=None, status="Converted",
                  name="Lead Three", company="Acme Industries", score=81, created_at=dt(12))
    other_tenant_lead = Lead(organization_id=tenant_b.id, assigned_to=rep_other_tenant.id,
                             source="External", status="New", name="Other Tenant Lead",
                             score=99, created_at=dt(13))
    session.add_all([lead_a, lead_b, lead_c, other_tenant_lead])
    session.flush()

    opportunity = Opportunity(organization_id=tenant_a.id, account_id=account_a.id,
                              owner_id=rep_a.id, name="Acme Opportunity", amount=1200,
                              stage="Negotiation", probability=60)
    session.add(opportunity)
    session.flush()

    deal = Deal(organization_id=tenant_a.id, account_id=account_a.id, opportunity_id=opportunity.id,
                owner_id=None, name="Acme Expansion", amount=1200, currency="USD",
                stage="Negotiation", status="open", created_at=dt(7))
    other_deal = Deal(organization_id=tenant_a.id, account_id=account_b.id,
                      name="Northwind Renewal", amount=400, currency="USD",
                      stage="Qualified", status="won", owner_id=rep_b.id, created_at=dt(9))
    session.add_all([deal, other_deal])
    session.flush()
    session.add_all([
        DealProduct(deal_id=deal.id, product_id=product_a.id, quantity=2, unit_price=500, discount=10),
        DealProduct(deal_id=deal.id, product_id=product_b.id, quantity=1, unit_price=200, discount=0),
        LeadConversion(lead_id=lead_a.id, account_id=account_a.id,
                       opportunity_id=opportunity.id, conversion_type="standard"),
        Contact(account_id=account_a.id, first_name="Aarav", last_name="Patel",
                email="aarav@acme.test", title="Director", phone="123"),
        Contact(account_id=account_b.id, first_name="Nina", last_name="Shah",
                email="nina@northwind.test", title="Manager", phone="456"),
        Activity(organization_id=tenant_a.id, user_id=rep_a.id, type="meeting",
                 subject="Acme Demo", description="Product demo", status="scheduled",
                 priority="high", start_at=dt(14)),
        Activity(organization_id=tenant_a.id, user_id=rep_b.id, type="task",
                 subject="Northwind Follow-up", description="Send quote", status="completed",
                 priority="medium", start_at=dt(15)),
    ])
    session.commit()

    data = {
        "engine": engine,
        "sync_session": session,
        "session": AsyncSessionAdapter(session),
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "owner": owner,
        "rep_a": rep_a,
        "rep_b": rep_b,
        "campaign_a": campaign_a,
        "campaign_b": campaign_b,
        "campaign_zero": campaign_zero,
        "product_a": product_a,
        "product_b": product_b,
        "account_a": account_a,
        "account_b": account_b,
        "lead_a": lead_a,
        "lead_b": lead_b,
        "lead_c": lead_c,
        "deal": deal,
        "opportunity": opportunity,
        "ctx_owner": RequestContext(user_id=str(owner.id), tenant_id=str(tenant_a.id), role="owner"),
        "ctx_rep_a": RequestContext(user_id=str(rep_a.id), tenant_id=str(tenant_a.id), role="salesperson"),
    }
    yield data
    session.close()
    engine.dispose()


@pytest.mark.asyncio
async def test_plain_lead_count_is_fast_and_does_not_run_breakdown_queries(crm_test_data):
    data = crm_test_data
    statements = []

    def before_cursor_execute(_conn, _cursor, statement, _parameters, _context, _executemany):
        if statement.lstrip().lower().startswith("select"):
            statements.append(statement)

    event.listen(data["engine"], "before_cursor_execute", before_cursor_execute)
    try:
        result = await get_leads_summary(data["session"], data["ctx_owner"], {})
    finally:
        event.remove(data["engine"], "before_cursor_execute", before_cursor_execute)

    assert result["total_leads"] == 3
    assert result["total_count"] == 3
    assert result["breakdown_by"] == "none"
    assert result["by_source"] == {}
    assert len(statements) == 1
    assert "GROUP BY" not in statements[0].upper()


@pytest.mark.asyncio
async def test_lead_source_breakdown_groups_raw_column_and_normalizes_missing_values(crm_test_data):
    data = crm_test_data
    result = await get_leads_summary(data["session"], data["ctx_owner"], {"breakdown_by": "source"})
    assert result["total_leads"] == 3
    assert result["by_source"] == {
        "Organic Search": 1,
        "Referral": 1,
        "Direct / Referral": 1,
    }


@pytest.mark.asyncio
async def test_lead_filters_compose_status_source_campaign_product_assignee_score_and_dates(crm_test_data):
    data = crm_test_data
    result = await search_leads(data["session"], data["ctx_owner"], {
        "status": "qualified", "source": "organic search",
        "campaign": "November Launch", "product": "CRM Pro",
        "assigned_to": str(data["lead_a"].assigned_to),
        "min_score": 80, "max_score": 100,
        "created_after": "2026-11-01", "created_before": "2026-11-08", "limit": 10,
    })
    assert result["total"] == 1
    assert result["records"][0]["name"] == "Lead One"


@pytest.mark.asyncio
async def test_lead_summary_filters_and_role_scope(crm_test_data):
    data = crm_test_data
    result = await get_leads_summary(data["session"], data["ctx_rep_a"], {"status": "New"})
    assert result["total_leads"] == 1
    assert result["qualified_leads_count"] == 0




@pytest.mark.asyncio
async def test_lead_summary_supports_assignee_score_and_text_filters(crm_test_data):
    data = crm_test_data
    result = await get_leads_summary(data["session"], data["ctx_owner"], {
        "status": "Qualified",
        "assigned_to": str(data["rep_a"].id),
        "min_score": 90,
        "search": "Lead One",
        "breakdown_by": "all",
    })
    assert result["total_leads"] == 1
    assert result["by_status"] == {"Qualified": 1}
    assert result["by_source"] == {"Organic Search": 1}


@pytest.mark.asyncio
async def test_lead_search_matches_email_and_phone(crm_test_data):
    data = crm_test_data
    data["lead_a"].email = "lead.one@acme.test"
    data["lead_a"].phone = "555-0101"
    data["sync_session"].commit()
    email_result = await search_leads(data["session"], data["ctx_owner"], {"search": "lead.one@acme.test"})
    phone_result = await search_leads(data["session"], data["ctx_owner"], {"search": "555-0101"})
    assert email_result["total"] == 1
    assert phone_result["total"] == 1


@pytest.mark.asyncio
async def test_team_performance_rep_filter(crm_test_data):
    data = crm_test_data
    result = await get_team_performance(data["session"], data["ctx_owner"], {"rep": "David Sales Alpha"})
    assert result["total_reps"] == 1
    assert result["performers"][0]["name"] == "David Sales Alpha"
    email_result = await get_team_performance(data["session"], data["ctx_owner"], {"rep": data["rep_a"].email})
    assert email_result["total_reps"] == 1
    assert email_result["performers"][0]["name"] == "David Sales Alpha"


@pytest.mark.asyncio
async def test_overview_and_team_keep_mixed_currencies_separate(crm_test_data):
    data = crm_test_data
    extra_deal = Deal(
        organization_id=data["tenant_a"].id,
        account_id=data["account_b"].id,
        owner_id=data["rep_b"].id,
        name="INR Expansion",
        amount=5000,
        currency="INR",
        stage="Won",
        status="won",
        created_at=dt(2),
    )
    data["sync_session"].add(extra_deal)
    data["sync_session"].commit()

    overview = await get_crm_overview(data["session"], data["ctx_owner"], {})
    assert overview["total_deals_count"] == 3
    assert overview["active_pipeline_value"] is None
    assert {row["currency"] for row in overview["active_pipeline_value_by_currency"]} == {"USD", "INR"}
    assert overview["currency_note"]

    team = await get_team_performance(data["session"], data["ctx_owner"], {})
    assert team["total_team_won_revenue"] is None
    assert {row["currency"] for row in team["total_team_won_revenue_by_currency"]} == {"USD", "INR"}
    assert all(rep["won_revenue"] is None for rep in team["performers"])


@pytest.mark.asyncio
async def test_invalid_lead_breakdown_and_date_ranges_return_validation_errors(crm_test_data):
    data = crm_test_data
    bad_breakdown = await execute_crm_tool(
        data["session"], data["ctx_owner"], "get_leads_summary", {"breakdown_by": "owner"}
    )
    bad_dates = await execute_crm_tool(
        data["session"], data["ctx_owner"], "search_leads", {"created_after": "not-a-date"}
    )
    assert "breakdown_by" in bad_breakdown["error"]
    assert "ISO format" in bad_dates["error"]


@pytest.mark.asyncio
async def test_deal_filters_and_full_filtered_total_amount(crm_test_data):
    data = crm_test_data
    result = await search_deals(data["session"], data["ctx_owner"], {
        "stage": "negotiation", "status": "OPEN", "currency": "usd",
        "account": "Acme", "campaign": "November Launch", "product": "CRM Pro",
        "owner": str(data["opportunity"].owner_id),
        "min_amount": 1000, "max_amount": 1500,
        "search": "Expansion", "created_after": "2026-11-01",
        "created_before": "2026-11-10", "limit": 1,
    })
    assert result["total"] == 1
    assert result["total_amount"] == 1200.0
    assert result["total_amount_by_currency"] == [{"currency": "USD", "amount": 1200.0}]
    assert result["records"][0]["deal"] == "Acme Expansion"


@pytest.mark.asyncio
async def test_pipeline_filters_stage_status_currency_and_amount(crm_test_data):
    data = crm_test_data
    result = await get_pipeline_summary(data["session"], data["ctx_owner"], {
        "stage": "Negotiation", "status": "open", "currency": "USD",
        "min_amount": 1000, "max_amount": 1300,
    })
    assert len(result["by_stage"]) == 1
    assert result["by_stage"][0]["deal_count"] == 1
    assert result["by_stage"][0]["pipeline_value"] == 1200.0
    assert result["weighted_value_by_currency"][0]["weighted_pipeline_value"] == 720.0


@pytest.mark.asyncio
async def test_campaign_filters_include_campaigns_without_leads(crm_test_data):
    data = crm_test_data
    result = await get_campaign_performance(data["session"], data["ctx_owner"], {
        "campaign": "Zero Lead", "status": "paused", "limit": 10,
    })
    assert result["total_campaigns"] == 1
    assert result["total_returned"] == 1
    assert result["campaigns"][0]["campaign"] == "Zero Lead Campaign"
    assert result["campaigns"][0]["lead_count"] == 0


@pytest.mark.asyncio
async def test_campaign_performance_respects_role_visible_lead_scope(crm_test_data):
    data = crm_test_data
    owner_result = await get_campaign_performance(data["session"], data["ctx_owner"], {})
    rep_result = await get_campaign_performance(data["session"], data["ctx_rep_a"], {})

    assert owner_result["total_campaigns"] == 3
    assert rep_result["total_campaigns"] == 2
    assert {item["campaign"] for item in rep_result["campaigns"]} == {
        "November Launch", "Dormant Webinar"
    }


@pytest.mark.asyncio
async def test_product_filter_uses_deal_line_items_and_lead_filters(crm_test_data):
    data = crm_test_data
    result = await get_product_performance(data["session"], data["ctx_owner"], {
        "product": "CRM Pro", "created_after": "2026-11-01",
        "created_before": "2026-11-10",
    })
    product = result["products"][0]
    assert product["product"] == "CRM Pro"
    assert product["lead_count"] == 1
    assert product["deal_count"] == 1
    assert product["deal_totals_by_currency"][0]["deal_value"] == 900.0


@pytest.mark.asyncio
async def test_account_filter_returns_only_matching_account(crm_test_data):
    data = crm_test_data
    result = await get_account_summary(data["session"], data["ctx_owner"], {"account": "Acme"})
    assert result["total_accounts"] == 1
    assert result["total_returned"] == 1
    assert len(result["accounts"]) == 1
    assert result["accounts"][0]["account"] == "Acme Industries"


@pytest.mark.asyncio
async def test_contact_search_filter_and_visible_lead_account_scope(crm_test_data):
    data = crm_test_data
    result = await search_contacts(data["session"], data["ctx_rep_a"], {"search": "Aarav", "account": "Acme"})
    assert result["total_contacts"] == 1
    assert result["returned"] == 1
    assert result["contacts"][0]["email"] == "aarav@acme.test"


@pytest.mark.asyncio
async def test_activity_filters_type_status_priority_search_and_date(crm_test_data):
    data = crm_test_data
    result = await search_activities(data["session"], data["ctx_rep_a"], {
        "type": "MEETING", "status": "scheduled", "priority": "high",
        "search": "Demo", "created_after": "2026-11-13",
        "created_before": "2026-11-15", "limit": 10,
    })
    assert result["total_activities"] == 1
    assert result["returned"] == 1
    assert result["activities"][0]["subject"] == "Acme Demo"


@pytest.mark.asyncio
async def test_limited_tool_results_report_full_filtered_totals(crm_test_data):
    data = crm_test_data

    campaigns = await get_campaign_performance(data["session"], data["ctx_owner"], {"limit": 1})
    products = await get_product_performance(data["session"], data["ctx_owner"], {"limit": 1})
    accounts = await get_account_summary(data["session"], data["ctx_owner"], {"limit": 1})
    contacts = await search_contacts(data["session"], data["ctx_owner"], {"limit": 1})
    activities = await search_activities(data["session"], data["ctx_owner"], {"limit": 1})

    assert campaigns["total_campaigns"] == 3 and campaigns["total_returned"] == 1
    assert products["total_products"] == 2 and products["total_returned"] == 1
    assert accounts["total_accounts"] == 2 and accounts["total_returned"] == 1
    assert contacts["total_contacts"] == 2 and contacts["returned"] == 1
    assert activities["total_activities"] == 2 and activities["returned"] == 1


@pytest.mark.asyncio
async def test_team_performance_attributes_deals_to_opportunity_owner(crm_test_data):
    data = crm_test_data
    result = await get_team_performance(data["session"], data["ctx_owner"], {})
    owner_row = next(item for item in result["performers"] if item["name"] == "David Sales Alpha")
    assert owner_row["total_deals"] == 1
    assert owner_row["pipeline_value"] == 1200.0


@pytest.mark.asyncio
async def test_overview_returns_tenant_scoped_lead_and_deal_totals(crm_test_data):
    data = crm_test_data
    result = await get_crm_overview(data["session"], data["ctx_owner"], {})
    assert result["total_leads_count"] == 3
    assert result["total_deals_count"] == 2


def test_tool_registry_matches_all_eleven_tools_and_exposes_filter_schemas():
    definitions = {item["function"]["name"]: item["function"]["parameters"] for item in CRM_TOOL_DEFINITIONS}
    assert set(definitions) == {
        "get_crm_overview", "get_leads_summary", "get_team_performance",
        "get_pipeline_summary", "search_leads", "search_deals",
        "get_campaign_performance", "get_product_performance",
        "get_account_summary", "search_contacts", "search_activities",
    }
    assert definitions["get_leads_summary"]["properties"]["breakdown_by"]["enum"] == ["none", "source", "status", "all"]
    assert "assigned_to" in definitions["get_leads_summary"]["properties"]
    assert "min_score" in definitions["get_leads_summary"]["properties"]
    assert "rep" in definitions["get_team_performance"]["properties"]
    assert "created_after" in definitions["search_leads"]["properties"]
    assert "max_amount" in definitions["search_deals"]["properties"]
    assert all(item["type"] == "function" for item in CRM_TOOL_DEFINITIONS)


@pytest.mark.asyncio
async def test_unknown_tool_and_malformed_args_fail_safely(crm_test_data):
    data = crm_test_data
    assert await execute_crm_tool(data["session"], data["ctx_owner"], "run_sql", {}) == {"error": "Unknown CRM data tool"}
    assert await execute_crm_tool(data["session"], data["ctx_owner"], "get_leads_summary", []) == {"error": "Tool arguments must be an object"}
