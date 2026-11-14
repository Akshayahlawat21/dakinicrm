from typing import Any, Dict, Optional
import asyncio
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.data.database import get_session_factory
from backend.app.core.config import settings

router = APIRouter(prefix="/v1/agent", tags=["AI Copilot Agent"])


def _summarize_tool_execution(tool_name: str, arguments: dict[str, Any], result: dict[str, Any]) -> str:
    """Generate a clean human-readable summary of a tool execution outcome."""
    if "error" in result:
        return f"Tool execution failed: {result['error']}"

    records = result.get("records") or result.get("leads") or result.get("deals") or result.get("items") or []
    count = result.get("total") or result.get("count") or (len(records) if isinstance(records, list) else None)

    if tool_name == "search_leads":
        status = arguments.get("status")
        status_str = f" with status '{status}'" if status and str(status).lower() != "all" else ""
        return f"Retrieved {count if count is not None else len(records)} leads{status_str}"
    elif tool_name == "search_deals":
        stage = arguments.get("stage")
        stage_str = f" in stage '{stage}'" if stage and str(stage).lower() != "all" else ""
        return f"Retrieved {count if count is not None else len(records)} deals{stage_str}"
    elif tool_name == "get_pipeline_summary":
        stages_count = len(result.get("by_stage", [])) if isinstance(result.get("by_stage"), list) else 0
        return f"Calculated pipeline breakdown across {stages_count or 'active'} stages"
    elif tool_name == "get_leads_summary":
        total_leads = result.get("total_leads", count or 0)
        conv_rate = result.get("conversion_rate_pct", 0)
        return f"Aggregated {total_leads} leads metrics (conversion rate: {conv_rate}%)"
    elif tool_name == "get_team_performance":
        reps_count = len(result.get("performers", [])) if isinstance(result.get("performers"), list) else 0
        total_rev = result.get("total_team_won_revenue", 0)
        return f"Aggregated performance for {reps_count} sales reps (${total_rev:,.0f} won revenue)"
    elif tool_name == "get_crm_overview":
        total_leads = result.get("total_leads_count", 0)
        pipeline_val = result.get("active_pipeline_value", 0)
        return f"Generated executive overview: {total_leads} leads, ${pipeline_val:,.0f} active pipeline"
    elif tool_name == "get_campaign_performance":
        campaigns_count = len(result.get("campaigns", [])) if isinstance(result.get("campaigns"), list) else 0
        return f"Aggregated performance for {campaigns_count or 'active'} campaigns"
    elif tool_name == "get_product_performance":
        products_count = len(result.get("products", [])) if isinstance(result.get("products"), list) else 0
        return f"Summarized performance metrics for {products_count or 'catalog'} products"
    elif tool_name == "get_account_summary":
        return "Aggregated account summaries & associated deal metrics"
    elif tool_name == "search_contacts":
        return f"Found {count if count is not None else len(records)} contacts"
    elif tool_name == "search_activities":
        act_type = arguments.get("type", "activity")
        return f"Found {count if count is not None else len(records)} {act_type} records"
    return f"Completed {tool_name} successfully"


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
    tool_calls_history: list[dict[str, Any]] = []
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

                    steps = [
                        {
                            "id": "step-query-plan",
                            "title": "Query & permission analysis",
                            "status": "completed",
                            "detail": f"Derived filters under verified role '{ctx.role}'",
                        },
                        *[
                            {
                                "id": f"step-{tc['id']}",
                                "title": f"Called tool: {tc['name']}",
                                "status": tc["status"],
                                "tool": tc["name"],
                                "duration_ms": tc["duration_ms"],
                                "detail": tc["summary"],
                                "arguments": tc["arguments"],
                            }
                            for tc in tool_calls_history
                        ],
                        {
                            "id": "step-synthesis",
                            "title": "Response synthesis & grounding",
                            "status": "completed",
                            "detail": "Formatted CRM insights with data boundaries",
                        },
                    ]
                    return {
                        "status": "success",
                        "sender": "dakini",
                        "reply": reply.strip(),
                        "data_scope": "role_scoped",
                        "tools_used": list(dict.fromkeys(tools_used)),
                        "tool_calls": tool_calls_history,
                        "steps": steps,
                    }

                messages.append(assistant_message)
                total_tool_calls += len(tool_calls)
                if total_tool_calls > max_tool_calls:
                    raise HTTPException(
                        status_code=502,
                        detail="The assistant requested too many data operations. Please narrow your question.",
                    )

                async def execute_one_tool(tool_call: dict[str, Any]) -> tuple[str, str, dict[str, Any], dict[str, Any], int]:
                    call_id = str(tool_call.get("id") or f"crm-tool-{total_tool_calls}")
                    function_data = tool_call.get("function") or {}
                    tool_name = str(function_data.get("name") or "")
                    raw_arguments = function_data.get("arguments") or "{}"
                    try:
                        arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else raw_arguments
                        if not isinstance(arguments, dict):
                            raise ValueError("Tool arguments must be a JSON object")
                    except (json.JSONDecodeError, TypeError, ValueError) as exc:
                        return call_id, tool_name, {}, {"error": f"Invalid tool arguments: {str(exc)}"}, 0

                    # AsyncSession is not concurrency-safe. Each independent tool
                    # gets its own short-lived session, so safe calls can run in parallel.
                    factory = get_session_factory()
                    async with factory() as tool_session:
                        try:
                            t0 = time.perf_counter()
                            result = await execute_crm_tool(tool_session, ctx, tool_name, arguments)
                            elapsed_ms = max(1, round((time.perf_counter() - t0) * 1000))
                            return call_id, tool_name, arguments, result, elapsed_ms
                        finally:
                            await tool_session.rollback()

                tool_results = await asyncio.gather(*(execute_one_tool(call) for call in tool_calls))
                for call_id, tool_name, arguments, tool_result, elapsed_ms in tool_results:
                    is_success = "error" not in tool_result
                    if tool_name and is_success:
                        tools_used.append(tool_name)
                    summary = _summarize_tool_execution(tool_name, arguments, tool_result)
                    records = tool_result.get("records") or tool_result.get("leads") or tool_result.get("deals") or []
                    result_count = tool_result.get("total") or tool_result.get("count") or (len(records) if isinstance(records, list) else None)
                    tool_calls_history.append({
                        "id": call_id,
                        "name": tool_name,
                        "arguments": arguments,
                        "status": "completed" if is_success else "failed",
                        "duration_ms": elapsed_ms,
                        "summary": summary,
                        "result_count": result_count,
                    })
                    # To keep token usage bounded and responses snappy, limit long raw record lists
                    # to top 15 rows while keeping aggregates, summary counts and status keys.
                    compact_tool_result = tool_result
                    if isinstance(tool_result, dict):
                        compact_tool_result = dict(tool_result)
                        for key in ("records", "leads", "deals", "contacts", "activities", "campaigns", "products"):
                            if key in compact_tool_result and isinstance(compact_tool_result[key], list) and len(compact_tool_result[key]) > 15:
                                compact_tool_result[key] = compact_tool_result[key][:15]
                                compact_tool_result["_note"] = f"List truncated to 15 items for token efficiency. Total count: {result_count}"

                    messages.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": json.dumps(compact_tool_result, default=str, ensure_ascii=False),
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
