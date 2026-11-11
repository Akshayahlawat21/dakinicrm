from typing import Any, Dict, Optional
import httpx
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.data.session import get_db_session
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings

router = APIRouter(prefix="/v1/agent", tags=["AI Copilot Agent"])


class AgentMessageRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


@router.post("", summary="Dakini Copilot Agent query")
async def chat_with_agent(
    body: AgentMessageRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """
    Retrieve tenant-scoped CRM facts from PostgreSQL, then ask Layer 5 to
    synthesize an answer. No client-provided tenant or arbitrary SQL is trusted.
    """
    from sqlalchemy import select, func
    from backend.app.data.models.lead import Lead, LeadConversion
    from backend.app.data.models.deal import Deal, DealProduct, Product
    from backend.app.data.models.campaign import Campaign

    tenant_id = ctx.tenant_uuid
    deal_stmt = select(Deal.stage, Deal.currency, func.count(Deal.id), func.coalesce(func.sum(Deal.amount), 0)).where(
        Deal.organization_id == tenant_id, Deal.deleted_at.is_(None)
    ).group_by(Deal.stage, Deal.currency)
    lead_stmt = select(func.count(Lead.id)).where(
        Lead.organization_id == tenant_id, Lead.deleted_at.is_(None)
    )
    if ctx.is_salesperson:
        deal_stmt = deal_stmt.where(Deal.owner_id == ctx.user_uuid)
        lead_stmt = lead_stmt.where(Lead.assigned_to == ctx.user_uuid)

    active_filters = body.context or {}
    selected_campaign = active_filters.get("campaign_id")
    selected_product = active_filters.get("product_id")
    if selected_campaign and selected_campaign != "all":
        try:
            selected_campaign_uuid = uuid.UUID(str(selected_campaign))
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Invalid campaign filter")
        campaign_lead_ids = select(Lead.id).where(
            Lead.organization_id == tenant_id,
            Lead.campaign_id == selected_campaign_uuid,
            Lead.deleted_at.is_(None),
        )
        deal_stmt = deal_stmt.where(Deal.opportunity_id.in_(
            select(LeadConversion.opportunity_id).where(LeadConversion.lead_id.in_(campaign_lead_ids))
        ))
        lead_stmt = lead_stmt.where(Lead.campaign_id == selected_campaign_uuid)
    if selected_product and selected_product != "all":
        try:
            selected_product_uuid = uuid.UUID(str(selected_product))
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Invalid product filter")
        deal_stmt = deal_stmt.where(Deal.id.in_(
            select(DealProduct.deal_id).where(DealProduct.product_id == selected_product_uuid)
        ))
        lead_stmt = lead_stmt.where(Lead.product_id == selected_product_uuid)
    date_range = str(active_filters.get("date_range") or "").lower()
    days = {"this week": 7, "week": 7, "this month": 31, "month": 31,
            "this quarter": 92, "quarter": 92, "year to date": 365, "ytd": 365,
            "30": 30, "90": 90, "365": 365}.get(date_range)
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        deal_stmt = deal_stmt.where(Deal.created_at >= cutoff)
        lead_stmt = lead_stmt.where(Lead.created_at >= cutoff)

    stage_rows = (await session.execute(deal_stmt)).all()
    lead_count = (await session.execute(lead_stmt)).scalar_one()
    campaign_stmt = select(Campaign.name, Campaign.type, Campaign.status, Campaign.budget, func.count(func.distinct(Lead.id))).join(
        Lead, Lead.campaign_id == Campaign.id
    ).where(
        Campaign.organization_id == tenant_id,
        Lead.organization_id == tenant_id,
        Campaign.deleted_at.is_(None),
        Lead.deleted_at.is_(None),
    ).group_by(Campaign.name).order_by(func.count(func.distinct(Lead.id)).desc()).limit(20)
    if selected_product and selected_product != "all":
        campaign_stmt = campaign_stmt.where(Lead.product_id == selected_product_uuid)
    if selected_campaign and selected_campaign != "all":
        campaign_stmt = campaign_stmt.where(Campaign.id == selected_campaign_uuid)
    if ctx.is_salesperson:
        campaign_stmt = campaign_stmt.where(Lead.assigned_to == ctx.user_uuid)
    if days:
        campaign_stmt = campaign_stmt.where(Lead.created_at >= cutoff)
    campaign_rows = (await session.execute(campaign_stmt)).all()
    product_stmt = select(Product.name, Deal.currency, func.count(func.distinct(Deal.id)), func.coalesce(func.sum(Deal.amount), 0)).join(
        DealProduct, DealProduct.product_id == Product.id
    ).join(Deal, Deal.id == DealProduct.deal_id).where(
        Product.organization_id == tenant_id,
        Deal.organization_id == tenant_id,
        Deal.deleted_at.is_(None),
    ).group_by(Product.name, Deal.currency).order_by(func.count(func.distinct(Deal.id)).desc()).limit(20)
    if selected_campaign and selected_campaign != "all":
        product_stmt = product_stmt.join(
            LeadConversion, LeadConversion.opportunity_id == Deal.opportunity_id
        ).join(Lead, Lead.id == LeadConversion.lead_id).where(Lead.campaign_id == selected_campaign_uuid)
    if selected_product and selected_product != "all":
        product_stmt = product_stmt.where(Product.id == selected_product_uuid)
    if ctx.is_salesperson:
        product_stmt = product_stmt.where(Deal.owner_id == ctx.user_uuid)
    if days:
        product_stmt = product_stmt.where(Deal.created_at >= cutoff)
    product_rows = (await session.execute(product_stmt)).all()

    from backend.app.data.models.account import Account
    recent_deal_stmt = select(
        Deal.name, Account.name.label("company"), Deal.stage, Deal.amount,
        Deal.currency, Deal.created_at
    ).join(Account, Account.id == Deal.account_id).where(
        Deal.organization_id == tenant_id, Deal.deleted_at.is_(None)
    ).order_by(Deal.created_at.desc()).limit(50)
    if ctx.is_salesperson:
        recent_deal_stmt = recent_deal_stmt.where(Deal.owner_id == ctx.user_uuid)
    if selected_campaign and selected_campaign != "all":
        recent_deal_stmt = recent_deal_stmt.where(Deal.opportunity_id.in_(
            select(LeadConversion.opportunity_id).where(LeadConversion.lead_id.in_(campaign_lead_ids))
        ))
    if selected_product and selected_product != "all":
        recent_deal_stmt = recent_deal_stmt.where(Deal.id.in_(
            select(DealProduct.deal_id).where(DealProduct.product_id == selected_product_uuid)
        ))
    if days:
        recent_deal_stmt = recent_deal_stmt.where(Deal.created_at >= cutoff)
    recent_deals = (await session.execute(recent_deal_stmt)).all()

    recent_lead_stmt = select(Lead.name, Lead.company, Lead.source, Lead.status, Lead.score, Lead.created_at).where(
        Lead.organization_id == tenant_id, Lead.deleted_at.is_(None)
    ).order_by(Lead.created_at.desc()).limit(50)
    if ctx.is_salesperson:
        recent_lead_stmt = recent_lead_stmt.where(Lead.assigned_to == ctx.user_uuid)
    if selected_campaign and selected_campaign != "all":
        recent_lead_stmt = recent_lead_stmt.where(Lead.campaign_id == selected_campaign_uuid)
    if selected_product and selected_product != "all":
        recent_lead_stmt = recent_lead_stmt.where(Lead.product_id == selected_product_uuid)
    if days:
        recent_lead_stmt = recent_lead_stmt.where(Lead.created_at >= cutoff)
    recent_leads = (await session.execute(recent_lead_stmt)).all()

    crm_context = {
        "scope": "authenticated tenant only",
        "lead_count": int(lead_count or 0),
        "pipeline_by_stage": [
            {"stage": str(stage), "currency": currency, "deal_count": int(count), "deal_value": float(value or 0)}
            for stage, currency, count, value in stage_rows
        ],
        "campaign_leads": [
            {"campaign": name, "type": campaign_type, "status": status,
             "budget": float(budget or 0), "lead_count": int(count)}
            for name, campaign_type, status, budget, count in campaign_rows
        ],
        "product_pipeline": [
            {"product": name, "currency": currency, "deal_count": int(count), "deal_value": float(value or 0)}
            for name, currency, count, value in product_rows
        ],
        "recent_deals": [
            {"deal": name, "company": company, "stage": stage, "amount": float(amount or 0),
             "currency": currency, "created_at": created_at.isoformat() if created_at else None}
            for name, company, stage, amount, currency, created_at in recent_deals
        ],
        "recent_leads": [
            {"lead": name, "company": company, "source": source, "status": status,
             "score": score, "created_at": created_at.isoformat() if created_at else None}
            for name, company, source, status, score, created_at in recent_leads
        ],
        "active_filters": active_filters,
    }

    url = f"{settings.AI_SERVICE_URL.rstrip('/')}/v1/ai/chat"
    prompt = (
        "Answer the user's CRM question using only the supplied CRM context. "
        "Do not invent names, amounts, counts, dates, or actions. If the context "
        "does not contain enough information, say what is missing. Keep the answer "
        "concise and explain the relevant figures.\n\n"
        f"CRM_CONTEXT={crm_context}\n\nUSER_QUESTION={body.message.strip()}"
    )
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(
                url,
                json={"message": body.message.strip(), "context": crm_context},
                headers=_trusted_ai_headers(ctx),
            )
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(
            status_code=502,
            detail="Layer 5 CRM chat service is unavailable. Check AI_SERVICE_URL and the Layer 5 chat endpoint.",
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"detail": "Layer 5 returned an invalid response"}
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=payload.get("detail", "Layer 5 CRM chat request failed"))
    nested = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    reply = payload.get("reply") or payload.get("answer") or nested.get("reply")
    if not reply:
        raise HTTPException(status_code=502, detail="Layer 5 CRM chat returned no answer")
    return {"status": "success", "sender": "dakini", "reply": str(reply), "data_scope": "tenant"}


class TranscriptAnalysisRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=80_000)


def _trusted_ai_headers(ctx: RequestContext) -> dict[str, str]:
    if not settings.AI_INTERNAL_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI_INTERNAL_API_KEY is not configured in Layer 3 backend/.env",
        )
    return {
        "X-AI-Service-Key": settings.AI_INTERNAL_API_KEY,
        "X-CRM-User-Id": str(ctx.user_id),
        "X-CRM-Tenant-Id": str(ctx.tenant_id),
        "X-CRM-User-Role": str(ctx.role),
        "X-Correlation-ID": str(ctx.correlation_id),
    }


@router.post(
    "/transcript-analysis",
    summary="Analyze a sales-call transcript and return Summary + Improvements",
)
async def analyze_transcript(
    body: TranscriptAnalysisRequest,
    ctx: RequestContext = Depends(get_request_context),
):
    """Authenticated Layer 3 bridge to Layer 5. Does not persist transcript or results."""
    url = f"{settings.AI_SERVICE_URL.rstrip('/')}/v1/ai/transcript-analysis"
    try:
        async with httpx.AsyncClient(timeout=50.0) as client:
            response = await client.post(
                url,
                json={"transcript": body.transcript.strip()},
                headers=_trusted_ai_headers(ctx),
            )
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(
            status_code=502,
            detail="Layer 5 transcript-analysis service is unavailable. Check AI_SERVICE_URL and start Layer 5.",
        ) from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"detail": "Layer 5 returned an invalid response"}
    return JSONResponse(status_code=response.status_code, content=payload)
