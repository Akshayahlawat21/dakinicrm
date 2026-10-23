
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.analytics import lead_sources


@pytest.mark.asyncio
async def test_lead_sources_groups_results():
    conn = MagicMock()
    result = MagicMock()

    result.mappings.return_value = [
        {"source": "Website", "lead_count": 12},
        {"source": "Referral", "lead_count": 5},
        {"source": "Unknown", "lead_count": 2},
    ]

    conn.execute = AsyncMock(return_value=result)

    with patch(
        "app.analytics.get_columns",
        new_callable=AsyncMock,
        return_value={"organization_id", "source", "created_at"},
    ):
        response = await lead_sources(
            conn,
            "test-org",
            "last_30_days",
        )

    assert response["period"] == "last_30_days"
    assert response["data"] == [
        {"source": "Website", "lead_count": 12},
        {"source": "Referral", "lead_count": 5},
        {"source": "Unknown", "lead_count": 2},
    ]

    conn.execute.assert_awaited_once()
