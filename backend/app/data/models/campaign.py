import uuid
from datetime import date, datetime, timezone
from sqlalchemy import String, Numeric, Date, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.data.models.base import Base, UUIDMixin, TimestampMixin, SoftDeleteMixin


class Campaign(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Marketing and outreach campaigns. Maps to `campaigns` table."""
    __tablename__ = "campaigns"

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # email, sms, whatsapp, webinar
    status: Mapped[str] = mapped_column(String(20), default="planning", nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)


class CampaignMember(Base, UUIDMixin, TimestampMixin):
    """Members added to a campaign. Maps to `campaign_members` table."""
    __tablename__ = "campaign_members"

    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="sent", nullable=False)


class CampaignResponse(Base, UUIDMixin):
    """Responses from campaign recipients. Maps to `campaign_responses` table."""
    __tablename__ = "campaign_responses"

    campaign_member_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaign_members.id", ondelete="CASCADE"), nullable=False, index=True)
    response_type: Mapped[str] = mapped_column(String(50), nullable=False)
    response_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
