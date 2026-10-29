import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.services.lead_service import LeadService
from backend.app.application.exceptions import ConflictError


@pytest.mark.asyncio
async def test_title_is_blank_when_not_entered_for_all_roles(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
    ctx_manager_a1: RequestContext,
    ctx_sales_a1: RequestContext,
):
    """
    Verifies that when title is not entered by the user (None, empty, or whitespace):
    The lead title is saved as None/blank, NOT given any random or hardcoded value,
    across Owner, Manager, and Salesperson roles.
    """
    lead_service = LeadService(db_session)

    # 1. Owner creates lead with no title
    lead_owner = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="Lead By Owner",
        company="Tech Corp",
        email="owner_lead@techcorp.com",
        title=None,
    )
    await db_session.flush()
    assert lead_owner.title is None, f"Expected None but got {lead_owner.title}"

    # 2. Manager creates lead with empty string title
    lead_mgr = await lead_service.create_lead(
        ctx=ctx_manager_a1,
        name="Lead By Manager",
        company="Tech Corp",
        email="mgr_lead@techcorp.com",
        title="",
    )
    await db_session.flush()
    assert lead_mgr.title is None, f"Expected None but got {lead_mgr.title}"

    # 3. Salesperson creates lead with whitespace-only title
    lead_sales = await lead_service.create_lead(
        ctx=ctx_sales_a1,
        name="Lead By Sales",
        company="Tech Corp",
        email="sales_lead@techcorp.com",
        title="   ",
    )
    await db_session.flush()
    assert lead_sales.title is None, f"Expected None but got {lead_sales.title}"


@pytest.mark.asyncio
async def test_duplicate_lead_prevention_across_all_roles(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
    ctx_manager_a1: RequestContext,
    ctx_sales_a1: RequestContext,
    ctx_sales_a2: RequestContext,
):
    """
    Verifies duplicate lead detection and creation blocking across Owner, Manager, and Salesperson.
    """
    lead_service = LeadService(db_session)

    # Base lead created by Salesperson 1
    base_lead = await lead_service.create_lead(
        ctx=ctx_sales_a1,
        name="Gokul Krishnan",
        company="Amazon",
        email="gokul@amazon.com",
        title=None,
        interested_product="agentic crm",
    )
    await db_session.flush()
    assert base_lead.title is None

    # --- 1. OWNER DUPLICATE CHECK & ATTEMPT ---
    owner_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        email="gokul@amazon.com",
        interested_product="agentic crm",
    )
    assert owner_check is not None
    assert owner_check["is_duplicate_warning"] is True
    assert owner_check["existing_lead_id"] == str(base_lead.id)
    assert owner_check["is_restricted"] is False

    # Owner creating duplicate without allow_separate_inquiry raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await lead_service.create_lead(
            ctx=ctx_owner_a,
            name="Gokul Krishnan",
            company="Amazon",
            email="gokul@amazon.com",
            interested_product="agentic crm",
            allow_separate_inquiry=False,
        )
    assert "already exists" in str(exc_info.value)

    # --- 2. MANAGER DUPLICATE CHECK & ATTEMPT ---
    # Salesperson 1 is in Manager 1's team
    mgr_check = await lead_service.check_duplicate_lead(
        ctx=ctx_manager_a1,
        name="Gokul Krishnan",
        email="gokul@amazon.com",
        interested_product="agentic crm",
    )
    assert mgr_check is not None
    assert mgr_check["is_duplicate_warning"] is True

    # Manager creating duplicate without allow_separate_inquiry raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await lead_service.create_lead(
            ctx=ctx_manager_a1,
            name="Gokul Krishnan",
            company="Amazon",
            email="gokul@amazon.com",
            interested_product="agentic crm",
            allow_separate_inquiry=False,
        )
    assert "already exists" in str(exc_info.value)

    # --- 3. SALESPERSON 2 (OUTSIDE ASSIGNEE) DUPLICATE CHECK & ATTEMPT ---
    sales2_check = await lead_service.check_duplicate_lead(
        ctx=ctx_sales_a2,
        name="Gokul Krishnan",
        email="gokul@amazon.com",
        interested_product="agentic crm",
    )
    assert sales2_check is not None
    assert sales2_check["is_duplicate_warning"] is True
    assert sales2_check["is_restricted"] is True

    # Salesperson 2 creating duplicate without allow_separate_inquiry raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await lead_service.create_lead(
            ctx=ctx_sales_a2,
            name="Gokul Krishnan",
            company="Amazon",
            email="gokul@amazon.com",
            interested_product="agentic crm",
            allow_separate_inquiry=False,
        )
    assert "already exists" in str(exc_info.value)

    # --- 4. PRODUCT NORMALIZATION (agentic.crm vs agentic crm) ---
    dup_dot_product = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        email="gokul@amazon.com",
        interested_product="agentic.crm",  # With dot instead of space
    )
    assert dup_dot_product is not None
    assert dup_dot_product["is_duplicate_warning"] is True

    # --- 5. LEGITIMATE CROSS-SELL FOR DIFFERENT PRODUCT ---
    cross_sell_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        email="gokul@amazon.com",
        interested_product="Fleet Telematics Real-Time AI Connector",
    )
    assert cross_sell_check is not None
    assert cross_sell_check["is_duplicate_warning"] is False
    assert cross_sell_check["is_cross_sell"] is True



