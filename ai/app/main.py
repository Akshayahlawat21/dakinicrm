import logging
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.security import AIRequestContext, get_ai_context
from app.transcript_analysis import analyze_call_transcript


# Use Uvicorn's error logger so warning-level diagnostics are visible in the
# same terminal that runs the FastAPI application.
logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.INFO)


class TranscriptAnalysisRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=80_000)


app = FastAPI(
    title="Dakini CRM — Layer 5 AI & Transcript Service",
    description=(
        "Provides CRM chat tool-call responses for authenticated Layer 3 orchestration "
        "and structured sales-call transcript analysis. Layer 5 does not access the CRM database."
    ),
    version="2.1.0",
)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "service": "layer5-ai"}


@app.post(
    "/v1/ai/transcript-analysis",
    tags=["transcript analysis"],
    summary="Generate Summary and Improvements from a call transcript",
)
async def transcript_analysis(
    body: TranscriptAnalysisRequest,
    ctx: AIRequestContext = Depends(get_ai_context),
):
    outputs = await analyze_call_transcript(body.transcript)
    return {"status": "success", "outputs": outputs, "persisted": False}


class CRMChatRequest(BaseModel):
    messages: list[dict] = Field(min_length=1, max_length=24)
    tools: list[dict] = Field(default_factory=list, max_length=12)


def _first_token_value(usage: dict[str, Any], keys: tuple[str, ...]):
    """Return the first available token count without treating missing as zero."""
    for key in keys:
        value = usage.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return value
    return None


def _log_gemini_token_usage(payload: dict[str, Any], model: str) -> None:
    """Log token usage from either Gemini-native or OpenAI-compatible responses."""
    usage = payload.get("usage")
    usage_format = "openai-compatible"

    if not isinstance(usage, dict) or not usage:
        usage = payload.get("usageMetadata")
        usage_format = "gemini-native"

    if not isinstance(usage, dict) or not usage:
        usage = payload.get("usage_metadata")
        usage_format = "gemini-native"

    if not isinstance(usage, dict) or not usage:
        logger.warning(
            "AI TOKEN USAGE UNAVAILABLE | model=%s | response_keys=%s",
            model,
            sorted(payload.keys()),
        )
        return

    input_tokens = _first_token_value(
        usage,
        ("prompt_tokens", "promptTokenCount", "input_tokens", "inputTokenCount"),
    )
    output_tokens = _first_token_value(
        usage,
        (
            "completion_tokens",
            "candidatesTokenCount",
            "output_tokens",
            "outputTokenCount",
        ),
    )
    total_tokens = _first_token_value(
        usage,
        ("total_tokens", "totalTokenCount", "totalTokens"),
    )
    thought_tokens = _first_token_value(
        usage,
        ("thoughtsTokenCount", "thought_tokens"),
    )
    tool_use_tokens = _first_token_value(
        usage,
        ("toolUsePromptTokenCount", "tool_use_prompt_tokens"),
    )

    logger.warning(
        "AI TOKEN USAGE | model=%s | format=%s | input=%s | output=%s | total=%s | thoughts=%s | tool_use=%s",
        model,
        usage_format,
        input_tokens if input_tokens is not None else "unavailable",
        output_tokens if output_tokens is not None else "unavailable",
        total_tokens if total_tokens is not None else "unavailable",
        thought_tokens if thought_tokens is not None else "unavailable",
        tool_use_tokens if tool_use_tokens is not None else "unavailable",
    )


