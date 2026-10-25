
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import get_settings


async def resolve_organization_id(
    conn: AsyncConnection,
    tenant_id: str | None,
) -> str:
    settings = get_settings()

    # Apply an explicitly configured tenant slug mapping, if available.
    if tenant_id:
        tenant_id = settings.tenant_slug_map.get(tenant_id, tenant_id)

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

    return org_id
