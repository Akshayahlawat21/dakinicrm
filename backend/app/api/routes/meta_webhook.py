import uuid
import hmac
import hashlib
import json
import logging
import asyncio
from typing import Optional, Any
from fastapi import APIRouter, Request, Response, Query, Depends, HTTPException, Header
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import httpx

from backend.app.core.config import settings
from backend.app.core.logging import get_logger
from backend.app.data.session import get_db_session
from backend.app.data.models.lead import Lead, LeadSignal
from backend.app.data.models.organization import Organization
from backend.app.data.models.campaign import Campaign

logger = get_logger("backend.meta_webhook")

router = APIRouter(prefix="/v1/meta-ads", tags=["Meta Ads Webhook"])

DEFAULT_TENANT_ID = uuid.UUID("b4b76cde-a5e0-5ffb-9670-2df601cd5eef")


@router.get("/status")
async def get_meta_integration_status():
    """Diagnostic check for Meta Ads Webhook integration configuration."""
    return {
        "status": "ready",
        "webhook_endpoint": "/v1/meta-ads/webhook",
        "verify_token_configured": bool(settings.META_VERIFY_TOKEN),
        "access_token_configured": bool(settings.META_ACCESS_TOKEN),
        "app_secret_configured": bool(settings.META_APP_SECRET),
        "graph_api_version": settings.META_GRAPH_API_VERSION,
    }


