import pytest
from httpx import AsyncClient


def _headers(user_id: str, tenant_id: str, role: str) -> dict:
    return {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": role,
        "X-Correlation-ID": f"req_pipeline_test_{role}_{user_id[:6]}",
    }


async def _create_account(client: AsyncClient, headers: dict, name: str = "Apex Industries") -> str:
    resp = await client.post(
        "/v1/accounts",
        json={"name": name, "phone": "+91 98000 11223"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["data"]["id"]


@pytest.mark.asyncio
async def test_lazy_default_pipeline_and_core_stages(client: AsyncClient, seed_data):
    """GET /v1/pipelines lazily creates a default Sales Pipeline and 5 shared system core stages."""
    tenant_id = str(seed_data["tenant_a"].id)
    sales_headers = _headers(str(seed_data["sales_a1"].id), tenant_id, "salesperson")

    resp = await client.get("/v1/pipelines", headers=sales_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "success"
    assert len(body["data"]) == 1

    pipeline = body["data"][0]
    assert pipeline["name"] == "Sales Pipeline"
    assert pipeline["is_default"] is True

    stages = pipeline["stages"]
    assert [s["name"] for s in stages] == ["Qualified", "Proposal", "Negotiation", "Won", "Lost"]
    assert all(s["scope"] == "org" for s in stages)
    assert all(s["is_system"] is True for s in stages)
    assert stages[3]["is_won"] is True
    assert stages[4]["is_lost"] is True


@pytest.mark.asyncio
async def test_per_user_custom_columns_isolation_and_guards(client: AsyncClient, seed_data):
    """
    Salesperson creates personal columns (including UTF-8 Tamil/Hindi names) via '+' on Qualified/Proposal.
    Columns appear right after their clicked parent stage, and NEVER leak to Owner or Manager boards.
    Adding sub-columns under Won/Lost is rejected.
    """
    tenant_id = str(seed_data["tenant_a"].id)
    sales1_h = _headers(str(seed_data["sales_a1"].id), tenant_id, "salesperson")
    mgr_h = _headers(str(seed_data["manager_a1"].id), tenant_id, "manager")
    owner_h = _headers(str(seed_data["owner_a"].id), tenant_id, "owner")

    pipe_resp = await client.get("/v1/pipelines", headers=sales1_h)
    pipeline = pipe_resp.json()["data"][0]
    pipe_id = pipeline["id"]
    stage_by_name = {s["name"]: s for s in pipeline["stages"]}

    # 1. Salesperson clicks '+' on Qualified -> creates High Qualified
    c1 = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={
            "name": "High Qualified",
            "parent_stage_id": stage_by_name["Qualified"]["id"],
            "color": "#06b6d4",
            "scope": "personal",
        },
        headers=sales1_h,
    )
    assert c1.status_code == 201, c1.text
    high_q = c1.json()["data"]
    assert high_q["scope"] == "personal"
    assert high_q["parent_base_stage"] == "Qualified"
    assert high_q["parent_stage_id"] == stage_by_name["Qualified"]["id"]
    assert high_q["is_system"] is False

    # 2. Salesperson clicks '+' with UTF-8 Tamil & Hindi column name under Proposal
    c2 = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={
            "name": "உயர் Proposal / समीक्षा",
            "parent_stage_id": stage_by_name["Proposal"]["id"],
            "scope": "personal",
        },
        headers=sales1_h,
    )
    assert c2.status_code == 201, c2.text
    assert c2.json()["data"]["parent_base_stage"] == "Proposal"

    # 3. Verify Salesperson sees ordered board: Qualified -> High Qualified -> Proposal -> UTF8 -> Negotiation -> Won -> Lost
    sales_stages = (await client.get("/v1/pipelines", headers=sales1_h)).json()["data"][0]["stages"]
    assert [s["name"] for s in sales_stages] == [
        "Qualified",
        "High Qualified",
        "Proposal",
        "உயர் Proposal / समीक्षा",
        "Negotiation",
        "Won",
        "Lost",
    ]

    # 4. Strict isolation: Manager & Owner only see the 5 shared core stages
    mgr_stages = (await client.get("/v1/pipelines", headers=mgr_h)).json()["data"][0]["stages"]
    owner_stages = (await client.get("/v1/pipelines", headers=owner_h)).json()["data"][0]["stages"]
    assert [s["name"] for s in mgr_stages] == ["Qualified", "Proposal", "Negotiation", "Won", "Lost"]
    assert [s["name"] for s in owner_stages] == ["Qualified", "Proposal", "Negotiation", "Won", "Lost"]

    # 5. Guardrail: Cannot add column inside Won or Lost
    won_attempt = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={"name": "Post Won", "parent_stage_id": stage_by_name["Won"]["id"]},
        headers=sales1_h,
    )
    assert won_attempt.status_code == 400

    lost_attempt = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={"name": "Post Lost", "parent_stage_id": stage_by_name["Lost"]["id"]},
        headers=sales1_h,
    )
    assert lost_attempt.status_code == 400

    # 6. Guardrail: Duplicate name on same user's board rejected
    dup_attempt = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={"name": "high qualified", "parent_stage_id": stage_by_name["Qualified"]["id"]},
        headers=sales1_h,
    )
    assert dup_attempt.status_code == 400


