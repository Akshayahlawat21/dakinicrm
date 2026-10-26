import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """
    Tenant user entity. Maps to `users` table.
    Enforces role_name hierarchy: 'owner', 'manager', 'salesperson'.
    """
    __tablename__ = "users"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="salesperson",
        index=True,
    )  # 'owner', 'manager', 'salesperson'
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    login_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relationships
    role: Mapped["Role"] = relationship("Role", foreign_keys=[role_id])
    manager: Mapped["User"] = relationship("User", remote_side="User.id", foreign_keys=[manager_id])

