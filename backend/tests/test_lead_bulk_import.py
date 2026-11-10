import io
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.lead import Lead
from backend.app.data.models.lead_import import LeadImportBatch


@pytest.mark.asyncio
async def test_bulk_import_leads_endpoint_success(client: AsyncClient, db_session: AsyncSession, seed_data):
    """Verifies CSV upload parses leads, permits cross-sell inquiries, and writes batch records."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_bulk_import_success",
    }

    csv_content = (
        "Name,Email,Phone,Company,Interested Product,Score\n"
        "Aarav Test,aarav@tenant-a.com,+919900000001,Aarav Logistics,Fleet Telematics,65\n"
        "Meera Test,meera@tenant-a.com,+919900000002,Meera Tech,Enterprise Core,80\n"
        "Kavitha Test,kavitha@tenant-a.com,+919900000003,Kavitha Ltd,Fleet Telematics,70\n"
        "Kavitha Test,kavitha@tenant-a.com,+919900000003,Kavitha Ltd,Enterprise Core,75\n"
    )

    files = {"file": ("leads.csv", csv_content.encode("utf-8"), "text/csv")}
    resp = await client.post("/v1/leads/bulk-import", files=files, headers=headers)

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total_rows"] == 4
    assert data["inserted_count"] == 4
    assert data["duplicate_count"] == 0
    assert data["error_count"] == 0
    assert data["status"] == "completed"
    batch_id = data["batch_id"]

    # Verify database state
    batch_stmt = select(LeadImportBatch).where(LeadImportBatch.id == uuid.UUID(batch_id))
    batch_row = (await db_session.execute(batch_stmt)).scalar_one_or_none()
    assert batch_row is not None
    assert batch_row.inserted_count == 4
    assert batch_row.file_name == "leads.csv"

    # Verify leads tied to batch
    leads_stmt = select(Lead).where(Lead.import_batch_id == uuid.UUID(batch_id))
    leads = (await db_session.execute(leads_stmt)).scalars().all()
    assert len(leads) == 4


@pytest.mark.asyncio
async def test_bulk_import_in_file_duplicate_and_validation_errors(client: AsyncClient, seed_data):
    """Verifies that in-file exact duplicates and invalid rows are properly logged and skipped."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_bulk_import_validation",
    }

    csv_content = (
        "Name,Email,Phone,Company,Interested Product\n"
        "Valid Lead,valid@tenant-a.com,+919900000010,Valid Corp,Cloud ERP\n"
        "Valid Lead,valid@tenant-a.com,+919900000010,Valid Corp,Cloud ERP\n"  # in-file duplicate
        ",no.name@tenant-a.com,+919900000011,No Name Corp,Cloud ERP\n"       # missing name
        "Bad Email,bad.email@@tenant-a.com,+919900000012,Bad Email Corp,Cloud ERP\n"  # invalid email
        "No Contact,,,No Contact Corp,Cloud ERP\n"                            # missing contact info
    )

    files = {"file": ("leads_with_errors.csv", csv_content.encode("utf-8"), "text/csv")}
    resp = await client.post("/v1/leads/bulk-import", files=files, headers=headers)

    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total_rows"] == 5
    assert data["inserted_count"] == 1
    assert data["duplicate_count"] == 1
    assert data["error_count"] == 3
    assert len(data["error_sample"]) == 4