@pytest.mark.asyncio
async def test_deal_personal_column_placement_rollup_and_core_promotion(client: AsyncClient, seed_data):
    """
    Moving a deal into Salesperson's personal 'High Qualified' column:
    - Shows display_stage_name='High Qualified' to Salesperson.
    - Preserves deals.stage='Qualified' (and display_stage_name='Qualified') for Manager and Owner.
    - Moving that deal on Owner's board to 'Low Qualified' (Owner's own personal column under Qualified)
      does NOT overwrite Salesperson's placement.
    - Promoting deal to core 'Proposal' clears stale personal column overrides across boards.
    """
    tenant_id = str(seed_data["tenant_a"].id)
    sales1_h = _headers(str(seed_data["sales_a1"].id), tenant_id, "salesperson")
    mgr_h = _headers(str(seed_data["manager_a1"].id), tenant_id, "manager")
    owner_h = _headers(str(seed_data["owner_a"].id), tenant_id, "owner")

    acc_id = await _create_account(client, sales1_h, "Zeta Tech")
    pipe = (await client.get("/v1/pipelines", headers=sales1_h)).json()["data"][0]
    pipe_id = pipe["id"]
    core = {s["name"]: s for s in pipe["stages"]}

    # Salesperson creates 'High Qualified' under Qualified
    hq_resp = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={"name": "High Qualified", "parent_stage_id": core["Qualified"]["id"]},
        headers=sales1_h,
    )
    hq_id = hq_resp.json()["data"]["id"]

    # Owner creates independent 'Owner Review' under Qualified
    own_rev_resp = await client.post(
        f"/v1/pipelines/{pipe_id}/stages",
        json={"name": "Owner Review", "parent_stage_id": core["Qualified"]["id"]},
        headers=owner_h,
    )
    own_rev_id = own_rev_resp.json()["data"]["id"]

    # Salesperson creates Deal directly into their personal High Qualified stage
    d_resp = await client.post(
        "/v1/deals",
        json={
            "account_id": acc_id,
            "name": "Zeta Cloud Deal",
            "amount": 95000.0,
            "pipeline_id": pipe_id,
            "stage_id": hq_id,
        },
        headers=sales1_h,
    )
    assert d_resp.status_code == 201, d_resp.text
    deal_data = d_resp.json()["data"]
    deal_id = deal_data["id"]
    assert deal_data["stage"] == "Qualified"
    assert deal_data["display_stage_name"] == "High Qualified"
    assert deal_data["display_stage_id"] == hq_id

    # Owner checks deal -> sees Qualified (core rollup)
    owner_list = (await client.get("/v1/deals", headers=owner_h)).json()["data"]
    owner_deal = next(d for d in owner_list if d["id"] == deal_id)
    assert owner_deal["stage"] == "Qualified"
    assert owner_deal["display_stage_name"] == "Qualified"

    # Owner places deal in Owner's personal 'Owner Review' column
    own_move = await client.patch(
        f"/v1/deals/{deal_id}/stage",
        json={"stage_id": own_rev_id},
        headers=owner_h,
    )
    assert own_move.status_code == 200, own_move.text
    assert own_move.json()["data"]["display_stage_name"] == "Owner Review"
    assert own_move.json()["data"]["stage"] == "Qualified"

    # Salesperson still sees deal in 'High Qualified' — unaffected by Owner's personal column!
    sales_get = (await client.get(f"/v1/deals/{deal_id}", headers=sales1_h)).json()["data"]
    assert sales_get["display_stage_name"] == "High Qualified"

    # Manager still sees deal in 'Qualified'
    mgr_get = (await client.get(f"/v1/deals/{deal_id}", headers=mgr_h)).json()["data"]
    assert mgr_get["display_stage_name"] == "Qualified"

    # Manager promotes deal to core 'Proposal' -> clears stale 'Qualified' overrides on Salesperson & Owner boards
    mgr_promote = await client.patch(
        f"/v1/deals/{deal_id}/stage",
        json={"stage": "Proposal"},
        headers=mgr_h,
    )
    assert mgr_promote.status_code == 200, mgr_promote.text
    assert mgr_promote.json()["data"]["stage"] == "Proposal"

    sales_after = (await client.get(f"/v1/deals/{deal_id}", headers=sales1_h)).json()["data"]
    owner_after = (await client.get(f"/v1/deals/{deal_id}", headers=owner_h)).json()["data"]
    assert sales_after["stage"] == "Proposal"
    assert sales_after["display_stage_name"] == "Proposal"
    assert owner_after["display_stage_name"] == "Proposal"


