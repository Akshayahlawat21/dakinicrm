from app.main import app


def test_layer5_exposes_only_transcript_analysis_api():
    paths = {
        (route.path, tuple(sorted(route.methods or [])))
        for route in app.routes
        if hasattr(route, "methods")
    }
    assert ("/health", ("GET",)) in paths
    assert ("/v1/ai/transcript-analysis", ("POST",)) in paths
    assert not any(path == "/v1/ai/chat" for path, _methods in paths)
    assert not any("lead-score" in path for path, _methods in paths)


def test_transcript_analysis_is_the_only_business_api_route():
    business_paths = {
        route.path
        for route in app.routes
        if hasattr(route, "methods") and route.path.startswith("/v1/")
    }
    assert business_paths == {"/v1/ai/transcript-analysis"}
