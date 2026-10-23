
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.analytics import revenue_trend


@pytest.mark.asyncio
async def test_revenue_trend_fills_missing_months_with_zero():
    conn = MagicMock()
    result = MagicMock()

    # Simulate database results for only two months.
    result.mappings.return_value = [
        {
            "month": date(2026, 9, 1),
            "revenue": 50000,
            "deals_won": 3,
        },
        {
            "month": date(2026, 10, 1),
            "revenue": 25000,
            "deals_won": 2,
        },
    ]

    conn.execute = AsyncMock(return_value=result)

    with patch(
        "app.analytics.get_columns",
        new_callable=AsyncMock,
        return_value={
            "organization_id",
            "amount",
            "status",
            "close_date",
        },
    ), patch("app.analytics.get_settings") as mock_settings, patch(
        "app.analytics.datetime"
    ) as mock_datetime:
        mock_settings.return_value.won_values = ["won", "closed_won"]

        mock_datetime.now.return_value.date.return_value = date(2026, 10, 22)

        response = await revenue_trend(conn, "test-org", 3)

    assert response["months"] == 3
    assert len(response["data"]) == 3
    assert response["data"][0]["month"] == "2026-08-01"
    assert response["data"][0]["revenue"] == 0.0
    assert response["data"][0]["deals_won"] == 0
    assert response["data"][1]["revenue"] == 50000.0
    assert response["data"][2]["revenue"] == 25000.0
