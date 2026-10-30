import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin


class Activity(Base, UUIDMixin, TimestampMixin):
    """
    Engagement & Tracking entity (Tasks, Calls, Meetings, Emails).
    Maps to `activities` table.
    When type='task', represents a CRM task assigned to user_id.
    When type='call', represents an inbound/outbound call.
    """
    __tablename__ = "activities"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    type: Mapped[str] = mapped_column(String(50), default="task", nullable=False, index=True)  # task, call, meeting, email
    subject: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # Due date / start time
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled", nullable=False, index=True)  # scheduled, completed, canceled
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)  # low, medium, high, urgent

    # Relationships
    assigned_user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    lead: Mapped["Lead"] = relationship("Lead", foreign_keys=[lead_id])
    participants: Mapped[list["ActivityParticipant"]] = relationship("ActivityParticipant", back_populates="activity", cascade="all, delete-orphan")
    transcript: Mapped["CallTranscript"] = relationship("CallTranscript", back_populates="activity", uselist=False, cascade="all, delete-orphan")
    analyses: Mapped[list["CallAnalysis"]] = relationship("CallAnalysis", back_populates="activity")


class ActivityParticipant(Base, UUIDMixin):
    """Participants in an activity. Maps to `activity_participants` table."""
    __tablename__ = "activity_participants"

    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True)
    response_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    activity: Mapped["Activity"] = relationship("Activity", back_populates="participants")


class Note(Base, UUIDMixin, TimestampMixin):
    """Polymorphic notes attached to CRM entities. Maps to `notes` table."""
    __tablename__ = "notes"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    related_to_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    related_to_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)


class CallTranscript(Base, UUIDMixin):
    """
    Call Transcripts table.
    1:1 relationship with a call Activity.
    Stores verbatim audio transcript, speaker diarization, and dialer metadata.
    """
    __tablename__ = "call_transcripts"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    external_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    diarization: Mapped[dict | list | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=list, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=0, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    activity: Mapped["Activity"] = relationship("Activity", back_populates="transcript")
    analyses: Mapped[list["CallAnalysis"]] = relationship("CallAnalysis", back_populates="transcript", cascade="all, delete-orphan")


class CallAnalysis(Base, UUIDMixin, TimestampMixin):
    """
    Call Analysis table.
    1:N relationship with CallTranscript to support analysis versions / re-runs.
    Directly references lead_id for product resolution and analytics.
    """
    __tablename__ = "call_analysis"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)
    transcript_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("call_transcripts.id", ondelete="CASCADE"), nullable=True, index=True)
    external_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True)
    analyzed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    sentiment: Mapped[str | None] = mapped_column(String(20), default="neutral", nullable=True, index=True)  # positive, neutral, negative
    call_outcome: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)  # demo_scheduled, qualified, etc.
    summary: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=True)
    improvements: Mapped[dict | list | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)  # pending, processing, completed, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    activity: Mapped["Activity"] = relationship("Activity", back_populates="analyses")
    transcript: Mapped["CallTranscript"] = relationship("CallTranscript", back_populates="analyses")
    lead: Mapped["Lead"] = relationship("Lead", foreign_keys=[lead_id])
    analyst: Mapped["User"] = relationship("User", foreign_keys=[analyzed_by])