@pytest.mark.asyncio
async def test_rename_reorder_and_cross_user_protection(client: AsyncClient, seed_data):
    """Users can rename and reorder their own columns; another user cannot rename/delete them."""
    tenant_id = str(seed_data["tenant_a"].id)
    sales1_h = _headers(str(seed_data["sales_a1"].id), tenant_id, "salesperson")
    sales2_h = _headers(str(seed_data["sales_a2"].id), tenant_id, "salesperson")

    pipe = (await client.get("/v1/pipelines", headers=sales1_h)).json()["data"][0]
    pipe_id = pipe["id"]
    core = {s["name"]: s for s in pipe["stages"]}

    s_a = (
        await client.post(
            f"/v1/pipelines/{pipe_id}/stages",
            json={"name": "Call Today", "parent_stage_id": core["Qualified"]["id"]},
            headers=sales1_h,
        )
    ).json()["data"]
    s_b = (
        await client.post(
            f"/v1/pipelines/{pipe_id}/stages",
            json={"name": "Mid Tier", "parent_stage_id": core["Qualified"]["id"]},
            headers=sales1_h,
        )
    ).json()["data"]

    # Rename
    ren = await client.put(
        f"/v1/pipelines/{pipe_id}/stages/{s_a['id']}",
        json={"name": "Hot Call Today", "color": "#14b8a6"},
        headers=sales1_h,
    )
    assert ren.status_code == 200, ren.text
    assert ren.json()["data"]["name"] == "Hot Call Today"
    assert ren.json()["data"]["color"] == "#14b8a6"

    # Cross-user mutation rejected
    intrude = await client.put(
        f"/v1/pipelines/{pipe_id}/stages/{s_a['id']}",
        json={"name": "Hacked"},
        headers=sales2_h,
    )
    assert intrude.status_code == 403

    # Reorder personal columns between Qualified and Proposal (swap Mid Tier before Hot Call Today)
    new_order = [
        core["Qualified"]["id"],
        s_b["id"],
        s_a["id"],
        core["Proposal"]["id"],
        core["Negotiation"]["id"],
        core["Won"]["id"],
        core["Lost"]["id"],
    ]
    reord = await client.put(
        f"/v1/pipelines/{pipe_id}/stages/reorder",
        json={"stage_ids": new_order},
        headers=sales1_h,
    )
    assert reord.status_code == 200, reord.text
    assert [s["name"] for s in reord.json()["data"]] == [
        "Qualified",
        "Mid Tier",
        "Hot Call Today",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost",
    ]