@router.get("/webhook")
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Meta Webhook Challenge Verification (GET /v1/meta-ads/webhook).
    Meta calls this endpoint when configuring or saving the webhook in Developer Dashboard.
    Must return the hub.challenge value as plain text with HTTP 200.
    """
    logger.info(
        f"[Meta Webhook Handshake] mode='{hub_mode}', token='{hub_verify_token}', challenge='{hub_challenge}'"
    )

    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info(f"[Meta Webhook Handshake] ✅ Successfully verified! Returning challenge: {hub_challenge}")
        return PlainTextResponse(content=str(hub_challenge), status_code=200)

    logger.warning(
        f"[Meta Webhook Handshake] ❌ Verification failed. Expected token='{settings.META_VERIFY_TOKEN}', got '{hub_verify_token}'"
    )
    return PlainTextResponse(content="Verification token mismatch", status_code=403)


FORM_TO_CAMPAIGN_MAP: dict[str, str] = {
    "28747409338262190": "AD1_OUTCOME_CASESTUDY_POSTER",
    "2379262659487721": "AD2_DARK_50K_CALLS",
    "1386358516669790": "DAKINI_RESELLER_PARTNER_ABO_NOV26",
    "1166742585708948": "AD1_OUTCOME_CASESTUDY_POSTER",
}


async def resolve_or_create_campaign_for_form(
    session: AsyncSession,
    org_id: uuid.UUID,
    form_id: str,
    form_name: Optional[str] = None,
) -> uuid.UUID:
    """
    Auto-Ad Discovery & Campaign Provisioning:
    Resolves the exact Campaign ID for a Meta form.
    If the form belongs to an existing campaign, returns its ID.
    If it is a brand new ad/form created on Meta, automatically creates a new Campaign record in PostgreSQL.
    """
    target_name = FORM_TO_CAMPAIGN_MAP.get(form_id) or form_name or f"Meta Ad Campaign {form_id}"

    # 1. Check exact match by campaign name
    stmt = select(Campaign.id).where(
        Campaign.organization_id == org_id,
        func.lower(Campaign.name) == target_name.lower(),
        Campaign.deleted_at.is_(None),
    ).limit(1)
    camp_res = await session.execute(stmt)
    existing_id = camp_res.scalar()
    if existing_id:
        return existing_id

    # 2. Check fuzzy keyword matching among existing campaigns
    camps_stmt = select(Campaign.id, Campaign.name).where(
        Campaign.organization_id == org_id,
        Campaign.deleted_at.is_(None),
    )
    all_camps = (await session.execute(camps_stmt)).all()
    t_lower = target_name.lower()
    for c_id, c_name in all_camps:
        cn_lower = c_name.lower()
        if "50k" in t_lower and "50k" in cn_lower:
            return c_id
        if "casestudy" in t_lower and ("casestudy" in cn_lower or "poster" in cn_lower):
            return c_id
        if "reseller" in t_lower and "reseller" in cn_lower:
            return c_id

    # 3. AUTO-DISCOVERY: Create a new Campaign record for this new Meta Ad
    new_camp = Campaign(
        id=uuid.uuid4(),
        organization_id=org_id,
        name=target_name[:100],
        type="Meta Lead Ad",
        status="active",
        budget=0.0,
    )
    session.add(new_camp)
    await session.flush()
    logger.info(f"[Meta Auto-Discovery] ✨ Auto-created new Campaign '{target_name}' (ID: {new_camp.id}) for Meta Form {form_id}")
    return new_camp.id


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Meta Webhook Event Dispatcher (POST /v1/meta-ads/webhook).
    Receives real-time leadgen events from Facebook & Instagram Instant Forms.
    """
    raw_body = await request.body()

    # Verify SHA256 signature if META_APP_SECRET is configured
    if settings.META_APP_SECRET and x_hub_signature_256:
        expected_sig = "sha256=" + hmac.new(
            settings.META_APP_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(x_hub_signature_256, expected_sig):
            logger.warning("[Meta Webhook] ❌ HMAC SHA256 signature validation failed!")
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        logger.error(f"[Meta Webhook] Could not decode JSON payload: {exc}")
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    logger.info(f"[Meta Webhook] 📥 Event received: object={payload.get('object')}")

    # Resolve organization ID for tenant isolation
    org_stmt = select(Organization.id).order_by(Organization.created_at.asc()).limit(1)
    org_res = await session.execute(org_stmt)
    resolved_org_id = org_res.scalar() or DEFAULT_TENANT_ID

    created_leads = []

    # Collect all leadgen values from standard webhook entries or Meta Dashboard test samples
    raw_lead_values = []

    # Format 1: Standard live webhook: {"entry": [{"changes": [{"field": "leadgen", "value": ...}]}]}
    if "entry" in payload:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") == "leadgen":
                    raw_lead_values.append(change.get("value", {}))
    # Format 2: Meta Dashboard Sample: {"sample": {"field": "leadgen", "value": ...}}
    elif "sample" in payload and isinstance(payload.get("sample"), dict):
        sample_obj = payload["sample"]
        if sample_obj.get("field") == "leadgen":
            raw_lead_values.append(sample_obj.get("value", {}))
    # Format 3: Direct format: {"field": "leadgen", "value": ...}
    elif payload.get("field") == "leadgen":
        raw_lead_values.append(payload.get("value", {}))

    for value in raw_lead_values:
        leadgen_id = str(value.get("leadgen_id") or "")
        form_id = str(value.get("form_id") or "")
        page_id = str(value.get("page_id") or "")
        ad_id = str(value.get("ad_id") or "")

        logger.info(
            f"[Meta Lead Capture] Processing leadgen_id='{leadgen_id}', form_id='{form_id}', page_id='{page_id}'"
        )

        # Default values (or custom values from payload if supplied)
        lead_name = value.get("full_name") or value.get("name") or "Meta Instant Form Lead"
        lead_email = value.get("email") or f"lead_{leadgen_id or 'test'}@meta.ads"
        lead_phone = value.get("phone") or value.get("phone_number") or "+1 (555) 019-2834"
        lead_company = value.get("company") or "Meta Inbound Prospect"
        lead_title = value.get("title") or value.get("job_title") or None
        form_answers: dict[str, Any] = {}

        # If META_ACCESS_TOKEN is configured and leadgen_id is real, fetch full data via Graph API
        if settings.META_ACCESS_TOKEN and leadgen_id and leadgen_id != "444444444444":
            try:
                graph_url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{leadgen_id}"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        graph_url,
                        params={"access_token": settings.META_ACCESS_TOKEN}
                    )
                    if resp.status_code == 200:
                        lead_details = resp.json()
                        field_data = lead_details.get("field_data", [])
                        for field in field_data:
                            fname = field.get("name", "").lower()
                            fvals = field.get("values", [])
                            val = fvals[0] if fvals else None
                            if not val:
                                continue
                            form_answers[fname] = val
                            if "email" in fname:
                                lead_email = str(val)[:150]
                            elif "phone" in fname:
                                lead_phone = str(val)[:20]
                            elif "company" in fname or "org" in fname:
                                lead_company = str(val)[:100]
                            elif "title" in fname or "job" in fname:
                                lead_title = str(val)[:100]
                            elif "name" in fname:
                                lead_name = str(val)[:100]
                        logger.info(f"[Meta Lead Retrieved via Graph API] Name='{lead_name}', Phone='{lead_phone}', Email='{lead_email}'")
                    else:
                        logger.warning(f"[Meta Graph API Warning] {resp.status_code}: {resp.text}")
            except Exception as graph_err:
                logger.error(f"[Meta Graph API Error] Failed fetching lead {leadgen_id}: {graph_err}")

        # Filter out Meta Lead Ads Testing Tool leads or dummy data
        if "<test lead:" in lead_name.lower() or "dummy data" in lead_name.lower() or leadgen_id == "444444444444":
            logger.info(f"[Meta Webhook] Skipping Meta developer test lead: {leadgen_id}")
            continue

        # Resolve exact Campaign or Auto-Discover/Provision a new one
        campaign_id = None
        if form_id:
            campaign_id = await resolve_or_create_campaign_for_form(
                session=session,
                org_id=resolved_org_id,
                form_id=form_id,
                form_name=value.get("form_name"),
            )

        # Insert lead into Dakini CRM database
        new_lead = Lead(
            id=uuid.uuid4(),
            organization_id=resolved_org_id,
            name=lead_name,
            company=lead_company,
            title=lead_title,
            email=lead_email,
            phone=lead_phone,
            source="Meta Lead Ads",
            status="New",
            score=85,
            industry="Digital Marketing",
            interested_product="Voice AI Inbound",
            campaign_id=campaign_id,
        )
        session.add(new_lead)
        await session.flush()

        # Store any custom questions/answers as LeadSignals
        for question, answer in form_answers.items():
            if question not in ("full_name", "email", "phone_number"):
                signal = LeadSignal(
                    id=uuid.uuid4(),
                    lead_id=new_lead.id,
                    signal_type="form_response",
                    signal_value=f"{question}: {answer}",
                    score=5,
                )
                session.add(signal)

        created_leads.append(str(new_lead.id))
        logger.info(f"[Meta Lead Created] Successfully created lead ID={new_lead.id} ({lead_name})")

    await session.commit()

    return {
        "status": "EVENT_RECEIVED",
        "processed_leads": created_leads,
        "count": len(created_leads),
    }


