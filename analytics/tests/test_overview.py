
from datetime import date

import pytest
from app.analytics import period_bounds


@pytest.mark.parametrize(("period", "expected"), [
    ("week", date(2026, 10, 19)),
    ("month", date(2026, 10, 1)),
    ("quarter", date(2026, 10, 1)),
    ("year", date(2026, 1, 1)),
    ("last_7_days", date(2026, 10, 16)),
    ("last_30_days", date(2026, 9, 23)),
    ("ytd", date(2026, 1, 1)),
])
def test_period_bounds(period, expected):
    start, end = period_bounds(period, date(2026, 10, 22))
    assert start == expected
    assert end == date(2026, 10, 23)


def test_invalid_period():
    with pytest.raises(ValueError):
        period_bounds("all_time", date(2026, 10, 22))
