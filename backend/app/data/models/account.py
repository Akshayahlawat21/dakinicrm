import uuid
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin


class Account(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Client account entity. Maps to `accounts` table."""
    __tablename__ = "accounts"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    industry: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Relationships
    contacts: Mapped[list["Contact"]] = relationship("Contact", back_populates="account", cascade="all, delete-orphan")
    deals: Mapped[list["Deal"]] = relationship("Deal", back_populates="account", cascade="all, delete-orphan")
