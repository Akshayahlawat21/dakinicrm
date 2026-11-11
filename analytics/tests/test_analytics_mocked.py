
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.analytics import pipeline_by_stage


@pytest.mark.asyncio
async def test_pipeline_by_stage_with_mocked_data():
    conn = MagicMock()

    result = MagicMock()
    result.mappings.return_value = [
        {
            "stage": "Qualified",
            "opportunity_count": 3,
            "value": 15000,
        },
        {
            "stage": "Proposal",
            "opportunity_count": 2,
            "value": 20000,
        },
    ]

    conn.execute = AsyncMock(return_value=result)

    with patch("app.analytics.get_settings") as mock_settings, patch(
        "app.analytics.get_columns", new_callable=AsyncMock,
        return_value={"organization_id", "stage", "amount", "deleted_at"},
    ):
        mock_settings.return_value.won_values = ["won", "closed_won"]
        mock_settings.return_value.lost_values = ["lost", "closed_lost"]

        response = await pipeline_by_stage(conn, "test-org")

    assert response == {
        "data": [
            {
                "stage": "Qualified",
                "opportunity_count": 3,
                "value": 15000.0,
                "weighted_value": 0.0,
            },
            {
                "stage": "Proposal",
                "opportunity_count": 2,
                "value": 20000.0,
                "weighted_value": 0.0,
            },
        ]
    }

    conn.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_pipeline_by_stage_includes_closed_won_and_lost_stages():
    conn = MagicMock()
    result = MagicMock()
    result.mappings.return_value = [
        {"stage": "Qualified", "opportunity_count": 2, "value": 10000, "weighted_value": 5000},
        {"stage": "Negotiation", "opportunity_count": 1, "value": 20000, "weighted_value": 17000},
        {"stage": "Won", "opportunity_count": 3, "value": 45000, "weighted_value": 45000},
        {"stage": "Lost", "opportunity_count": 1, "value": 15000, "weighted_value": 0},
    ]
    conn.execute = AsyncMock(return_value=result)

    opportunity_columns = {"organization_id", "stage", "amount", "owner_id", "probability", "deleted_at"}
    deal_columns = {"organization_id", "stage", "status", "amount", "opportunity_id", "owner_id", "deleted_at"}
    with patch("app.analytics.get_columns", new_callable=AsyncMock, side_effect=[opportunity_columns, deal_columns]):
        response = await pipeline_by_stage(conn, "test-org")

    assert [row["stage"] for row in response["data"]] == ["Qualified", "Negotiation", "Won", "Lost"]
    assert next(row for row in response["data"] if row["stage"] == "Won")["opportunity_count"] == 3
    assert next(row for row in response["data"] if row["stage"] == "Lost")["opportunity_count"] == 1
    sql = str(conn.execute.call_args.args[0]).lower()
    assert "closed won" in sql and "closed lost" in sql
    assert "not in ('won'" not in sql
