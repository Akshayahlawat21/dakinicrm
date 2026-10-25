import uuid
from datetime import date
from sqlalchemy import String, Numeric, Date, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin


class SalesTarget(Base, UUIDMixin, TimestampMixin):
    """
    Sales quota / target entity. Maps to `sales_targets` table.
    Enforces target_amount > 0 and period_end >= period_start.
    """
    __tablename__ = "sales_targets"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="chk_sales_targets_amount_positive"),
        CheckConstraint("period_end >= period_start", name="chk_sales_targets_period_valid"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)

    period_type: Mapped[str] = mapped_column(String(20), default="monthly", nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    assigned_to: Mapped["User"] = relationship("User", foreign_keys=[assigned_to_user_id])
    assigned_by: Mapped["User"] = relationship("User", foreign_keys=[assigned_by_user_id])