@app.post(
    "/v1/ai/chat",
    tags=["CRM copilot"],
    summary="Generate a CRM answer or request a controlled Layer 3 data tool",
)
async def crm_chat(
    body: CRMChatRequest,
    ctx: AIRequestContext = Depends(get_ai_context),
):
    settings = get_settings()

    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on Layer 5",
        )
    system_prompt = """
You are Dakini, an intelligent, evidence-based CRM copilot and sales analyst.

Help users understand their CRM, retrieve business information, analyze performance, and make better decisions.

Use authenticated, read-only CRM tools as the source of truth.

## 1. INTENT UNDERSTANDING

Classify every request:

- Conceptual: Explain definitions, formulas and CRM concepts without database calls.
- Data: Retrieve actual CRM records and metrics using relevant tools.
- Mixed: Explain concepts and retrieve actual data when requested.
- Follow-up: Understand conversation context. Fetch fresh data for current figures.

## 2. CRM TOOL ROUTING

Use the minimum relevant tools:

- Overall business: get_crm_overview
- Lead metrics and sources: get_leads_summary
- Individual leads: search_leads
- Pipeline and forecasts: get_pipeline_summary
- Individual deals: search_deals
- Team performance: get_team_performance
- Campaigns and ROI: get_campaign_performance
- Products and SKU performance: get_product_performance
- Accounts: get_account_summary
- Contacts: search_contacts
- Tasks and activities: search_activities

Never invent tool names, parameters or results.

## 3. TOOL EXECUTION

- Always retrieve actual data for organization-specific questions.
- Parallelize independent tool calls when useful.
- Avoid redundant calls and repeated successful queries.
- Follow tool schemas and execution limits.
- Never expose internal tool details.
- Do not call all tools for general questions.

## 4. ACCURACY AND ERROR HANDLING

- Never fabricate CRM information.
- Preserve returned currencies, dates and units.
- Distinguish actual and weighted pipeline.
- Label calculated metrics.
- Never interpret missing data as zero.
- Never claim unsupported trends.

Zero records: Say "No matching records were found in the current CRM view."

Tool failure: Never report it as zero. Retry transient failures at most once when appropriate. Explain retrieval failures honestly.

Partial failure: Present successful results and identify unavailable information.

## 5. BUSINESS INTELLIGENCE

For analytical questions:
- Identify relevant KPIs.
- Compare available metrics.
- Highlight supported trends and bottlenecks.
- Explain business implications.
- Provide 1-2 actionable recommendations.

Separate actual observations from assumptions.

## 6. RESPONSE STYLE

Be professional, conversational and concise.

For analytical answers, use:
1. Direct answer.
2. Important metrics.
3. Comparison table when useful.
4. Business insights.
5. Practical recommendations.

For simple questions, answer directly without unnecessary explanations.

## 7. VISUALIZATION - PIE CHART DEFAULT

PIE CHART is the default visualization for meaningful CRM distributions.

- pie: Lead sources, deal stages, statuses, campaign shares and category distributions.
- bar: Numerical comparisons, rankings and more than 10 categories.
- line: Chronological revenue, lead and performance trends.

Rules:
- Prefer pie charts for meaningful distributions.
- Generate charts only when sufficient data exists.
- Never invent or estimate values.
- Do not generate charts for simple single-number KPI answers.
- Generate at most one chart.
- Put charts at the end.

Exact output format:

```crm-chart
{
  "type": "pie",
  "title": "Lead Distribution",
  "labels": ["Organic", "Referral", "Campaign"],
  "series": [
    {"name": "Leads", "data": [45, 30, 25]}
  ]
}
```

Use only actual tool results or explicitly calculated values.

## 8. SECURITY

Backend authentication, tenant isolation and RBAC are authoritative.

Never bypass permissions or expose credentials and protected information.

## FINAL PRIORITIES

Correct understanding > Accurate data > Relevant tools > Useful insights > Fast responses > Low token consumption.

Be a reliable CRM business analyst.
"""

    messages = [{"role": "system", "content": system_prompt}]
    allowed_roles = {"user", "assistant", "tool"}

    for item in body.messages[-12:]:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role") or "").lower()
        if role not in allowed_roles:
            continue

        content = item.get("content")
        normalized = {"role": role}

        if content is not None:
            normalized["content"] = str(content)[:12_000]

        if role == "assistant" and isinstance(item.get("tool_calls"), list):
            normalized["tool_calls"] = item["tool_calls"][:8]

        if role == "tool" and item.get("tool_call_id"):
            normalized["tool_call_id"] = str(item["tool_call_id"])[:100]

        messages.append(normalized)

    url = settings.gemini_base_url.rstrip("/") + "/chat/completions"

    request_payload: dict[str, Any] = {
        "messages": messages,
        "max_tokens": 1200,
    }

    if body.tools:
        request_payload["tools"] = body.tools
        request_payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {settings.gemini_api_key}",
        "Content-Type": "application/json",
    }

    # Gemini model selection with fallback if a model is deprecated/unrecognized
    model_chain = settings.gemini_model_chain
    last_exception = None

    for model in model_chain:
        model_payload = {**request_payload, "model": model}
        logger.warning("LAYER5 CRM CHAT: sending request to Gemini | model=%s", model)

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(
                    settings.gemini_timeout_seconds,
                    connect=5.0,
                )
            ) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    json=model_payload,
                )
                response.raise_for_status()

            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Gemini returned a non-object JSON response")

            # Log token counts for every Gemini response. Missing fields are reported
            # as unavailable, never as zero, so the log does not misrepresent usage.
            _log_gemini_token_usage(payload, model)

            choices = payload.get("choices")
            if not isinstance(choices, list) or not choices:
                raise ValueError("Gemini response did not contain any choices")

            first_choice = choices[0]
            if not isinstance(first_choice, dict):
                raise ValueError("Gemini returned an invalid choice")

            assistant_message = first_choice.get("message")
            if not isinstance(assistant_message, dict):
                raise ValueError("Gemini returned an invalid assistant message")

            if not assistant_message.get("content") and not assistant_message.get("tool_calls"):
                raise ValueError("Gemini returned an empty CRM response")

            logger.info("Gemini CRM chat succeeded: model=%s", model)

            return {
                "status": "success",
                "message": assistant_message,
                "model": model,
                "persisted": False,
            }

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            provider_body = (exc.response.text or "")[:1200]
            if settings.gemini_api_key:
                provider_body = provider_body.replace(settings.gemini_api_key, "[REDACTED]")

            logger.error(
                "Gemini provider failed: status=%s model=%s body=%s",
                status,
                model,
                provider_body,
            )

            # If the model name is 404/not found, try the next model in the fallback chain!
            if status == 404 and model != model_chain[-1]:
                logger.warning("Model %s returned 404 not found, attempting fallback...", model)
                last_exception = exc
                continue

            body_lower = provider_body.lower()
            daily_quota = status == 429 and any(
                marker in body_lower
                for marker in ("per_day", "per day", "requests_per_day", "daily")
            )

            if daily_quota:
                raise HTTPException(
                    status_code=429,
                    detail="Gemini daily API quota has been reached. Please try again after the quota resets.",
                    headers={"Retry-After": "3600"},
                ) from exc

            if status == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Gemini is rate-limiting requests. Please wait briefly and try again.",
                    headers={"Retry-After": "30"},
                ) from exc

            if status in {500, 502, 503, 504}:
                raise HTTPException(
                    status_code=503,
                    detail="Gemini is temporarily unavailable. Please try again shortly.",
                    headers={"Retry-After": "10"},
                ) from exc

            raise HTTPException(
                status_code=502,
                detail=f"Gemini provider returned HTTP {status}. Check the Layer 5 log for diagnostics.",
            ) from exc

        except httpx.TimeoutException as exc:
            logger.error(
                "Gemini request timed out after %ss (model=%s)",
                settings.gemini_timeout_seconds,
                model,
            )
            # If there's another model in the chain, try fallback before erroring out
            if model != model_chain[-1]:
                logger.warning("Model %s timed out, attempting fallback model...", model)
                last_exception = exc
                continue
            raise HTTPException(
                status_code=504,
                detail="Gemini did not respond before the request timeout. Please try again.",
            ) from exc

        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            logger.exception(
                "Unable to generate CRM-grounded response from Gemini (%s): %s",
                model,
                type(exc).__name__,
            )
            if model != model_chain[-1]:
                logger.warning("Model %s failed with %s, attempting fallback...", model, type(exc).__name__)
                last_exception = exc
                continue
            raise HTTPException(
                status_code=502,
                detail="Unable to generate a CRM-grounded response from the configured Gemini provider",
            ) from exc
