import time
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import get_settings

_ORG_CACHE: dict[str, tuple[str, float]] = {}
_ORG_CACHE_TTL = 300.0  # 5 minutes


def clear_org_cache() -> None:
    _ORG_CACHE.clear()


async def resolve_organization_id(
    conn: AsyncConnection,
    tenant_id: str | None,
) -> str:
    settings = get_settings()

    # Apply an explicitly configured tenant slug mapping, if available.
    if tenant_id:
        tenant_id = settings.tenant_slug_map.get(tenant_id, tenant_id)

    if tenant_id and tenant_id in _ORG_CACHE:
        cached_id, timestamp = _ORG_CACHE[tenant_id]
        if time.time() - timestamp < _ORG_CACHE_TTL:
            return cached_id

    result = await conn.execute(
        text("""
            SELECT id::text
            FROM public.organizations
            WHERE (
                CAST(:tenant_id AS TEXT) IS NOT NULL
                AND slug = CAST(:tenant_id AS TEXT)
            )
            OR id::text = CAST(:tenant_id AS TEXT)
            OR slug = CAST(:tenant_id AS TEXT)
            LIMIT 1
        """),
        {"tenant_id": tenant_id},
    )

    org_id = result.scalar_one_or_none()

    if org_id is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found for tenant",
        )

    if tenant_id:
        _ORG_CACHE[tenant_id] = (org_id, time.time())

    return org_id
