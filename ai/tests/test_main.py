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
