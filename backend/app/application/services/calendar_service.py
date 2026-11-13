import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, ForbiddenError, NotFoundError
from backend.app.data.models.activity import Activity
from backend.app.data.models.user import User
from backend.app.data.models.account import Account
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class CalendarService:
    """
    Tenant-scoped Calendar & Event Service.
    Operates on `activities` table with role-based scoping and multi-tenant isolation.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.team_repo = TeamRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def list_events(
        self,
        ctx: RequestContext,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lists calendar events scoped by tenant and user role.
        Owners see all events in org.
        Managers see their own events and team members' events.
        Salespersons see only their own events.
        """
        tenant_uuid = ctx.tenant_uuid
        user_uuid = ctx.user_uuid

        base_filter = [
            Activity.organization_id == tenant_uuid,
            Activity.type.in_(["meeting", "call", "follow-up", "demo", "task", "review"]),
        ]

        # Role-based visibility
        if not (ctx.is_owner or ctx.is_admin):
            if ctx.is_manager and ctx.team_id:
                # Find all user IDs in this manager's team
                team_detail = await self.team_repo.get_team_detail(ctx.team_id, ctx.tenant_id)
                team_user_ids = [m.user_id for m in team_detail.members if m.user_id] if team_detail else []
                if user_uuid not in team_user_ids:
                    team_user_ids.append(user_uuid)
                base_filter.append(or_(Activity.user_id.in_(team_user_ids), Activity.user_id.is_(None)))
            else:
                # Salesperson: strictly own events or unassigned
                base_filter.append(or_(Activity.user_id == user_uuid, Activity.user_id.is_(None)))

        if start_date:
            base_filter.append(Activity.start_at >= start_date)
        if end_date:
            base_filter.append(Activity.start_at <= end_date)
        if status_filter and status_filter.lower() != "all":
            if status_filter.lower() == "completed":
                base_filter.append(Activity.status == "completed")
            elif status_filter.lower() == "upcoming":
                base_filter.append(and_(Activity.status != "completed", Activity.start_at >= datetime.now(timezone.utc)))

        stmt = (
            select(Activity)
            .where(*base_filter)
            .order_by(Activity.start_at.asc().nulls_last(), Activity.created_at.desc())
        )
        res = await self.session.execute(stmt)
        activities = res.scalars().all()

        # If database has zero calendar events for this organization, auto-seed realistic starter events
        if len(activities) == 0:
            activities = await self._seed_default_org_events(ctx)

        # Format events into DTOs
        event_dtos = []
        for act in activities:
            start_dt = act.start_at or act.created_at or datetime.now(timezone.utc)
            end_dt = act.end_at or (start_dt + timedelta(minutes=45))

            # Format 12-hour time string
            start_hour = start_dt.hour
            start_min = start_dt.minute
            end_hour = end_dt.hour
            end_min = end_dt.minute

            s_meridiem = "PM" if start_hour >= 12 else "AM"
            s_12 = start_hour % 12 or 12
            e_meridiem = "PM" if end_hour >= 12 else "AM"
            e_12 = end_hour % 12 or 12
            time_str = f"{s_12}:{start_min:02d} {s_meridiem} - {e_12}:{end_min:02d} {e_meridiem}"

            # Extract company name from location, description, or subject
            company = "Enterprise Client"
            desc_text = act.description or ""
            if "Company: " in desc_text:
                company = desc_text.split("Company: ", 1)[1].split("\n")[0].strip()

            event_dtos.append({
                "id": str(act.id),
                "organization_id": str(act.organization_id),
                "user_id": str(act.user_id) if act.user_id else None,
                "title": act.subject,
                "company": company,
                "time": time_str,
                "hour": start_hour,
                "dayNumber": start_dt.day,
                "monthIndex": start_dt.month - 1,
                "year": start_dt.year,
                "type": act.type,
                "attendees": [act.assigned_user.name] if act.assigned_user else ["Account Executive"],
                "desc": desc_text,
                "videoUrl": act.location,
                "completed": act.status == "completed",
                "status": act.status,
                "priority": act.priority,
                "start_at": start_dt.isoformat(),
                "end_at": end_dt.isoformat(),
                "created_at": act.created_at.isoformat() if act.created_at else None,
            })

        return event_dtos

    async def create_event(
        self,
        ctx: RequestContext,
        title: str,
        company: Optional[str] = None,
        type: str = "meeting",
        start_at: Optional[datetime] = None,
        end_at: Optional[datetime] = None,
        day_number: Optional[int] = None,
        month_index: Optional[int] = None,
        year: Optional[int] = None,
        hour: Optional[int] = None,
        duration: Optional[str] = "30m",
        location: Optional[str] = None,
        description: Optional[str] = None,
        priority: str = "medium",
        attendees: Optional[List[str]] = None,
        sync_task: bool = False,
    ) -> Activity:
        """Creates a new calendar event row in `activities`."""
        clean_title = (title or "").strip()
        if not clean_title:
            raise BadRequestError("Event title is required")

        # Resolve datetime if dayNumber/hour provided
        now = datetime.now(timezone.utc)
        if not start_at:
            event_year = year or now.year
            event_month = (month_index + 1) if month_index is not None else now.month
            event_day = day_number or now.day
            event_hour = hour if hour is not None else 10
            try:
                start_at = datetime(event_year, event_month, event_day, event_hour, 0, 0, tzinfo=timezone.utc)
            except Exception:
                start_at = now

        duration_mins = 45
        if duration == "30m":
            duration_mins = 30
        elif duration == "1h":
            duration_mins = 60
        elif duration == "15m":
            duration_mins = 15

        if not end_at:
            end_at = start_at + timedelta(minutes=duration_mins)

        # Append company info into description for fast search
        comp_name = (company or "").strip() or "Enterprise Client"
        desc_body = description or ""
        full_desc = f"{desc_body}\nCompany: {comp_name}".strip()

        video_link = location
        if (type in ("meeting", "demo") and not video_link):
            video_link = f"https://meet.google.com/dak-{uuid.uuid4().hex[:8]}"

        activity = Activity(
            id=uuid.uuid4(),
            organization_id=ctx.tenant_uuid,
            user_id=ctx.user_uuid,
            type=type.lower().strip(),
            subject=clean_title,
            description=full_desc,
            start_at=start_at,
            end_at=end_at,
            duration_seconds=duration_mins * 60,
            location=video_link,
            status="scheduled",
            priority=priority.lower() if priority in ("low", "medium", "high", "urgent") else "medium",
            timezone="UTC",
        )
        self.session.add(activity)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="calendar_event",
            resource_id=activity.id,
            new_values={"title": clean_title, "type": type, "company": comp_name},
        )

        return activity

    async def update_status(
        self,
        ctx: RequestContext,
        event_id: str | uuid.UUID,
        status: str,
    ) -> Activity:
        """Toggles event status ('completed' or 'scheduled')."""
        rec_uuid = self._parse_uuid(event_id)
        stmt = select(Activity).where(
            Activity.id == rec_uuid,
            Activity.organization_id == ctx.tenant_uuid,
        )
        res = await self.session.execute(stmt)
        activity = res.scalar_one_or_none()
        if not activity:
            raise NotFoundError("Calendar event not found")

        old_status = activity.status
        activity.status = "completed" if status.lower() == "completed" else "scheduled"
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="UPDATE",
            resource_type="calendar_event",
            resource_id=activity.id,
            old_values={"status": old_status},
            new_values={"status": activity.status},
        )
        return activity

    async def delete_event(
        self,
        ctx: RequestContext,
        event_id: str | uuid.UUID,
    ) -> bool:
        """Deletes a calendar event."""
        rec_uuid = self._parse_uuid(event_id)
        stmt = select(Activity).where(
            Activity.id == rec_uuid,
            Activity.organization_id == ctx.tenant_uuid,
        )
        res = await self.session.execute(stmt)
        activity = res.scalar_one_or_none()
        if not activity:
            raise NotFoundError("Calendar event not found")

        old_data = {"subject": activity.subject, "type": activity.type}
        await self.session.delete(activity)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="calendar_event",
            resource_id=rec_uuid,
            old_values=old_data,
        )
        return True

    async def _seed_default_org_events(self, ctx: RequestContext) -> List[Activity]:
        """Seeds realistic starter calendar events if an organization has none."""
        now = datetime.now(timezone.utc)
        starter_events = [
            Activity(
                id=uuid.uuid4(),
                organization_id=ctx.tenant_uuid,
                user_id=ctx.user_uuid,
                type="meeting",
                subject="Discovery Demo with Tech Stakeholders",
                description="Present freight telematics co-pilot and real-time routing API demo.\nCompany: Aarav Patel Enterprises",
                start_at=now.replace(hour=10, minute=0, second=0),
                end_at=now.replace(hour=10, minute=45, second=0),
                duration_seconds=2700,
                location="https://meet.google.com/dak-discovery-demo",
                status="scheduled",
                priority="high",
            ),
            Activity(
                id=uuid.uuid4(),
                organization_id=ctx.tenant_uuid,
                user_id=ctx.user_uuid,
                type="meeting",
                subject="Architecture Review: Mobility Solutions",
                description="Confirm cloud residency and SAP ERP sync latency.\nCompany: TVS Mobility Solutions",
                start_at=now.replace(hour=14, minute=0, second=0),
                end_at=now.replace(hour=15, minute=0, second=0),
                duration_seconds=3600,
                location="https://meet.google.com/dak-arch-review",
                status="scheduled",
                priority="medium",
            ),
            Activity(
                id=uuid.uuid4(),
                organization_id=ctx.tenant_uuid,
                user_id=ctx.user_uuid,
                type="follow-up",
                subject="Review Security Docs & SOC2 Compliance",
                description="Legal compliance follow-up.\nCompany: HDFC Securities",
                start_at=now.replace(hour=16, minute=0, second=0),
                end_at=now.replace(hour=16, minute=30, second=0),
                duration_seconds=1800,
                location=None,
                status="scheduled",
                priority="high",
            ),
        ]
        for act in starter_events:
            self.session.add(act)
        await self.session.flush()
        return starter_events

    def _parse_uuid(self, val: str | uuid.UUID) -> uuid.UUID:
        if isinstance(val, uuid.UUID):
            return val
        try:
            return uuid.UUID(str(val))
        except (ValueError, TypeError):
            raise BadRequestError(f"Invalid UUID: '{val}'")
