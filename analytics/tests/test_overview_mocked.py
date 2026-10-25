
from unittest.mock import AsyncMock, patch

import pytest

from app.analytics import overview


@pytest.mark.asyncio
async def test_overview_rejects_missing_required_columns():
    conn = AsyncMock()

    async def fake_get_columns(conn, table):
        if table == "leads":
            return {"id", "organization_id"}  # created_at is missing
        if table == "opportunities":
            return {"organization_id", "stage", "amount"}
        if table == "deals":
            return {"organization_id", "amount"}
        return set()

    with patch(
        "app.analytics.get_columns",
        side_effect=fake_get_columns,
    ):
        with pytest.raises(
            RuntimeError,
            match="Schema mismatch in leads",
        ):
            await overview(conn, "test-org", "month")
