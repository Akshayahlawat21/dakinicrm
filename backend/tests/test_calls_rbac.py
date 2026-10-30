import pytest
import uuid
from httpx import AsyncClient
from backend.app.data.models.lead import Lead
from backend.app.data.models.deal import Product


@pytest.mark.asyncio
async def test_call_ingest_and_fetch_db(client: AsyncClient, seed_data, db_session):
    """Verifies storing call transcript and analysis to DB and fetching them back."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_call_test_1",
    }

    # 1. Create a Product and a Lead
    prod = Product(
        organization_id=seed_data["tenant_a"].id,
        name="AI Telematics Suite",
        sku="SKU-TELEM-01",
        price=1500.0,
        currency="USD",
        is_active=True,
    )
    db_session.add(prod)
    await db_session.flush()

    lead = Lead(
        organization_id=seed_data["tenant_a"].id,
        name="Vikram Seth",
        email="vikram@logistics.in",
        phone="+91 99887 76655",
        status="New",
        product_id=prod.id,
        interested_product=prod.name,
    )
    db_session.add(lead)
    await db_session.commit()

    # 2. Ingest Call Transcript & Analysis to DB
    ingest_payload = {
        "raw_text": "Agent: Hi Vikram, checking on your fleet telematics setup. Customer: Yes, we want to proceed with 50 vehicles.",
        "lead_id": str(lead.id),
        "subject": "Discovery Call with Vikram",
        "external_call_id": "sid_twilio_call_12345",
        "duration_seconds": 185,
        "sentiment": "positive",
        "call_outcome": "demo_scheduled",
        "summary": {
            "key_signals": ["Expanding fleet by 50 units", "Wants pricing quote"],
            "pain_points": ["Current tracking software disconnects frequently"],
        },
        "improvements": {
            "coaching_tips": ["Mention the 99.9% uptime SLA earlier in the call"],
        },
        "model_version": "gemini-2.0-flash",
    }

    resp = await client.post("/v1/calls/ingest", json=ingest_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    analysis_id = data["id"]
    assert data["sentiment"] == "positive"
    assert data["call_outcome"] == "demo_scheduled"
    assert data["lead_name"] == "Vikram Seth"
    assert data["product_name"] == "AI Telematics Suite"

    # 3. Fetch from DB
    get_resp = await client.get(f"/v1/calls/analysis/{analysis_id}", headers=headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()["data"]
    assert fetched["id"] == analysis_id
    assert fetched["summary"]["key_signals"] == ["Expanding fleet by 50 units", "Wants pricing quote"]

    # 4. Filter by Product ID (resolved through leads)
    filter_resp = await client.get(f"/v1/calls/analysis?product_id={prod.id}", headers=headers)
    assert filter_resp.status_code == 200
    list_data = filter_resp.json()
    assert list_data["total"] >= 1
    assert any(item["id"] == analysis_id for item in list_data["data"])

    # 5. Get Metrics
    metrics_resp = await client.get("/v1/calls/metrics", headers=headers)
    assert metrics_resp.status_code == 200
    metrics = metrics_resp.json()["data"]
    assert metrics["total_analyses"] >= 1
    assert metrics["sentiment_distribution"]["positive"] >= 1


@pytest.mark.asyncio
async def test_call_analysis_rbac_isolation(client: AsyncClient, seed_data, db_session):
    """
    Verifies RBAC rules on Call Analysis:
    - Owner: Sees all records in organization
    - Manager: Sees team member's calls, but cannot see other teams' calls
    - Salesperson: Sees ONLY their own calls
    """
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    mgr_alpha_id = str(seed_data["manager_a1"].id)
    sales_alpha_id = str(seed_data["sales_a1"].id)
    sales_beta_id = str(seed_data["sales_a2"].id)

    sales_alpha_headers = {
        "X-User-Id": sales_alpha_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
        "X-Correlation-ID": "req_sales_alpha",
    }

    sales_beta_headers = {
        "X-User-Id": sales_beta_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
        "X-Correlation-ID": "req_sales_beta",
    }

    mgr_alpha_headers = {
        "X-User-Id": mgr_alpha_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "manager",
        "X-Correlation-ID": "req_mgr_alpha",
    }

    owner_headers = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_owner",
    }

    # 1. Salesperson Alpha ingests a call
    resp_alpha = await client.post(
        "/v1/calls/ingest",
        json={
            "raw_text": "Sales Alpha call transcript",
            "subject": "Alpha Call 1",
            "sentiment": "positive",
            "call_outcome": "qualified",
        },
        headers=sales_alpha_headers,
    )
    assert resp_alpha.status_code == 200
    alpha_analysis_id = resp_alpha.json()["data"]["id"]

    # 2. Salesperson Beta ingests a call
    resp_beta = await client.post(
        "/v1/calls/ingest",
        json={
            "raw_text": "Sales Beta call transcript",
            "subject": "Beta Call 1",
            "sentiment": "negative",
            "call_outcome": "lost",
        },
        headers=sales_beta_headers,
    )
    assert resp_beta.status_code == 200
    beta_analysis_id = resp_beta.json()["data"]["id"]

    # 3. Salesperson Alpha lists analyses: Should see Alpha's call, NOT Beta's
    list_alpha = await client.get("/v1/calls/analysis", headers=sales_alpha_headers)
    assert list_alpha.status_code == 200
    ids_alpha = [a["id"] for a in list_alpha.json()["data"]]
    assert alpha_analysis_id in ids_alpha
    assert beta_analysis_id not in ids_alpha

    # 4. Salesperson Alpha directly accessing Beta's call: Should be forbidden (403)
    get_beta_by_alpha = await client.get(f"/v1/calls/analysis/{beta_analysis_id}", headers=sales_alpha_headers)
    assert get_beta_by_alpha.status_code == 403

    # 5. Manager Alpha (leads Alpha team): Should see Alpha's call, NOT Beta team's call
    list_mgr = await client.get("/v1/calls/analysis", headers=mgr_alpha_headers)
    assert list_mgr.status_code == 200
    ids_mgr = [a["id"] for a in list_mgr.json()["data"]]
    assert alpha_analysis_id in ids_mgr
    assert beta_analysis_id not in ids_mgr

    # 6. Owner: Sees both Alpha's and Beta's calls
    list_owner = await client.get("/v1/calls/analysis", headers=owner_headers)
    assert list_owner.status_code == 200
    ids_owner = [a["id"] for a in list_owner.json()["data"]]
    assert alpha_analysis_id in ids_owner
    assert beta_analysis_id in ids_owner



@pytest.mark.asyncio
async def test_amal_and_babu_lead_rbac_isolation(client: AsyncClient, seed_data, db_session):
    """
    Direct verification of user's exact scenario:
    - Lead 'amal' is owned by Owner Alice
    - Lead 'babu' is owned by Salesperson David
    - Salesperson David queries call analyses -> MUST see 'babu', CANNOT see 'amal'
    - Owner Alice queries call analyses -> Sees both 'amal' and 'babu'
    """
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    sales_id = str(seed_data["sales_a1"].id)

    owner_headers = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_owner_amal",
    }
    sales_headers = {
        "X-User-Id": sales_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
        "X-Correlation-ID": "req_sales_babu",
    }

    # 1. Create Lead Amal assigned to Owner
    lead_amal = Lead(
        organization_id=seed_data["tenant_a"].id,
        name="amal",
        email="amal@owner.com",
        assigned_to=seed_data["owner_a"].id,
        status="New",
    )
    # 2. Create Lead Babu assigned to Salesperson
    lead_babu = Lead(
        organization_id=seed_data["tenant_a"].id,
        name="babu",
        email="babu@sales.com",
        assigned_to=seed_data["sales_a1"].id,
        status="New",
    )
    db_session.add_all([lead_amal, lead_babu])
    await db_session.commit()

    # 3. Owner ingests call on Amal
    resp_amal = await client.post(
        "/v1/calls/ingest",
        json={"raw_text": "Amal call transcript", "lead_id": str(lead_amal.id), "subject": "Call with Amal"},
        headers=owner_headers,
    )
    assert resp_amal.status_code == 200
    amal_analysis_id = resp_amal.json()["data"]["id"]

    # 4. Salesperson ingests call on Babu
    resp_babu = await client.post(
        "/v1/calls/ingest",
        json={"raw_text": "Babu call transcript", "lead_id": str(lead_babu.id), "subject": "Call with Babu"},
        headers=sales_headers,
    )
    assert resp_babu.status_code == 200
    babu_analysis_id = resp_babu.json()["data"]["id"]

    # 5. Salesperson lists calls: MUST see Babu, CANNOT see Amal
    sales_list = await client.get("/v1/calls/analysis", headers=sales_headers)
    assert sales_list.status_code == 200
    sales_items = sales_list.json()["data"]
    sales_ids = [item["id"] for item in sales_items]
    sales_lead_names = [item["lead_name"] for item in sales_items]

    assert babu_analysis_id in sales_ids
    assert "babu" in sales_lead_names
    assert amal_analysis_id not in sales_ids
    assert "amal" not in sales_lead_names

    # 6. Salesperson tries to access Amal directly -> 403 Forbidden
    direct_amal = await client.get(f"/v1/calls/analysis/{amal_analysis_id}", headers=sales_headers)
    assert direct_amal.status_code == 403

    # 7. Owner lists calls: Sees both Amal and Babu
    owner_list = await client.get("/v1/calls/analysis", headers=owner_headers)
    assert owner_list.status_code == 200
    owner_ids = [item["id"] for item in owner_list.json()["data"]]
    assert amal_analysis_id in owner_ids
    assert babu_analysis_id in owner_ids
