import uuid
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.session import get_db_session
from backend.app.application.context import RequestContext
from backend.app.api.dependencies import get_request_context
from backend.app.api.schemas.common import StandardResponse
from backend.app.data.models.deal import Product

router = APIRouter(prefix="/v1/products", tags=["Products"])


class ProductItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = 0.0


class ProductCreateRequest(BaseModel):
    name: str
    sku: Optional[str] = None
    category: Optional[str] = "General"
    price: Optional[float] = 0.0


@router.get("", response_model=StandardResponse[List[ProductItemResponse]])
async def list_products(
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """Lists all active products for the tenant catalog."""
    stmt = (
        select(Product)
        .where(
            Product.organization_id == ctx.tenant_uuid,
            Product.is_active == True,
            Product.deleted_at.is_(None),
        )
        .order_by(Product.name.asc())
    )
    res = await session.execute(stmt)
    prods = res.scalars().all()
    dtos = [
        ProductItemResponse(
            id=str(p.id),
            name=p.name,
            sku=p.sku,
            category=p.category,
            price=float(p.price or 0.0),
        )
        for p in prods
    ]
    return StandardResponse(status="success", data=dtos, correlation_id=ctx.correlation_id)


@router.post("", response_model=StandardResponse[ProductItemResponse], status_code=201)
async def create_product(
    body: ProductCreateRequest,
    ctx: RequestContext = Depends(get_request_context),
    session: AsyncSession = Depends(get_db_session),
):
    """
    Find-or-create product in catalog.
    If a product with the same name already exists in the organization, returns it.
    Otherwise, creates and commits the new product.
    """
    clean_name = body.name.strip()
    stmt = (
        select(Product)
        .where(
            Product.organization_id == ctx.tenant_uuid,
            func.lower(func.trim(Product.name)) == clean_name.lower(),
            Product.deleted_at.is_(None),
        )
    )
    res = await session.execute(stmt)
    existing = res.scalars().first()
    if existing:
        return StandardResponse(
            status="success",
            data=ProductItemResponse(
                id=str(existing.id),
                name=existing.name,
                sku=existing.sku,
                category=existing.category,
                price=float(existing.price or 0.0),
            ),
            correlation_id=ctx.correlation_id,
        )

    sku_clean = re.sub(r'[^A-Z0-9]', '', clean_name.upper())[:6] or "PROD"
    sku = body.sku or f"SKU-{sku_clean}-{uuid.uuid4().hex[:4].upper()}"
    prod = Product(
        organization_id=ctx.tenant_uuid,
        name=clean_name,
        sku=sku,
        category=body.category or "General",
        price=body.price or 0.0,
        currency="USD",
        is_active=True,
    )
    session.add(prod)
    await session.commit()

    return StandardResponse(
        status="success",
        data=ProductItemResponse(
            id=str(prod.id),
            name=prod.name,
            sku=prod.sku,
            category=prod.category,
            price=float(prod.price or 0.0),
        ),
        correlation_id=ctx.correlation_id,
    )
