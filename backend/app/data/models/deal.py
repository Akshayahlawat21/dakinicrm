import uuid
from datetime import date
from sqlalchemy import String, Numeric, Integer, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin


class Opportunity(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Opportunity entity. Maps to `opportunities` table."""
    __tablename__ = "opportunities"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="discovery", nullable=False, index=True)
    probability: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Deal(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Deal entity in sales pipeline. Maps to `deals` table."""
    __tablename__ = "deals"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    stage: Mapped[str] = mapped_column(String(50), default="Qualified", nullable=False, index=True)  # Qualified, Proposal, Negotiation, Won, Lost
    close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False, index=True)  # open, won, lost

    # Relationships
    account: Mapped["Account"] = relationship("Account", back_populates="deals")
    deal_products: Mapped[list["DealProduct"]] = relationship("DealProduct", back_populates="deal", cascade="all, delete-orphan")


class Product(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Catalog product. Maps to `products` table."""
    __tablename__ = "products"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sku: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class DealProduct(Base, UUIDMixin, TimestampMixin):
    """Line items for a deal. Maps to `deal_products` table."""
    __tablename__ = "deal_products"

    deal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)

    deal: Mapped["Deal"] = relationship("Deal", back_populates="deal_products")
    product: Mapped["Product"] = relationship("Product")
