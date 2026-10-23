
from datetime import date

import pytest

from app.analytics import (
    PERIODS,
    period_bounds,
    first_existing,
    deal_status_expression,
)


def test_month_period():
    start, end = period_bounds("month", date(2026, 10, 22))
    assert start == date(2026, 10, 1)
    assert end == date(2026, 10, 23)


def test_week_period():
    start, end = period_bounds("week", date(2026, 10, 22))
    assert start == date(2026, 10, 19)
    assert end == date(2026, 10, 23)


def test_last_7_days_period():
    start, end = period_bounds("last_7_days", date(2026, 10, 22))
    assert start == date(2026, 10, 16)
    assert end == date(2026, 10, 23)


def test_invalid_period():
    with pytest.raises(ValueError):
        period_bounds("invalid", date(2026, 10, 22))


def test_first_existing_column():
    assert first_existing(
        {"created_at", "close_date"},
        ("close_date", "closed_at", "created_at"),
    ) == "close_date"


def test_deal_status_uses_status_and_stage():
    expression = deal_status_expression({"status", "stage"})
    assert "t.status" in expression
    assert "t.stage" in expression


def test_deal_status_missing_columns():
    with pytest.raises(RuntimeError):
        deal_status_expression({"amount", "organization_id"})


def test_supported_periods():
    assert "month" in PERIODS
    assert "last_30_days" in PERIODS
