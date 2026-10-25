import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin


class Activity(Base, UUIDMixin, TimestampMixin):
    """
    Engagement & Tracking entity (Tasks, Calls, Meetings, Emails).
    Maps to `activities` table.
    When type='task', represents a CRM task assigned to user_id.
    """
    __tablename__ = "activities"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    type: Mapped[str] = mapped_column(String(50), default="task", nullable=False, index=True)  # task, call, meeting, email
    subject: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # Due date / start time
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled", nullable=False, index=True)  # scheduled, completed, canceled
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)  # low, medium, high, urgent

    # Relationships
    assigned_user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    participants: Mapped[list["ActivityParticipant"]] = relationship("ActivityParticipant", back_populates="activity", cascade="all, delete-orphan")


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
