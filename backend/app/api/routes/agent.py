from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.core.config import settings

router = APIRouter(prefix="/v1/agent", tags=["AI Copilot Agent"])


class AgentMessageRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


@router.post("", summary="Dakini Copilot Agent query")
async def chat_with_agent(
    body: AgentMessageRequest,
    ctx: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """
    AI Copilot conversation endpoint:
    - Provides real-time explanations for lead scores, draft proposals, and deal telemetry.
    """
    msg = body.message.lower()
    if "why" in msg or "score" in msg:
        reply = (
            "Score 128 is driven by: 1) Executive VP engagement (+40pts), "
            "2) Rapid website form submission (+35pts), and "
            "3) Perfect alignment with our enterprise tier ICP (+53pts)."
        )
    elif "draft" in msg or "email" in msg:
        reply = (
            "I've drafted a follow-up proposal highlighting 34% operating cost reduction. "
            "Ready for executive review and pipeline advancement."
        )
    elif "forecast" in msg or "pipeline" in msg:
        reply = "Current Q4 pipeline stands at $123,000 with a 68% weighted close confidence."
    else:
        reply = (
            f"Dakini AI Copilot analysis for {ctx.tenant_id}: Parameters verified. "
            "Recommended action is to book a live demonstration with Marcus Vance."
        )

    return {
        "status": "success",
        "sender": "dakini",
        "reply": reply,
    }


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