@pytest.mark.asyncio
async def test_bulk_import_database_duplicate_detection(client: AsyncClient, seed_data):
    """Verifies that re-uploading existing active leads marks them as duplicate unless product differs."""
    tenant_id = str(seed_data["tenant_a"].id)
    user_id = str(seed_data["owner_a"].id)

    headers = {
        "X-User-Id": user_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_bulk_import_db_dup",
    }

    csv_content = (
        "Name,Email,Phone,Company,Interested Product\n"
        "Existing Lead,existing@tenant-a.com,+919900000020,Existing Corp,Cloud ERP\n"
    )

    # First upload
    files1 = {"file": ("upload1.csv", csv_content.encode("utf-8"), "text/csv")}
    resp1 = await client.post("/v1/leads/bulk-import", files=files1, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["data"]["inserted_count"] == 1

    # Second upload with same contact & same product
    files2 = {"file": ("upload2.csv", csv_content.encode("utf-8"), "text/csv")}
    resp2 = await client.post("/v1/leads/bulk-import", files=files2, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["data"]["inserted_count"] == 0
    assert resp2.json()["data"]["duplicate_count"] == 1

    # Third upload with same contact but DIFFERENT product (Cross-sell inquiry)
    cross_sell_csv = (
        "Name,Email,Phone,Company,Interested Product\n"
        "Existing Lead,existing@tenant-a.com,+919900000020,Existing Corp,Warehouse IoT\n"
    )
    files3 = {"file": ("upload3.csv", cross_sell_csv.encode("utf-8"), "text/csv")}
    resp3 = await client.post("/v1/leads/bulk-import", files=files3, headers=headers)
    assert resp3.status_code == 200
    assert resp3.json()["data"]["inserted_count"] == 1
    assert resp3.json()["data"]["duplicate_count"] == 0


@pytest.mark.asyncio
async def test_bulk_import_rejects_non_csv_and_empty_files(client: AsyncClient, seed_data):
    """Verifies 400 rejection for non-csv or empty files."""
    headers = {
        "X-User-Id": str(seed_data["owner_a"].id),
        "X-Tenant-Id": str(seed_data["tenant_a"].id),
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_bad_file",
    }

    # Non-CSV
    files = {"file": ("data.json", b'{"name": "test"}', "application/json")}
    resp = await client.post("/v1/leads/bulk-import", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Only CSV files" in resp.text

    # Empty CSV
    files_empty = {"file": ("empty.csv", b"", "text/csv")}
    resp_empty = await client.post("/v1/leads/bulk-import", files=files_empty, headers=headers)
    assert resp_empty.status_code == 400
    assert "empty" in resp_empty.text


@pytest.mark.asyncio
async def test_bulk_import_history_rbac(client: AsyncClient, seed_data):
    """Verifies that import history endpoint returns batches according to RBAC boundaries."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    rep_id = str(seed_data["sales_a1"].id)

    # 1. Owner imports a batch
    headers_owner = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_history_owner",
    }
    csv1 = "Name,Email,Company\nOwner Lead,ownerlead@test.com,Owner Corp\n"
    await client.post("/v1/leads/bulk-import", files={"file": ("owner_batch.csv", csv1.encode(), "text/csv")}, headers=headers_owner)

    # 2. Sales rep imports a batch
    headers_rep = {
        "X-User-Id": rep_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
        "X-Correlation-ID": "test_history_rep",
    }
    csv2 = "Name,Email,Company\nRep Lead,replead@test.com,Rep Corp\n"
    await client.post("/v1/leads/bulk-import", files={"file": ("rep_batch.csv", csv2.encode(), "text/csv")}, headers=headers_rep)

    # 3. Owner checks history -> sees both
    resp_owner = await client.get("/v1/leads/imports", headers=headers_owner)
    assert resp_owner.status_code == 200
    owner_files = [b["file_name"] for b in resp_owner.json()["data"]]
    assert "owner_batch.csv" in owner_files
    assert "rep_batch.csv" in owner_files

    # 4. Sales rep checks history -> sees only rep_batch.csv
    resp_rep = await client.get("/v1/leads/imports", headers=headers_rep)
    assert resp_rep.status_code == 200
    rep_files = [b["file_name"] for b in resp_rep.json()["data"]]
    assert "rep_batch.csv" in rep_files
    assert "owner_batch.csv" not in rep_files


@pytest.mark.asyncio
async def test_allow_duplicate_leads_selective_and_bulk(client: AsyncClient, db_session: AsyncSession, seed_data):
    """Verifies per-row and allow-all duplicate override plus RBAC guard."""
    tenant_id = str(seed_data["tenant_a"].id)
    owner_id = str(seed_data["owner_a"].id)
    rep_id = str(seed_data["sales_a1"].id)

    headers_owner = {
        "X-User-Id": owner_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "owner",
        "X-Correlation-ID": "test_allow_dups",
    }

    # Row 2: Clean insert; Row 3 & Row 4: Intra-file duplicates of Row 2
    csv_data = (
        "Name,Email,Phone,Company,Interested Product\n"
        "Dup Base,dup.base@tenant-a.com,+919900000099,Dup Corp,Cloud ERP\n"
        "Dup Base,dup.base@tenant-a.com,+919900000099,Dup Corp,Cloud ERP\n"
        "Dup Base,dup.base@tenant-a.com,+919900000099,Dup Corp,Cloud ERP\n"
    )
    resp = await client.post("/v1/leads/bulk-import", files={"file": ("dups.csv", csv_data.encode(), "text/csv")}, headers=headers_owner)
    assert resp.status_code == 200
    data = resp.json()["data"]
    batch_id = data["batch_id"]
    assert data["inserted_count"] == 1
    assert data["duplicate_count"] == 2
    assert len(data["error_sample"]) == 2
    assert all(e.get("is_duplicate") is True and e.get("allowed") is False and e.get("lead_data") for e in data["error_sample"])

    # RBAC check: Sales rep cannot approve Owner's batch duplicates
    headers_rep = {
        "X-User-Id": rep_id,
        "X-Tenant-Id": tenant_id,
        "X-User-Roles": "salesperson",
        "X-Correlation-ID": "test_allow_dups_forbidden",
    }
    resp_forbidden = await client.post(
        f"/v1/leads/imports/{batch_id}/allow-duplicates",
        json={"allow_all": True},
        headers=headers_rep,
    )
    assert resp_forbidden.status_code == 403

    # Selective allow: Row 3 only
    resp_row3 = await client.post(
        f"/v1/leads/imports/{batch_id}/allow-duplicates",
        json={"row_numbers": [3], "allow_all": False},
        headers=headers_owner,
    )
    assert resp_row3.status_code == 200, resp_row3.text
    d1 = resp_row3.json()["data"]
    assert d1["newly_inserted"] == 1
    assert d1["inserted_count"] == 2
    assert d1["duplicate_count"] == 1
    row3_entry = next(e for e in d1["error_sample"] if e["row"] == 3)
    row4_entry = next(e for e in d1["error_sample"] if e["row"] == 4)
    assert row3_entry["allowed"] is True
    assert row4_entry["allowed"] is False

    # Allow all remaining pending duplicates (only Row 4 should be inserted)
    resp_all = await client.post(
        f"/v1/leads/imports/{batch_id}/allow-duplicates",
        json={"allow_all": True},
        headers=headers_owner,
    )
    assert resp_all.status_code == 200, resp_all.text
    d2 = resp_all.json()["data"]
    assert d2["newly_inserted"] == 1
    assert d2["inserted_count"] == 3
    assert d2["duplicate_count"] == 0
    assert all(e["allowed"] is True for e in d2["error_sample"])

    # Verify 3 leads persisted under the batch
    leads_stmt = select(Lead).where(Lead.import_batch_id == uuid.UUID(batch_id))
    leads = (await db_session.execute(leads_stmt)).scalars().all()
    assert len(leads) == 3
