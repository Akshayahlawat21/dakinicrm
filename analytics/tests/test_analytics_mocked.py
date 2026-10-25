
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
