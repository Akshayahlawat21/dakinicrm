from types import SimpleNamespace

import pytest

from app import transcript_analysis


def test_parse_transcript_analysis_normalizes_both_outputs():
    outputs = transcript_analysis.parse_transcript_analysis('''```json
    {
      "summary": {
        "call_summary": "Customer likes the product but needs SSO.",
        "positive_feedback": ["Easy to use"],
        "negative_feedback": ["SSO is missing"],
        "customer_needs": ["Single sign-on"],
        "buying_signals": ["Will evaluate after SSO is added"]
      },
      "improvements": {
        "conversion_blockers": ["SSO integration"],
        "product_improvements": ["Add SSO"],
        "sales_recommendations": ["Confirm SSO requirements"],
        "next_steps": ["Share requirements with product team"]
      }
    }
    ```''')

    assert outputs["summary"]["call_summary"] == "Customer likes the product but needs SSO."
    assert outputs["summary"]["positive_feedback"] == ["Easy to use"]
    assert outputs["improvements"]["conversion_blockers"] == ["SSO integration"]
    assert outputs["improvements"]["next_steps"] == ["Share requirements with product team"]


@pytest.mark.asyncio
async def test_analyze_call_transcript_returns_outputs_without_database(monkeypatch):
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "choices": [{
                    "message": {
                        "content": '{"summary":{"call_summary":"Needs SSO.","positive_feedback":[],"negative_feedback":["No SSO"],"customer_needs":["SSO"],"buying_signals":[]},"improvements":{"conversion_blockers":["No SSO"],"product_improvements":["Add SSO"],"sales_recommendations":["Confirm requirements"],"next_steps":[]}}'
                    }
                }]
            }

    class FakeClient:
        def __init__(self, timeout):
            captured["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers, json):
            captured["url"] = url
            captured["headers"] = headers
            captured["request"] = json
            return FakeResponse()

    monkeypatch.setattr(transcript_analysis, "get_settings", lambda: SimpleNamespace(
        llm_api_key="test-key",
        llm_base_url="https://llm.example/v1",
        llm_model="test-model",
        llm_timeout_seconds=8,
    ))
    monkeypatch.setattr(transcript_analysis.httpx, "AsyncClient", FakeClient)

    output = await transcript_analysis.analyze_call_transcript(
        "Customer: We like the CRM but need SSO before buying."
    )

    assert set(output.keys()) == {"summary", "improvements"}
    assert output["summary"]["call_summary"] == "Needs SSO."
    assert output["improvements"]["product_improvements"] == ["Add SSO"]
    assert "We like the CRM but need SSO" in captured["request"]["messages"][1]["content"]
    assert captured["url"] == "https://llm.example/v1/chat/completions"
    assert "database" not in captured


def test_parse_transcript_analysis_rejects_non_json_response():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        transcript_analysis.parse_transcript_analysis("No valid JSON returned")
    assert exc.value.status_code == 502
