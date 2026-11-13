
import json
import uuid

import pytest

from backend.app.api.routes import agent as agent_route
from backend.app.api.routes.agent import AgentMessageRequest, chat_with_agent
from backend.app.application.context import RequestContext
from backend.app.application.services import ai_crm_tools


@pytest.mark.asyncio
async def test_agent_executes_llm_selected_tool_and_returns_grounded_final_answer(
    monkeypatch,
):
    captured_requests = []
    tool_args = []

    responses = [
        {
            "status": "success",
            "message": {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "call_deals_1",
                        "type": "function",
                        "function": {
                            "name": "search_deals",
                            "arguments": json.dumps(
                                {
                                    "stage": "Negotiation",
                                    "date_range": "this_month",
                                }
                            ),
                        },
                    }
                ],
            },
        },
        {
            "status": "success",
            "message": {
                "role": "assistant",
                "content": "There are 3 Negotiation deals this month.",
            },
        },
    ]

    class FakeResponse:
        status_code = 200

        def __init__(self, payload):
            self._payload = payload

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json, headers):
            captured_requests.append(
                {
                    "url": url,
                    "json": json,
                    "headers": headers,
                }
            )
            return FakeResponse(responses.pop(0))

    class FakeSession:
        async def rollback(self):
            pass

    class FakeSessionContext:
        async def __aenter__(self):
            return FakeSession()

        async def __aexit__(self, *_args):
            return None

    async def fake_execute(_session, _ctx, name, arguments):
        tool_args.append((name, arguments))
        return {
            "total": 3,
            "records": [
                {"deal": "Deal A"},
                {"deal": "Deal B"},
                {"deal": "Deal C"},
            ],
        }

    # Mock database session factory
    monkeypatch.setattr(
        agent_route,
        "get_session_factory",
        lambda: lambda: FakeSessionContext(),
    )

    # Mock AI service HTTP client
    monkeypatch.setattr(
        agent_route.httpx,
        "AsyncClient",
        FakeClient,
    )

    monkeypatch.setattr(
        agent_route.settings,
        "AI_SERVICE_URL",
        "http://127.0.0.1:8005",
    )

    monkeypatch.setattr(
        agent_route.settings,
        "AI_INTERNAL_API_KEY",
        "test-internal-key",
    )

    # Mock CRM tool execution
    monkeypatch.setattr(
        ai_crm_tools,
        "execute_crm_tool",
        fake_execute,
    )

    ctx = RequestContext(
        user_id=str(uuid.uuid4()),
        tenant_id=str(uuid.uuid4()),
        role="manager",
        correlation_id="req-test-agent",
    )

    # Execute endpoint
    result = await chat_with_agent(
        AgentMessageRequest(
            message="How many deals are in negotiation this month?",
            history=[
                {
                    "role": "user",
                    "content": "Show my pipeline",
                }
            ],
            context={
                "campaign_id": "client-value-is-ignored",
            },
        ),
        ctx=ctx,
    )

    # Verify final response
    assert result["reply"] == (
        "There are 3 Negotiation deals this month."
    )

    # Verify selected tool
    assert result["tools_used"] == ["search_deals"]

    assert tool_args == [
        (
            "search_deals",
            {
                "stage": "Negotiation",
                "date_range": "this_month",
            },
        )
    ]

    # Verify two AI service requests
    assert len(captured_requests) == 2

    second_messages = captured_requests[1]["json"]["messages"]

    # Verify tool call response is included
    assert any(
        message.get("tool_call_id") == "call_deals_1"
        for message in second_messages
    )

    tool_message = next(
        message
        for message in second_messages
        if message.get("role") == "tool"
    )

    assert '"total": 3' in tool_message["content"]

    # Verify user role is forwarded
    assert (
        captured_requests[0]["headers"]["X-CRM-User-Role"]
        == "manager"
    )