@pytest.mark.asyncio
async def test_duplicate_warning_only_when_all_match_name_email_product(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
):
    """
    Verifies that duplicate warning is given ONLY when all three match:
    name + email + interested_product.
    Because many people have the same name, same-name alone must NEVER warn or block!
    """
    lead_service = LeadService(db_session)

    # 1. Base lead: Gokul Krishnan, gokul@amazon.com, interested in "agentic crm"
    base_lead = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        company="Amazon",
        email="gokul@amazon.com",
        interested_product="agentic crm",
    )
    await db_session.flush()

    # Case A: User only types name "gokulkrishnan" (email and product empty) -> NO WARNING!
    name_only_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        email=None,
        interested_product=None,
    )
    assert name_only_check is None, "Must not warn when only name is entered"

    # Case B: User types name "gokulkrishnan" + product, but NO email -> NO WARNING!
    no_email_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        email=None,
        interested_product="agentic crm",
    )
    assert no_email_check is None, "Must not warn when email is missing"

    # Case C: User types same name "gokulkrishnan", but DIFFERENT email -> NO WARNING!
    diff_person_check = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        email="gokul.other@tcs.com",
        interested_product="agentic crm",
    )
    assert diff_person_check is None, "Must not warn when email belongs to a different person"

    # And creating this different person succeeds cleanly without conflict!
    other_person_lead = await lead_service.create_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        company="TCS",
        email="gokul.other@tcs.com",
        interested_product="agentic crm",
    )
    await db_session.flush()
    assert other_person_lead.id != base_lead.id

    # Case D: Same name + same email, but DIFFERENT product -> CROSS-SELL, NOT duplicate warning!
    cross_sell = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        email="gokul@amazon.com",
        interested_product="Autonomous Route Planning",
    )
    assert cross_sell is not None
    assert cross_sell["is_duplicate_warning"] is False
    assert cross_sell.get("is_cross_sell") is True

    # Case E: ALL THREE MATCH: same name + same email + same product -> DUPLICATE WARNING!
    full_match = await lead_service.check_duplicate_lead(
        ctx=ctx_owner_a,
        name="gokulkrishnan",
        email="gokul@amazon.com",
        interested_product="agentic crm",
    )
    assert full_match is not None
    assert full_match["is_duplicate_warning"] is True
    assert full_match["existing_lead_id"] == str(base_lead.id)



@pytest.mark.asyncio
async def test_duplicate_account_detection(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
):
    """
    Verifies that duplicate account warning triggers ONLY when all 3 match:
    company name + industry + location.
    """
    from backend.app.application.services.account_service import AccountService
    from backend.app.application.exceptions import ConflictError

    acc_service = AccountService(db_session)

    # 1. Create base account
    base_acc = await acc_service.create_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry="Technology",
        address="Bengaluru, India",
    )
    await db_session.flush()

    # Case A: Only company name provided -> NO WARNING
    check_name_only = await acc_service.check_duplicate_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry=None,
        location=None,
    )
    assert check_name_only is None, "Must not warn when only company name is provided"

    # Case B: Name + Industry, but location is missing -> NO WARNING
    check_no_loc = await acc_service.check_duplicate_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry="Technology",
        location=None,
    )
    assert check_no_loc is None, "Must not warn when location is missing"

    # Case C: Name + Industry, but different location -> NO WARNING
    check_diff_loc = await acc_service.check_duplicate_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry="Technology",
        location="London, UK",
    )
    assert check_diff_loc is None, "Must not warn when location differs"

    # Case D: Name + Location, but different industry -> NO WARNING
    check_diff_ind = await acc_service.check_duplicate_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry="Healthcare",
        location="India",
    )
    assert check_diff_ind is None, "Must not warn when industry differs"

    # Case E: ALL THREE MATCH: company name + industry + location -> DUPLICATE WARNING!
    check_all_match = await acc_service.check_duplicate_account(
        ctx=ctx_owner_a,
        name="accenture",
        industry="technology",
        location="India",
    )
    assert check_all_match is not None
    assert check_all_match["is_duplicate_warning"] is True
    assert check_all_match["existing_account_id"] == str(base_acc.id)

    # Creating without allow_separate_account raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await acc_service.create_account(
            ctx=ctx_owner_a,
            name="Accenture",
            industry="Technology",
            address="India",
            allow_separate_account=False,
        )
    assert "already exists" in str(exc_info.value)

    # Creating WITH allow_separate_account=True succeeds
    second_acc = await acc_service.create_account(
        ctx=ctx_owner_a,
        name="Accenture",
        industry="Technology",
        address="India",
        allow_separate_account=True,
    )
    await db_session.flush()
    assert second_acc.id != base_acc.id


