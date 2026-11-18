import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, UniqueConstraint, Index, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin


class DakiniBatch(Base, UUIDMixin, TimestampMixin):
    """Tracks a Dakini outbound batch created from selected CRM leads."""
    __tablename__ = "dakini_call_batches"
    __table_args__ = (
        UniqueConstraint("organization_id", "dakini_batch_id", name="uq_dakini_batch_org_external"),
        Index("ix_dakini_batch_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dakini_batch_id: Mapped[str] = mapped_column(String(120), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(120), nullable=False)
    telephony_number: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False, index=True)
    total_contacts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_response: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DakiniCall(Base, UUIDMixin, TimestampMixin):
    """External Dakini call tracking, linked to a CRM lead and optional batch."""
    __tablename__ = "dakini_calls"
    __table_args__ = (
        UniqueConstraint("organization_id", "dakini_call_id", name="uq_dakini_call_org_external"),
        Index("ix_dakini_call_org_batch", "organization_id", "dakini_batch_id"),
        Index("ix_dakini_call_org_lead", "organization_id", "lead_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dakini_call_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    dakini_batch_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    agent_id: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="initiated", nullable=False, index=True)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    transcript_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("call_transcripts.id", ondelete="SET NULL"), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recording_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_polled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    analysis_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    analysis_last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)

    lead = relationship("Lead")
    activity = relationship("Activity")
    transcript = relationship("CallTranscript")
