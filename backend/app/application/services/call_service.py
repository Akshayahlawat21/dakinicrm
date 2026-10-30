import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import (
    BadRequestError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)
from backend.app.data.models.activity import Activity, CallTranscript, CallAnalysis
from backend.app.data.models.lead import Lead
from backend.app.data.repositories.call_repository import (
    CallTranscriptRepository,
    CallAnalysisRepository,
)
from backend.app.data.repositories.team_repository import TeamRepository


class CallService:
    """
    Application Service managing Call Activities, Audio Transcripts, and AI Analyses
    with strict multi-tenant isolation and Owner/Manager/Salesperson RBAC enforcement.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.transcript_repo = CallTranscriptRepository(session)
        self.analysis_repo = CallAnalysisRepository(session)
        self.team_repo = TeamRepository(session)

    async def _resolve_allowed_user_ids(self, ctx: RequestContext) -> Optional[List[uuid.UUID]]:
        """
        Determines the list of user UUIDs the caller is permitted to view.
        - Owner / Admin: None (Full organization scope)
        - Manager: [Manager UUID] + all active team member UUIDs
        - Salesperson: [Salesperson UUID only]
        """
        if ctx.is_owner:
            return None

        allowed = [ctx.user_uuid]

        if ctx.is_manager:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if mgr_team:
                team_detail = await self.team_repo.get_team_detail(mgr_team.id, ctx.tenant_id)
                if team_detail and team_detail.members:
                    for member in team_detail.members:
                        if member.is_active and member.user_id:
                            allowed.append(member.user_id)
            return list(set(allowed))

        # Salesperson only gets their own records
        return allowed

    async def create_call_record(
        self,
        ctx: RequestContext,
        raw_text: str,
        lead_id: Optional[str | uuid.UUID] = None,
        subject: Optional[str] = None,
        external_call_id: Optional[str] = None,
        diarization: Optional[list | dict] = None,
        recording_url: Optional[str] = None,
        duration_seconds: int = 0,
        start_at: Optional[datetime] = None,
        end_at: Optional[datetime] = None,
    ) -> Tuple[Activity, CallTranscript]:
        """
        Ingests a call event: creates an Activity of type='call' and a 1:1 CallTranscript.
        Enforces tenant isolation and prevents duplicate external_call_id ingestion.
        """
        if not raw_text or not raw_text.strip():
            raise BadRequestError("Transcript raw_text is required")

        org_uuid = ctx.tenant_uuid
        caller_uuid = ctx.user_uuid

        # 1. Idempotency check on external_call_id to prevent duplicate dialer ingestion
        if external_call_id and external_call_id.strip():
            existing = await self.transcript_repo.get_by_external_call_id(
                external_call_id.strip(), ctx.tenant_id
            )
            if existing:
                raise ConflictError(
                    f"A transcript with external_call_id '{external_call_id}' already exists."
                )

        # 2. Resolve Lead details if provided
        lead_uuid = None
        resolved_subject = subject or "Outbound Call"
        if lead_id:
            try:
                l_id = uuid.UUID(str(lead_id))
                lead = await self.session.get(Lead, l_id)
                if lead and lead.organization_id == org_uuid:
                    lead_uuid = lead.id
                    if not subject:
                        resolved_subject = f"Call with {lead.name}"
            except (ValueError, TypeError):
                lead_uuid = None

        # 3. Create parent call Activity
        activity = Activity(
            organization_id=org_uuid,
            lead_id=lead_uuid,
            user_id=caller_uuid,
            type="call",
            subject=resolved_subject,
            start_at=start_at or datetime.now(timezone.utc),
            end_at=end_at,
            duration_seconds=duration_seconds,
            status="completed",
        )
        self.session.add(activity)
        await self.session.flush()

        # 4. Create 1:1 CallTranscript
        transcript = CallTranscript(
            organization_id=org_uuid,
            activity_id=activity.id,
            external_call_id=external_call_id.strip() if external_call_id else None,
            raw_text=raw_text.strip(),
            diarization=diarization or [],
            recording_url=recording_url,
            duration_seconds=duration_seconds,
        )
        self.session.add(transcript)
        await self.session.flush()

        return activity, transcript

    async def record_call_analysis(
        self,
        ctx: RequestContext,
        activity_id: str | uuid.UUID,
        transcript_id: Optional[str | uuid.UUID] = None,
        sentiment: str = "neutral",
        call_outcome: Optional[str] = None,
        summary: Optional[dict] = None,
        improvements: Optional[dict | list] = None,
        status: str = "completed",
        error_message: Optional[str] = None,
        model_version: Optional[str] = "gemini-2.0-flash",
    ) -> CallAnalysis:
        """
        Stores AI analysis results for a call.
        Enforces tenant isolation and associates the caller as analyzed_by.
        """
        org_uuid = ctx.tenant_uuid
        act_uuid = uuid.UUID(str(activity_id))

        activity = await self.session.get(Activity, act_uuid)
        if not activity or activity.organization_id != org_uuid:
            raise NotFoundError(f"Activity {activity_id} not found")

        trans_uuid = None
        if transcript_id:
            trans_uuid = uuid.UUID(str(transcript_id))
        else:
            trans = await self.transcript_repo.get_by_activity_id(act_uuid, ctx.tenant_id)
            if trans:
                trans_uuid = trans.id

        analysis = CallAnalysis(
            organization_id=org_uuid,
            activity_id=activity.id,
            transcript_id=trans_uuid,
            lead_id=activity.lead_id,
            account_id=activity.account_id,
            contact_id=activity.contact_id,
            analyzed_by=ctx.user_uuid,
            sentiment=(sentiment or "neutral").lower().strip(),
            call_outcome=call_outcome.strip() if call_outcome else None,
            summary=summary or {},
            improvements=improvements or {},
            status=status or "completed",
            error_message=error_message,
            model_version=model_version,
            analyzed_at=datetime.now(timezone.utc),
        )
        self.session.add(analysis)
        await self.session.flush()
        return analysis

    async def list_analyses(
        self,
        ctx: RequestContext,
        product_id: Optional[str] = None,
        lead_id: Optional[str] = None,
        sentiment: Optional[str] = None,
        call_outcome: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[CallAnalysis], int]:
        """
        Lists call analyses scoped by tenant and RBAC role.
        Supports filtering by product (resolved through lead), lead_id, sentiment, and outcomes.
        """
        allowed_user_ids = await self._resolve_allowed_user_ids(ctx)

        return await self.analysis_repo.list_analyses_scoped(
            tenant_id=ctx.tenant_id,
            allowed_user_ids=allowed_user_ids,
            lead_id=lead_id,
            product_id=product_id,
            sentiment=sentiment,
            call_outcome=call_outcome,
            status=status,
            date_from=date_from,
            date_to=date_to,
            skip=skip,
            limit=limit,
        )

    async def get_analysis(self, ctx: RequestContext, analysis_id: str | uuid.UUID) -> CallAnalysis:
        """Retrieves a single analysis with RBAC permission check."""
        analysis = await self.analysis_repo.get_analysis_detail(analysis_id, ctx.tenant_id)
        if not analysis:
            raise NotFoundError(f"CallAnalysis {analysis_id} not found")

        if ctx.is_owner:
            return analysis

        allowed_user_ids = await self._resolve_allowed_user_ids(ctx)
        if allowed_user_ids is not None:
            analyst_allowed = analysis.analyzed_by in allowed_user_ids
            activity_owner_allowed = (
                analysis.activity and analysis.activity.user_id in allowed_user_ids
            )
            lead_assigned_allowed = (
                analysis.lead and analysis.lead.assigned_to in allowed_user_ids
            )
            if not analyst_allowed and not activity_owner_allowed and not lead_assigned_allowed:
                raise ForbiddenError("You do not have permission to view this call analysis.")

        return analysis

    async def get_metrics(
        self, ctx: RequestContext, product_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Returns aggregated sentiment, outcome, and total metrics for dashboard with RBAC scoping."""
        allowed_user_ids = await self._resolve_allowed_user_ids(ctx)
        return await self.analysis_repo.get_analysis_metrics(
            tenant_id=ctx.tenant_id,
            allowed_user_ids=allowed_user_ids,
            product_id=product_id,
        )