async def get_meta_page_access_token() -> tuple[str, str]:
    """
    Resolves the Page Access Token and Page ID for the Dakini Facebook Page.
    If META_ACCESS_TOKEN is a User Token, calls /me/accounts to exchange for Page Token.
    """
    token = settings.META_ACCESS_TOKEN
    page_id = getattr(settings, "META_PAGE_ID", "576519452217111")
    if not token:
        return "", page_id

    url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/me/accounts"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params={"access_token": token})
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for acct in data:
                    if str(acct.get("id")) == str(page_id) or acct.get("name") == "Dakini":
                        return acct.get("access_token", token), str(acct.get("id", page_id))
                if data:
                    return data[0].get("access_token", token), str(data[0].get("id", page_id))
    except Exception as e:
        logger.warning(f"[Meta Token] Could not fetch accounts from Meta API ({e}), using token directly.")

    return token, page_id


async def get_all_active_forms(page_token: str, page_id: str) -> list[dict]:
    """
    Fetches all active Leadgen Instant Forms under the specified Page.
    Handles pagination so all forms (all active ads) are retrieved.
    """
    url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{page_id}/leadgen_forms"
    forms = []
    params: Optional[dict] = {"access_token": page_token, "limit": 100}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while url:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    logger.error(f"[Meta Forms] Error fetching forms for page {page_id}: {resp.text}")
                    break
                payload = resp.json()
                data = payload.get("data", [])
                for f in data:
                    if f.get("status", "ACTIVE").upper() == "ACTIVE":
                        forms.append(f)
                url = payload.get("paging", {}).get("next")
                params = None
    except Exception as e:
        logger.error(f"[Meta Forms] Exception querying forms: {e}")

    return forms


