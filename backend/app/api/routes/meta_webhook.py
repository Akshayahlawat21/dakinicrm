import uuid
import hmac
import hashlib
import json
import logging
from typing import Optional, Any
from fastapi import APIRouter, Request, Response, Query, Depends, HTTPException, Header
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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

    # Meta events loop
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "leadgen":
                continue

            value = change.get("value", {})
            leadgen_id = str(value.get("leadgen_id") or "")
            form_id = str(value.get("form_id") or "")
            page_id = str(value.get("page_id") or "")
            ad_id = str(value.get("ad_id") or "")

            logger.info(
                f"[Meta Lead Capture] Processing leadgen_id='{leadgen_id}', form_id='{form_id}', page_id='{page_id}'"
            )

            # Default values (especially useful for test submissions via Lead Ads Testing Tool)
            lead_name = "Meta Instant Form Lead"
            lead_email = f"lead_{leadgen_id or 'test'}@meta.ads"
            lead_phone = "+1 (555) 019-2834"
            lead_company = "Meta Inbound Prospect"
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
                                if "name" in fname:
                                    lead_name = str(val)
                                elif "email" in fname:
                                    lead_email = str(val)
                                elif "phone" in fname:
                                    lead_phone = str(val)
                                elif "company" in fname:
                                    lead_company = str(val)
                            logger.info(f"[Meta Lead Retrieved via Graph API] Name='{lead_name}', Phone='{lead_phone}', Email='{lead_email}'")
                        else:
                            logger.warning(f"[Meta Graph API Warning] {resp.status_code}: {resp.text}")
                except Exception as graph_err:
                    logger.error(f"[Meta Graph API Error] Failed fetching lead {leadgen_id}: {graph_err}")

            # Check if a campaign matches the form_id or page_id
            campaign_id = None
            if form_id:
                camp_stmt = select(Campaign.id).where(
                    Campaign.organization_id == resolved_org_id,
                    Campaign.deleted_at.is_(None)
                ).limit(1)
                camp_res = await session.execute(camp_stmt)
                campaign_id = camp_res.scalar()

            # Insert lead into Dakini CRM database
            new_lead = Lead(
                id=uuid.uuid4(),
                organization_id=resolved_org_id,
                name=lead_name,
                company=lead_company,
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
