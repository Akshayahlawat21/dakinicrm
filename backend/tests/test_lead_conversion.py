import pytest
from backend.app.application.services.lead_service import LeadService
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.deal_repository import DealRepository
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.application.exceptions import ConflictError


@pytest.mark.asyncio
async def test_atomic_lead_conversion(db_session, ctx_owner_a):
    """Lead conversion atomically creates Account, Contact, and Deal and marks lead converted."""
    lead_service = LeadService(db_session)
    account_repo = AccountRepository(db_session)
    deal_repo = DealRepository(db_session)
    contact_repo = ContactRepository(db_session)

    # 1. Create lead
    lead = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Aarav Patel",
        company="Skyline Freight Solutions",
        email="aarav@skylinefreight.in",
        phone="+91 98200 12345",
        industry="Logistics",
    )
    assert lead.status == "New"

    # 2. Convert lead
    result = await lead_service.convert_lead(
        ctx=ctx_owner_a,
        lead_id=lead.id,
        deal_name="Skyline Route Telematics Expansion",
        deal_amount=75000.0,
        company_name="Skyline Freight Solutions",
    )

    assert result["status"] == "success"
    assert "deal_id" in result
    assert "account_id" in result
    assert "contact_id" in result

    # 3. Verify lead is marked Converted
    reloaded_lead = await lead_service.get_lead(ctx_owner_a, lead.id)
    assert reloaded_lead.status == "Converted"

    # 4. Verify account, contact, and deal exist
    acc = await account_repo.get_by_id_scoped(result["account_id"], ctx_owner_a.tenant_id)
    assert acc.name == "Skyline Freight Solutions"

    deal = await deal_repo.get_by_id_scoped(result["deal_id"], ctx_owner_a.tenant_id)
    assert deal.name == "Skyline Route Telematics Expansion"
    assert deal.amount == 75000.0

    contact = await contact_repo.get_by_id_scoped(result["contact_id"], ctx_owner_a.tenant_id)
    assert contact.first_name == "Aarav"

    # 5. Attempting to convert again raises ConflictError
    with pytest.raises(ConflictError):
        await lead_service.convert_lead(
            ctx=ctx_owner_a,
            lead_id=lead.id,
        )
