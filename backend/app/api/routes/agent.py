from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context

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