@router.post("/sync")
async def sync_meta_leads(
    form_id: Optional[str] = None,
    dry_run: bool = False,
    session: AsyncSession = Depends(get_db_session),
):
    """
    On-demand sync & polling engine:
    Queries Meta Graph API for all leads across all active forms (or a single form_id)
    and inserts missing leads into Dakini CRM.
    """
    if not settings.META_ACCESS_TOKEN:
        raise HTTPException(
            status_code=400,
            detail="META_ACCESS_TOKEN is not configured in backend environment."
        )

    page_token, page_id = await get_meta_page_access_token()
    if not page_token:
        page_token = settings.META_ACCESS_TOKEN

    # Determine target forms: either a single specified form, or all active forms on the page
    target_forms = []
    if form_id:
        target_forms = [{"id": form_id, "name": f"Form {form_id}"}]
    else:
        all_forms = await get_all_active_forms(page_token, page_id)
        target_forms = [f for f in all_forms if f.get("status", "ACTIVE").upper() == "ACTIVE"]
        if not target_forms and all_forms:
            target_forms = all_forms

    synced_ids = []
    total_leads_seen = 0
    default_org_id = uuid.UUID("b4b76cde-a5e0-5ffb-9670-2df601cd5eef")

    # High-speed parallel lead fetching across all active forms
    async def fetch_leads_for_form(client: httpx.AsyncClient, f_obj: dict) -> tuple[dict, list[dict]]:
        fid = f_obj["id"]
        leads_url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{fid}/leads"
        try:
            r = await client.get(leads_url, params={"access_token": page_token, "limit": 100})
            if r.status_code == 200:
                return f_obj, r.json().get("data", [])
        except Exception as err:
            logger.warning(f"[Meta Sync] Error querying form {fid}: {err}")
        return f_obj, []

    async with httpx.AsyncClient(timeout=12.0) as client:
        form_tasks = [fetch_leads_for_form(client, f) for f in target_forms]
        form_results = await asyncio.gather(*form_tasks)

    for form_obj, leads_data in form_results:
        f_id = form_obj["id"]
        f_name = form_obj.get("name")
        total_leads_seen += len(leads_data)

        # Only process active forms that actually have leads (ignore 0-lead draft/archived forms)
        if not leads_data:
            continue

        # Resolve exact Campaign or Auto-Discover/Provision a new one in PostgreSQL
        assigned_campaign_id = await resolve_or_create_campaign_for_form(
            session=session,
            org_id=default_org_id,
            form_id=f_id,
            form_name=f_name,
        )

        for item in leads_data:
            leadgen_id = item.get("id")
            field_data = item.get("field_data", [])

            lead_name = "Meta Lead"
            lead_email = f"lead_{leadgen_id}@meta.ads"
            lead_phone = "+1 (555) 000-0000"
            lead_company = "Meta Inbound Prospect"
            lead_title = None
            form_answers = {}

            for f in field_data:
                fname = f.get("name", "").lower()
                val = f.get("values", [None])[0]
                if not val:
                    continue
                form_answers[fname] = val
                if "email" in fname:
                    lead_email = str(val)[:150]
                elif "phone" in fname:
                    lead_phone = str(val)[:20]
                elif "company" in fname or "org" in fname:
                    lead_company = str(val)[:100]
                elif "title" in fname or "job" in fname:
                    lead_title = str(val)[:100]
                elif "name" in fname:
                    lead_name = str(val)[:100]

            # Filter out Meta Lead Ads Testing Tool leads or dummy data
            if "<test lead:" in lead_name.lower() or "dummy data" in lead_name.lower() or "<test lead:" in lead_phone.lower():
                continue

            # Deduplication check by organization and email
            existing = await session.execute(
                select(Lead.id).where(
                    Lead.organization_id == default_org_id,
                    Lead.email == lead_email,
                    Lead.deleted_at.is_(None),
                )
            )
            if existing.scalar():
                continue

            if dry_run:
                synced_ids.append(f"dry_run:{leadgen_id}:{lead_email}")
                continue

            new_lead = Lead(
                id=uuid.uuid4(),
                organization_id=default_org_id,
                name=lead_name,
                company=lead_company,
                title=lead_title,
                email=lead_email,
                phone=lead_phone,
                source="Meta Lead Ads",
                status="New",
                score=85,
                industry="Digital Marketing",
                interested_product="Voice AI Inbound",
                campaign_id=assigned_campaign_id,
            )
            session.add(new_lead)
            await session.flush()

            for q, a in form_answers.items():
                if q not in ("full_name", "first_name", "last_name", "email", "phone_number"):
                    signal = LeadSignal(
                        id=uuid.uuid4(),
                        lead_id=new_lead.id,
                        signal_type="form_response",
                        signal_value=f"{q}: {a}",
                        score=5,
                    )
                    session.add(signal)

            synced_ids.append(str(new_lead.id))

    if not dry_run:
        await session.commit()

    return {
        "status": "success",
        "forms_scanned": len(target_forms),
        "synced_leads": synced_ids,
        "count": len(synced_ids),
        "total_on_meta": total_leads_seen,
        "dry_run": dry_run,
    }


async def start_meta_lead_poller(interval_seconds: int = 15):
    """
    Background poller that continuously syncs leads from Meta Graph API
    and auto-provisions new campaigns every interval_seconds.
    Runs 24/7 with auto-recovery and exponential backoff on errors.
    """
    from backend.app.data.database import get_session_factory
    enabled = getattr(settings, "META_POLLER_ENABLED", True)
    logger.info(f"[Meta Poller] 🚀 Background poller active (Interval: {interval_seconds}s, Active: {enabled})")

    error_streak = 0
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            if not getattr(settings, "META_POLLER_ENABLED", True):
                continue
            if not settings.META_ACCESS_TOKEN:
                continue

            factory = get_session_factory()
            async with factory() as session:
                result = await sync_meta_leads(session=session)
                if result.get("count", 0) > 0:
                    logger.info(f"[Meta Poller] 📥 Auto-ingested {result['count']} new lead(s) across {result.get('forms_scanned', 0)} active forms!")
            error_streak = 0
        except asyncio.CancelledError:
            logger.info("[Meta Poller] Background poller stopped.")
            break
        except Exception as e:
            error_streak += 1
            delay = min(60, 5 * error_streak)
            logger.warning(f"[Meta Poller] Auto-sync retry in {delay}s: {e}")
            await asyncio.sleep(delay)



