from typing import Any, Dict, Optional
import asyncio
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.data.database import get_session_factory
from backend.app.core.config import settings

router = APIRouter(prefix="/v1/agent", tags=["AI Copilot Agent"])


class AgentHistoryMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=2000)


class AgentMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[AgentHistoryMessage] = Field(default_factory=list, max_length=8)
    # Accepted for backwards compatibility only. Client-provided filters/context
    # are intentionally not used; the LLM selects filters through allow-listed tools.
    context: Optional[Dict[str, Any]] = None


@router.post("", summary="Dakini Copilot Agent query")
async def chat_with_agent(
    body: AgentMessageRequest,
    ctx: RequestContext = Depends(get_request_context),
) -> Dict[str, Any]:
    """Run a bounded LLM tool-calling loop against role-scoped CRM read tools."""
    import json
    from backend.app.application.services.ai_crm_tools import (
        CRM_TOOL_DEFINITIONS,
        execute_crm_tool,
    )

    if not settings.AI_SERVICE_URL:
        raise HTTPException(status_code=503, detail="AI_SERVICE_URL is not configured in Layer 3")

    # Only conversational text is accepted from the browser. Identity, tenant,
    # and role scope are always taken from the verified RequestContext.
    messages: list[dict[str, Any]] = []
    for item in body.history[-8:]:
        role = item.role.strip().lower()
        if role in {"user", "assistant"}:
            messages.append({"role": role, "content": item.content[:2000]})
    messages.append({"role": "user", "content": body.message.strip()})

    url = f"{settings.AI_SERVICE_URL.rstrip('/')}/v1/ai/chat"
    tools_used: list[str] = []
    total_tool_calls = 0
    max_round_trips = 4
    max_tool_calls = 8

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            for _round in range(max_round_trips):
                response = await client.post(
                    url,
                    json={"messages": messages, "tools": CRM_TOOL_DEFINITIONS},
                    headers=_trusted_ai_headers(ctx),
                )
                try:
                    payload = response.json()
                except ValueError:
                    payload = {"detail": "Layer 5 returned an invalid response"}
                if response.status_code >= 400:
                    upstream_status = response.status_code
                    # Preserve actionable provider states (especially Gemini quota
                    # exhaustion) so the frontend can display the correct message.
                    if upstream_status not in {400, 401, 403, 429, 502, 503, 504}:
                        upstream_status = 502
                    raise HTTPException(
                        status_code=upstream_status,
                        detail=payload.get("detail", "Layer 5 CRM chat request failed"),
                        headers=response.headers if upstream_status == 429 else None,
                    )

                assistant_message = payload.get("message")
                if not isinstance(assistant_message, dict):
                    raise HTTPException(status_code=502, detail="Layer 5 returned an invalid assistant message")

                tool_calls = assistant_message.get("tool_calls") or []
                if not tool_calls:
                    reply = assistant_message.get("content")
                    if isinstance(reply, list):
                        reply = "\n".join(
                            str(part.get("text", "")) for part in reply if isinstance(part, dict)
                        )
                    if not isinstance(reply, str) or not reply.strip():
                        raise HTTPException(status_code=502, detail="Layer 5 CRM chat returned no answer")
                    return {
                        "status": "success",
                        "sender": "dakini",
                        "reply": reply.strip(),
                        "data_scope": "role_scoped",
                        "tools_used": list(dict.fromkeys(tools_used)),
                    }

                messages.append(assistant_message)
                total_tool_calls += len(tool_calls)
                if total_tool_calls > max_tool_calls:
                    raise HTTPException(
                        status_code=502,
                        detail="The assistant requested too many data operations. Please narrow your question.",
                    )

                async def execute_one_tool(tool_call: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
                    call_id = str(tool_call.get("id") or f"crm-tool-{total_tool_calls}")
                    function_data = tool_call.get("function") or {}
                    tool_name = str(function_data.get("name") or "")
                    raw_arguments = function_data.get("arguments") or "{}"
                    try:
                        arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else raw_arguments
                        if not isinstance(arguments, dict):
                            raise ValueError("Tool arguments must be a JSON object")
                    except (json.JSONDecodeError, TypeError, ValueError) as exc:
                        return call_id, tool_name, {"error": f"Invalid tool arguments: {str(exc)}"}

                    # AsyncSession is not concurrency-safe. Each independent tool
                    # gets its own short-lived session, so safe calls can run in parallel.
                    factory = get_session_factory()
                    async with factory() as tool_session:
                        try:
                            result = await execute_crm_tool(tool_session, ctx, tool_name, arguments)
                            return call_id, tool_name, result
                        finally:
                            await tool_session.rollback()

                tool_results = await asyncio.gather(*(execute_one_tool(call) for call in tool_calls))
                for call_id, tool_name, tool_result in tool_results:
                    if tool_name and "error" not in tool_result:
                        tools_used.append(tool_name)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": json.dumps(tool_result, default=str, ensure_ascii=False),
                    })
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        raise HTTPException(
            status_code=502,
            detail="Layer 5 CRM chat service is unavailable. Check AI_SERVICE_URL and the Layer 5 chat endpoint.",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Unable to reach the Layer 5 CRM chat service") from exc

    raise HTTPException(
        status_code=502,
        detail="The assistant could not complete the requested data analysis. Please try a more specific question.",
    )


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