@pytest.mark.asyncio
async def test_duplicate_contact_detection(
    db_session: AsyncSession,
    ctx_owner_a: RequestContext,
):
    """
    Verifies that duplicate contact warning triggers ONLY when:
    name + company name + email address (+ optional job title) match.
    """
    from backend.app.application.services.account_service import AccountService
    from backend.app.application.services.contact_service import ContactService
    from backend.app.application.exceptions import ConflictError

    acc_service = AccountService(db_session)
    con_service = ContactService(db_session)

    # Create parent account
    parent_acc = await acc_service.create_account(
        ctx=ctx_owner_a,
        name="Amazon",
        industry="Technology",
        address="Seattle, WA",
    )
    await db_session.flush()

    # Create base contact
    base_con = await con_service.create_contact(
        ctx=ctx_owner_a,
        account_id=parent_acc.id,
        first_name="Gokul",
        last_name="Krishnan",
        email="gokul@amazon.com",
        title="Manager",
    )
    await db_session.flush()

    # Case A: Name only -> NO WARNING
    c_name_only = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company=None,
        email=None,
    )
    assert c_name_only is None

    # Case B: Name + Company, but no email -> NO WARNING
    c_no_email = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Amazon",
        email=None,
    )
    assert c_no_email is None

    # Case C: Name + Company, but different email -> NO WARNING
    c_diff_email = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Amazon",
        email="another.gokul@amazon.com",
    )
    assert c_diff_email is None

    # Case D: Name + Email, but different company -> NO WARNING
    c_diff_company = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Google",
        email="gokul@amazon.com",
    )
    assert c_diff_company is None

    # Case E: Name + Company + Email all match (no title entered) -> DUPLICATE WARNING!
    c_match = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Amazon",
        email="gokul@amazon.com",
    )
    assert c_match is not None
    assert c_match["is_duplicate_warning"] is True
    assert c_match["existing_contact_id"] == str(base_con.id)

    # Case F: Name + Company + Email + matching Title -> DUPLICATE WARNING!
    c_match_title = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Amazon",
        email="gokul@amazon.com",
        title="Manager",
    )
    assert c_match_title is not None
    assert c_match_title["is_duplicate_warning"] is True

    # Case G: Name + Company + Email + different Title ("VP of Sales") -> NO WARNING (distinct roles)
    c_diff_title = await con_service.check_duplicate_contact(
        ctx=ctx_owner_a,
        name="Gokul Krishnan",
        company="Amazon",
        email="gokul@amazon.com",
        title="VP of Sales",
    )
    assert c_diff_title is None

    # Creating duplicate contact without allow_separate_contact raises ConflictError
    with pytest.raises(ConflictError) as exc_info:
        await con_service.create_contact(
            ctx=ctx_owner_a,
            account_id=parent_acc.id,
            first_name="Gokul",
            last_name="Krishnan",
            email="gokul@amazon.com",
            title="Manager",
            allow_separate_contact=False,
        )
    assert "already exists" in str(exc_info.value)

    # Creating WITH allow_separate_contact=True succeeds
    second_con = await con_service.create_contact(
        ctx=ctx_owner_a,
        account_id=parent_acc.id,
        first_name="Gokul",
        last_name="Krishnan",
        email="gokul@amazon.com",
        title="Manager",
        allow_separate_contact=True,
    )
    await db_session.flush()
    assert second_con.id != base_con.id
