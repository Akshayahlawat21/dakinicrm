from gateway.routers.proxy import upstream_timeout_for_path
from gateway.config import settings


def test_agent_route_gets_longer_timeout_than_legacy_15_seconds(monkeypatch):
    monkeypatch.setattr(settings, "UPSTREAM_TIMEOUT_SECONDS", 15.0)
    monkeypatch.setattr(settings, "AI_AGENT_UPSTREAM_TIMEOUT_SECONDS", 120.0)
    assert upstream_timeout_for_path("agent") == 120.0


def test_import_history_route_gets_longer_timeout_than_legacy_15_seconds(monkeypatch):
    monkeypatch.setattr(settings, "UPSTREAM_TIMEOUT_SECONDS", 15.0)
    monkeypatch.setattr(settings, "LEAD_IMPORT_HISTORY_UPSTREAM_TIMEOUT_SECONDS", 60.0)
    assert upstream_timeout_for_path("leads/imports") == 60.0


def test_regular_routes_keep_configured_timeout(monkeypatch):
    monkeypatch.setattr(settings, "UPSTREAM_TIMEOUT_SECONDS", 15.0)
    assert upstream_timeout_for_path("leads") == 15.0
