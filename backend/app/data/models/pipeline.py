import uuid
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin


class Pipeline(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Sales pipeline container. Maps to `pipelines` table."""
    __tablename__ = "pipelines"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    stages: Mapped[list["PipelineStage"]] = relationship(
        "PipelineStage",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        order_by="PipelineStage.order_index",
    )


class PipelineStage(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Dynamic Kanban stage column (shared 'org' or per-user 'personal'). Maps to `pipeline_stages`."""
    __tablename__ = "pipeline_stages"

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    scope: Mapped[str] = mapped_column(String(20), default="org", nullable=False)  # 'org' | 'personal'
    parent_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True
    )
    parent_base_stage: Mapped[str | None] = mapped_column(String(50), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="#3b82f6", nullable=False)
    win_probability: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    qualification_tags: Mapped[list] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        default=list,
        nullable=False,
    )
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    pipeline: Mapped["Pipeline"] = relationship("Pipeline", back_populates="stages")


class UserDealColumn(Base, UUIDMixin, TimestampMixin):
    """Per-user deal-to-custom-column override mapping. Maps to `user_deal_columns`."""
    __tablename__ = "user_deal_columns"
    __table_args__ = (UniqueConstraint("user_id", "deal_id", name="uq_user_deal_column"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_stages.id", ondelete="CASCADE"), nullable=False, index=True
    )

