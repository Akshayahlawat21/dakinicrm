import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_api_health_endpoint(client: AsyncClient):
    """GET /health returns healthy status."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "dakini-layer3-app"


@pytest.mark.asyncio
async def test_api_unauthenticated_request_rejected(client: AsyncClient):
    """Requests without gateway headers or token return 401."""
    resp = await client.get("/v1/leads")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_api_leads_crud_and_convert(client: AsyncClient, seed_data):
    """Full API lead creation and conversion flow."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_api_lead_test",
    }

    # 1. Create Lead
    payload = {
        "name": "Rajesh Kumar",
        "company": "Bharat Supply Chains",
        "email": "rajesh@bharatsupply.in",
        "phone": "+91 98111 22334",
        "industry": "Supply Chain",
        "score": 85,
        "interested_product": "Fleet Telematics",
    }
    resp = await client.post("/v1/leads", json=payload, headers=headers)
    assert resp.status_code == 201
    lead_data = resp.json()["data"]
    lead_id = lead_data["id"]
    assert lead_data["name"] == "Rajesh Kumar"

    # 2. Get Lead
    get_resp = await client.get(f"/v1/leads/{lead_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["id"] == lead_id

    # 3. List Leads
    list_resp = await client.get("/v1/leads", headers=headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # 4. Convert Lead
    conv_resp = await client.post(
        f"/v1/leads/{lead_id}/convert",
        json={"deal_name": "Bharat Expansion Deal", "deal_amount": 60000.0},
        headers=headers,
    )
    assert conv_resp.status_code == 200
    assert conv_resp.json()["status"] == "success"
    assert "deal_id" in conv_resp.json()


@pytest.mark.asyncio
async def test_api_deals_and_stage_update(client: AsyncClient, seed_data):
    """Create deal and update its Kanban stage via API."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)
    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
    }

    # Create account first
    acc_resp = await client.post(
        "/v1/accounts",
        json={"name": "Global Tech Corp", "phone": "+1 555-888-9999"},
        headers=headers,
    )
    acc_id = acc_resp.json()["data"]["id"]

    # Create Deal
    deal_resp = await client.post(
        "/v1/deals",
        json={
            "account_id": acc_id,
            "name": "Global Tech SaaS Renewal",
            "amount": 95000.0,
            "stage": "Qualified",
        },
        headers=headers,
    )
    assert deal_resp.status_code == 201
    deal_id = deal_resp.json()["data"]["id"]

    # Update stage to Won
    stage_resp = await client.patch(
        f"/v1/deals/{deal_id}/stage",
        json={"stage": "Won"},
        headers=headers,
    )
    assert stage_resp.status_code == 200
    assert stage_resp.json()["data"]["stage"] == "Won"
    assert stage_resp.json()["data"]["status"] == "won"


@pytest.mark.asyncio
async def test_api_dashboard_kpis(client: AsyncClient, seed_data):
    """GET /v1/dashboard returns aggregated metrics."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)
    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
    }

    resp = await client.get("/v1/dashboard", headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_leads" in data
    assert "pipeline_value" in data
    assert "quota_attainment_percent" in data

@pytest.mark.asyncio
async def test_api_create_lead_mandatory_phone_and_product(client: AsyncClient, seed_data):
    """Enforce that phone and interested_product are mandatory when creating a lead."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_lead_mandatory_fields_test",
    }

    # 1. Missing phone
    resp_no_phone = await client.post(
        "/v1/leads",
        json={"name": "Kavita", "company": "Solar Inc", "interested_product": "Solar Inverters"},
        headers=headers,
    )
    assert resp_no_phone.status_code == 400
    assert "phone" in resp_no_phone.json()["error"]["message"].lower()

    # 2. Missing interested product
    resp_no_prod = await client.post(
        "/v1/leads",
        json={"name": "Kavita", "company": "Solar Inc", "phone": "+1 555-432-1098"},
        headers=headers,
    )
    assert resp_no_prod.status_code == 400
    assert "product" in resp_no_prod.json()["error"]["message"].lower()

@pytest.mark.asyncio
async def test_api_account_mandatory_phone_and_duplicate(client: AsyncClient, seed_data):
    """Enforce mandatory phone on account creation and duplicate detection with phone."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_acc_phone_test",
    }

    # 1. Missing phone rejected
    resp_no_phone = await client.post(
        "/v1/accounts",
        json={"name": "SolarTech Labs", "industry": "Technology"},
        headers=headers,
    )
    assert resp_no_phone.status_code == 400
    assert "phone" in resp_no_phone.json()["error"]["message"].lower()

    # 2. Valid creation with phone
    resp_create = await client.post(
        "/v1/accounts",
        json={"name": "SolarTech Labs", "industry": "Technology", "phone": "+1 (555) 777-6655"},
        headers=headers,
    )
    assert resp_create.status_code == 201

    # 3. Duplicate check by phone
    resp_dup = await client.get(
        "/v1/accounts/check-duplicate?phone=555-777-6655",
        headers=headers,
    )
    assert resp_dup.status_code == 200
    data = resp_dup.json()["data"]
    assert data is not None
    assert data["is_duplicate_warning"] is True
    assert "SolarTech Labs" in data["warning_message"]


@pytest.mark.asyncio
async def test_api_contact_mandatory_phone_and_duplicate(client: AsyncClient, seed_data):
    """Enforce mandatory phone on contact creation and duplicate detection with phone."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "req_con_phone_test",
    }

    # 1. Missing phone rejected
    resp_no_phone = await client.post(
        "/v1/contacts",
        json={"name": "Rahul Verma", "account": "Apex Corp", "email": "rahul@apex.com"},
        headers=headers,
    )
    assert resp_no_phone.status_code == 400
    assert "phone" in resp_no_phone.json()["error"]["message"].lower()

    # 2. Valid creation with phone
    resp_create = await client.post(
        "/v1/contacts",
        json={"name": "Rahul Verma", "account": "Apex Corp", "email": "rahul@apex.com", "phone": "+1 555-666-5544"},
        headers=headers,
    )
    assert resp_create.status_code == 201

    # 3. Duplicate check by phone + company
    resp_dup = await client.get(
        "/v1/contacts/check-duplicate?name=Rahul%20Verma&company=Apex%20Corp&phone=5556665544",
        headers=headers,
    )
    assert resp_dup.status_code == 200
    data = resp_dup.json()["data"]
    assert data is not None
    assert data["is_duplicate_warning"] is True

