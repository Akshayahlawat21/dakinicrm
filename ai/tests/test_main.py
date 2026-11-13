import pytest

from app.main import app


def test_layer5_exposes_transcript_analysis_and_crm_chat_apis():
    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in app.routes
        if hasattr(route, "methods")
    }
    assert ("/health", ("GET",)) in paths
    assert ("/v1/ai/transcript-analysis", ("POST",)) in paths
    assert ("/v1/ai/chat", ("POST",)) in paths
    assert not any("lead-score" in path for path, _methods in paths)


def test_layer5_business_api_routes_are_explicitly_registered():
    business_paths = {
        route.path
        for route in app.routes
        if hasattr(route, "methods") and route.path.startswith("/v1/")
    }
    assert business_paths == {"/v1/ai/transcript-analysis", "/v1/ai/chat"}


@pytest.mark.asyncio
async def test_crm_chat_passes_tools_to_gemini_and_preserves_tool_calls(monkeypatch):
    from types import SimpleNamespace
    from app import main
    from app.main import CRMChatRequest, crm_chat
    from app.security import AIRequestContext

    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {
                "role": "assistant",
                "content": None,
                "tool_calls": [{
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "search_deals", "arguments": "{\\\"stage\\\":\\\"Negotiation\\\"}"},
                }],
            }}]}

    class FakeClient:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, headers, json):
            captured["url"] = url
            captured["headers"] = headers
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        gemini_api_key="test-key",
        gemini_base_url="https://example.invalid/v1beta/openai",
        gemini_model="gemini-test",
        gemini_timeout_seconds=10,
    ))
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)
    tool_definition = {"type": "function", "function": {"name": "search_deals", "parameters": {"type": "object"}}}
    result = await crm_chat(
        CRMChatRequest(messages=[{"role": "user", "content": "Show negotiation deals"}], tools=[tool_definition]),
        AIRequestContext(tenant_id="11111111-1111-1111-1111-111111111111", user_id="22222222-2222-2222-2222-222222222222", role="manager"),
    )

    assert captured["payload"]["tools"] == [tool_definition]
    assert captured["payload"]["tool_choice"] == "auto"
    assert result["message"]["tool_calls"][0]["function"]["name"] == "search_deals"


@pytest.mark.asyncio
async def test_crm_chat_does_not_retry_or_fallback_on_provider_error(monkeypatch):
    import httpx
    from types import SimpleNamespace
    from fastapi import HTTPException
    from app import main
    from app.main import CRMChatRequest, crm_chat
    from app.security import AIRequestContext

    calls = {"count": 0}
    class FakeResponse:
        status_code = 503
        text = '{"error":"temporary upstream failure"}'
        def raise_for_status(self):
            request = httpx.Request("POST", "https://example.invalid/chat/completions")
            response = httpx.Response(503, request=request, text=self.text)
            raise httpx.HTTPStatusError("upstream failure", request=request, response=response)

    class FakeClient:
        def __init__(self, timeout): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *_args): return None
        async def post(self, *_args, **_kwargs):
            calls["count"] += 1
            return FakeResponse()

    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        gemini_api_key="test-key",
        gemini_base_url="https://example.invalid/v1beta/openai",
        gemini_model="gemini-primary",
        gemini_timeout_seconds=10,
    ))
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)
    with pytest.raises(HTTPException) as error:
        await crm_chat(
            CRMChatRequest(messages=[{"role": "user", "content": "Show my open deals"}]),
            AIRequestContext(
                tenant_id="11111111-1111-1111-1111-111111111111",
                user_id="22222222-2222-2222-2222-222222222222",
                role="manager",
            ),
        )
    assert calls["count"] == 1
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_crm_chat_uses_only_configured_gemini_model(monkeypatch):
    import httpx
    from types import SimpleNamespace
    from app import main
    from app.main import CRMChatRequest, crm_chat
    from app.security import AIRequestContext

    models = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"role": "assistant", "content": "Found 3 open deals."}}]}

    class FakeClient:
        def __init__(self, timeout):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *_args):
            return None
        async def post(self, _url, headers, json):
            models.append(json["model"])
            return FakeResponse()

    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        gemini_api_key="test-key",
        gemini_base_url="https://example.invalid/v1beta/openai",
        gemini_model="gemini-primary",
        gemini_timeout_seconds=1,
    ))
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)

    result = await crm_chat(
        CRMChatRequest(messages=[{"role": "user", "content": "Show open deals"}]),
        AIRequestContext(
            tenant_id="11111111-1111-1111-1111-111111111111",
            user_id="22222222-2222-2222-2222-222222222222",
            role="manager",
        ),
    )
    assert models == ["gemini-primary"]
    assert result["model"] == "gemini-primary"


def test_gemini_model_chain_contains_only_primary_model():
    from app.config import Settings
    settings = Settings(
        GEMINI_MODEL="gemini-primary",
        GEMINI_FALLBACK_MODELS="gemini-secondary,gemini-tertiary",
    )
    assert settings.gemini_model_chain == ["gemini-primary"]


@pytest.mark.asyncio
async def test_daily_quota_error_is_returned_as_429_without_fallback(monkeypatch):
    import httpx
    from types import SimpleNamespace
    from fastapi import HTTPException
    from app import main
    from app.main import CRMChatRequest, crm_chat
    from app.security import AIRequestContext

    calls = {"count": 0}
    class FakeResponse:
        status_code = 429
        text = '{"error":{"message":"Generate content requests per day limit exceeded on Free Tier"}}'
        def raise_for_status(self):
            request = httpx.Request("POST", "https://example.invalid/chat/completions")
            response = httpx.Response(429, request=request, text=self.text)
            raise httpx.HTTPStatusError("quota", request=request, response=response)

    class FakeClient:
        def __init__(self, timeout): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *_args): return None
        async def post(self, *_args, **_kwargs):
            calls["count"] += 1
            return FakeResponse()

    monkeypatch.setattr(main, "get_settings", lambda: SimpleNamespace(
        gemini_api_key="test-key",
        gemini_base_url="https://example.invalid/v1beta/openai",
        gemini_model="gemini-primary",
        gemini_timeout_seconds=1,
    ))
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeClient)

    with pytest.raises(HTTPException) as error:
        await crm_chat(
            CRMChatRequest(messages=[{"role": "user", "content": "How many leads?"}]),
            AIRequestContext(
                tenant_id="11111111-1111-1111-1111-111111111111",
                user_id="22222222-2222-2222-2222-222222222222",
                role="manager",
            ),
        )
    assert error.value.status_code == 429
    assert "daily API quota" in error.value.detail
    assert calls["count"] == 1