@pytest.mark.asyncio
async def test_safe_stage_deletion_fallback_explicit_reassign_and_recursive_children(client: AsyncClient, seed_data):
    """
    CRM-BE-05 Safe Stage Deletion:
    - System stages (Qualified, Won, Lost) cannot be deleted.
    - Deleting child personal column without reassign_to falls back to parent_stage_id.
    - Deleting parent personal column re-links child column parent_stage_id and moves deals to parent core stage.
    - Deleting with ?reassign_to=<stage_id> atomically transfers deals to chosen destination.
    """
    tenant_id = str(seed_data["tenant_a"].id)
    sales1_h = _headers(str(seed_data["sales_a1"].id), tenant_id, "salesperson")
    owner_h = _headers(str(seed_data["owner_a"].id), tenant_id, "owner")

    acc_id = await _create_account(client, sales1_h, "Delta Logistics")
    pipe = (await client.get("/v1/pipelines", headers=sales1_h)).json()["data"][0]
    pipe_id = pipe["id"]
    core = {s["name"]: s for s in pipe["stages"]}

    # System stage protection (even Owner cannot delete Won or Qualified)
    del_won = await client.delete(
        f"/v1/pipelines/{pipe_id}/stages/{core['Won']['id']}",
        headers=owner_h,
    )
    assert del_won.status_code == 400

    # Create hierarchy: Qualified -> ParentSub -> ChildSub
    parent_sub = (
        await client.post(
            f"/v1/pipelines/{pipe_id}/stages",
            json={"name": "Parent Sub", "parent_stage_id": core["Qualified"]["id"]},
            headers=sales1_h,
        )
    ).json()["data"]

    child_sub = (
        await client.post(
            f"/v1/pipelines/{pipe_id}/stages",
            json={"name": "Child Sub", "parent_stage_id": parent_sub["id"]},
            headers=sales1_h,
        )
    ).json()["data"]
    assert child_sub["parent_base_stage"] == "Qualified"

    # Put Deal 1 in Parent Sub and Deal 2 in Child Sub
    d1 = (
        await client.post(
            "/v1/deals",
            json={"account_id": acc_id, "name": "Deal Parent", "amount": 10000, "pipeline_id": pipe_id, "stage_id": parent_sub["id"]},
            headers=sales1_h,
        )
    ).json()["data"]["id"]

    d2 = (
        await client.post(
            "/v1/deals",
            json={"account_id": acc_id, "name": "Deal Child", "amount": 20000, "pipeline_id": pipe_id, "stage_id": child_sub["id"]},
            headers=sales1_h,
        )
    ).json()["data"]["id"]

    # Delete Parent Sub with NO ?reassign_to -> Deal 1 moves to Qualified, Child Sub re-links to Qualified
    del_parent = await client.delete(
        f"/v1/pipelines/{pipe_id}/stages/{parent_sub['id']}",
        headers=sales1_h,
    )
    assert del_parent.status_code == 200, del_parent.text
    del_data = del_parent.json()["data"]
    assert del_data["reassigned_to_stage_id"] == core["Qualified"]["id"]
    assert del_data["reassigned_deals_count"] == 1

    d1_after = (await client.get(f"/v1/deals/{d1}", headers=sales1_h)).json()["data"]
    assert d1_after["display_stage_name"] == "Qualified"

    # Verify Child Sub still exists, Deal 2 is still there, and Child Sub's parent_stage_id updated to Qualified
    stages_now = (await client.get("/v1/pipelines", headers=sales1_h)).json()["data"][0]["stages"]
    child_now = next(s for s in stages_now if s["id"] == child_sub["id"])
    assert child_now["parent_stage_id"] == core["Qualified"]["id"]

    # Delete Child Sub with explicit ?reassign_to=<Proposal> -> Deal 2 promotes cleanly to Proposal
    del_child = await client.delete(
        f"/v1/pipelines/{pipe_id}/stages/{child_sub['id']}?reassign_to={core['Proposal']['id']}",
        headers=sales1_h,
    )
    assert del_child.status_code == 200, del_child.text
    assert del_child.json()["data"]["reassigned_to_stage_name"] == "Proposal"
    assert del_child.json()["data"]["reassigned_deals_count"] == 1

    d2_after = (await client.get(f"/v1/deals/{d2}", headers=sales1_h)).json()["data"]
    assert d2_after["stage"] == "Proposal"
    assert d2_after["display_stage_name"] == "Proposal"


@pytest.mark.asyncio
async def test_lead_conversion_populates_deal_pipeline_and_stage_ids(client: AsyncClient, seed_data):
    """Converting a lead sets deals.pipeline_id and deals.stage_id to the org's Qualified stage."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_h = _headers(str(seed_data["owner_a"].id), tenant_id, "owner")

    lead_resp = await client.post(
        "/v1/leads",
        json={
            "name": "Meera Nair",
            "company": "Malabar Foods",
            "email": "meera@malabar.in",
            "phone": "+91 98470 11223",
            "interested_product": "Retail POS Suite",
            "score": 90,
        },
        headers=owner_h,
    )
    assert lead_resp.status_code == 201, lead_resp.text
    lead_id = lead_resp.json()["data"]["id"]

    conv_resp = await client.post(
        f"/v1/leads/{lead_id}/convert",
        json={"deal_name": "Malabar Retail Rollout", "deal_amount": 75000.0},
        headers=owner_h,
    )
    assert conv_resp.status_code == 200, conv_resp.text
    deal_id = conv_resp.json()["deal_id"]

    deal_get = (await client.get(f"/v1/deals/{deal_id}", headers=owner_h)).json()["data"]
    assert deal_get["stage"] == "Qualified"
    assert deal_get["pipeline_id"] is not None
    assert deal_get["stage_id"] is not None
    assert deal_get["display_stage_name"] == "Qualified"
