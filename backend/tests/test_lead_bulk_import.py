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
