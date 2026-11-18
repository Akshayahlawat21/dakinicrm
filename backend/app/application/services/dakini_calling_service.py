import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.application.context import RequestContext
from backend.app.data.models.dakini_calling import DakiniBatch, DakiniCall
from backend.app.data.models.lead import Lead
from backend.app.data.models.activity import Activity, CallTranscript, CallAnalysis
from backend.app.data.repositories.team_repository import TeamRepository

logger = logging.getLogger("backend.dakini_calling")

ACTIVE_CALL_STATUSES = {
    "initiated", "queued", "pending", "scheduled", "ringing", "dialing",
    "connecting", "in_progress", "in-progress", "in progress", "live",
}


def _unwrap(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _phone(raw: str | None) -> str:
    if not raw:
        raise HTTPException(status_code=400, detail="Lead does not have a phone number")
    cleaned = "".join(ch for ch in raw.strip() if ch.isdigit() or ch == "+")
    if not cleaned.startswith("+"):
        if len(cleaned) == 10:
            cleaned = "+91" + cleaned
        elif len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = "+" + cleaned
        else:
            cleaned = "+" + cleaned
    if len(cleaned) < 8 or len(cleaned) > 16:
        raise HTTPException(status_code=400, detail=f"Invalid lead phone number: {raw}")
    return cleaned


class DakiniCallingService:
    def __init__(self, session: AsyncSession, ctx: RequestContext, client: httpx.AsyncClient | None = None):
        self.session = session
        self.ctx = ctx
        self.client = client

    def _credentials(self) -> tuple[str, str, str]:
        api_key = settings.DAKINI_API_KEY.strip()
        agent_id = settings.DAKINI_AGENT_ID.strip()
        phone = settings.DAKINI_TELEPHONY_NUMBER.strip()
        if not api_key or not agent_id or not phone:
            raise HTTPException(
                status_code=503,
                detail="Dakini Calling is not configured. Set DAKINI_API_KEY, DAKINI_AGENT_ID and DAKINI_TELEPHONY_NUMBER on the backend.",
            )
        return api_key, agent_id, _phone(phone)

    async def _request(self, method: str, path: str, **kwargs) -> dict[str, Any]:
        api_key = settings.DAKINI_API_KEY.strip()
        if not api_key:
            raise HTTPException(status_code=503, detail="DAKINI_API_KEY is not configured on the backend")
        url = settings.DAKINI_API_BASE_URL.rstrip("/") + path
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {api_key}"
        headers.setdefault("Accept", "application/json")
        try:
            if self.client:
                response = await self.client.request(method, url, headers=headers, timeout=settings.DAKINI_API_TIMEOUT_SECONDS, **kwargs)
            else:
                async with httpx.AsyncClient(timeout=settings.DAKINI_API_TIMEOUT_SECONDS) as client:
                    response = await client.request(method, url, headers=headers, **kwargs)
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict):
                raise HTTPException(status_code=502, detail="Dakini API returned an unexpected response")
            return body
        except httpx.HTTPStatusError as exc:
            logger.warning("Dakini API error %s for %s: %s", exc.response.status_code, path, exc.response.text[:1000])
            raise HTTPException(status_code=502, detail=f"Dakini API request failed ({exc.response.status_code})") from exc
        except httpx.HTTPError as exc:
            logger.exception("Dakini API connection failed")
            raise HTTPException(status_code=502, detail="Could not connect to Dakini Calling API") from exc
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Dakini API returned invalid JSON") from exc

    async def _get_lead(self, lead_id: str) -> Lead:
        try:
            lead_uuid = uuid.UUID(lead_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid lead_id") from exc
        result = await self.session.execute(
            select(Lead).where(Lead.id == lead_uuid, Lead.organization_id == self.ctx.tenant_uuid, Lead.deleted_at.is_(None))
        )
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        if not await self._can_access_lead(lead):
            raise HTTPException(status_code=403, detail="You do not have permission to call this lead")
        return lead

    async def _can_access_lead(self, lead: Lead) -> bool:
        if self.ctx.is_owner:
            return True
        allowed_user_ids = {self.ctx.user_uuid}
        if self.ctx.is_manager:
            team_repo = TeamRepository(self.session)
            manager_team = await team_repo.get_active_manager_team(self.ctx.user_id, self.ctx.tenant_id)
            if manager_team:
                detail = await team_repo.get_team_detail(manager_team.id, self.ctx.tenant_id)
                if detail and detail.members:
                    allowed_user_ids.update(
                        member.user_id for member in detail.members
                        if member.is_active and member.user_id
                    )
        return lead.assigned_to in allowed_user_ids

    async def _find_active_lead_call(self, lead_id: uuid.UUID) -> DakiniCall | None:
        result = await self.session.execute(
            select(DakiniCall)
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.lead_id == lead_id,
                func.lower(DakiniCall.status).in_(ACTIVE_CALL_STATUSES),
            )
            .order_by(DakiniCall.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def initiate_single_call(self, lead_id: str) -> dict[str, Any]:
        _, agent_id, from_number = self._credentials()
        lead = await self._get_lead(lead_id)
        active_call = await self._find_active_lead_call(lead.id)
        if active_call:
            raise HTTPException(
                status_code=409,
                detail="This lead already has a Dakini call that is pending or in progress. Wait for it to finish before starting another call.",
            )
        to_number = _phone(lead.phone)
        body = await self._request(
            "POST", "/call",
            json={
                "agent_id": agent_id,
                "recipient_phone_number": to_number,
                "from_telephony_number": from_number,
            },
        )
        data = _unwrap(body)
        call_id = data.get("call_id") or data.get("id")
        if not call_id:
            raise HTTPException(status_code=502, detail="Dakini did not return a call_id")
        call = DakiniCall(
            organization_id=self.ctx.tenant_uuid,
            lead_id=lead.id,
            created_by=self.ctx.user_uuid,
            dakini_call_id=str(call_id),
            agent_id=str(data.get("agent_id") or agent_id),
            phone_number=to_number,
            status=str(data.get("status") or "initiated").strip().lower(),
            raw_response=body,
        )
        self.session.add(call)
        await self.session.commit()
        return {"call_id": str(call_id), "lead_id": str(lead.id), "phone_number": to_number, "status": call.status}

    async def create_batch(self, lead_ids: list[str]) -> dict[str, Any]:
        _, agent_id, telephony_number = self._credentials()
        if not lead_ids:
            raise HTTPException(status_code=400, detail="Select at least one lead")
        try:
            ids = [uuid.UUID(item) for item in lead_ids]
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="One or more lead IDs are invalid") from exc
        if len(set(ids)) != len(ids):
            raise HTTPException(status_code=400, detail="Duplicate lead IDs are not allowed")
        result = await self.session.execute(
            select(Lead).where(Lead.id.in_(ids), Lead.organization_id == self.ctx.tenant_uuid, Lead.deleted_at.is_(None))
        )
        leads = list(result.scalars().all())
        if len(leads) != len(ids):
            raise HTTPException(status_code=404, detail="One or more selected leads were not found")
        for lead in leads:
            if not await self._can_access_lead(lead):
                raise HTTPException(status_code=403, detail="You do not have permission to call one or more selected leads")

        active_result = await self.session.execute(
            select(DakiniCall.lead_id).where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.lead_id.in_(ids),
                func.lower(DakiniCall.status).in_(ACTIVE_CALL_STATUSES),
            ).distinct()
        )
        active_lead_ids = {row[0] for row in active_result.all()}
        if active_lead_ids:
            active_names = [lead.name for lead in leads if lead.id in active_lead_ids]
            raise HTTPException(
                status_code=409,
                detail="A Dakini call is already pending or in progress for: " + ", ".join(active_names[:10]),
            )

        csv_buffer = io.StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=["contact_number", "first_name", "email", "company"])
        writer.writeheader()
        normalized = []
        for lead in leads:
            phone = _phone(lead.phone)
            writer.writerow({
                "contact_number": phone,
                "first_name": lead.name,
                "email": lead.email or "",
                "company": lead.company or "",
            })
            normalized.append((lead, phone))
        phone_keys = [self._normal_phone_key(phone) for _, phone in normalized]
        if len(set(phone_keys)) != len(phone_keys):
            raise HTTPException(status_code=400, detail="Selected leads contain duplicate phone numbers; batch calling cannot safely map results to individual leads")
        csv_bytes = csv_buffer.getvalue().encode("utf-8")
        body = await self._request(
            "POST", "/batches",
            data={"agent_id": agent_id, "telephony_number": telephony_number},
            files={"batch_file": ("dakini_crm_leads.csv", csv_bytes, "text/csv")},
        )
        data = _unwrap(body)
        batch_id = data.get("batch_id")
        if not batch_id:
            raise HTTPException(status_code=502, detail="Dakini did not return a batch_id")
        batch = DakiniBatch(
            organization_id=self.ctx.tenant_uuid,
            created_by=self.ctx.user_uuid,
            dakini_batch_id=str(batch_id),
            agent_id=str(data.get("agent_id") or agent_id),
            telephony_number=str(data.get("telephony_number") or telephony_number),
            status=str(data.get("status") or "pending").strip().lower(),
            total_contacts=int(data.get("total_contacts") or len(leads)),
            file_name=data.get("file_name") or "dakini_crm_leads.csv",
            raw_response=body,
        )
        self.session.add(batch)
        await self.session.flush()
        for lead, phone in normalized:
            self.session.add(DakiniCall(
                organization_id=self.ctx.tenant_uuid,
                lead_id=lead.id,
                created_by=self.ctx.user_uuid,
                dakini_batch_id=str(batch_id),
                agent_id=str(data.get("agent_id") or agent_id),
                phone_number=phone,
                status="pending",
            ))
        await self.session.commit()
        return {"batch_id": str(batch_id), "status": batch.status, "total_contacts": batch.total_contacts, "lead_count": len(leads)}

    @staticmethod
    def _batch_summary(
        batch: DakiniBatch,
        status_counts: dict[str, int],
        *,
        lead_records_created: int,
        triggered_count: int,
        transcript_count: int,
        analyzed_count: int,
        triggered_contacts_count: int | None = None,
        processed_contacts_count: int | None = None,
    ) -> dict[str, Any]:
        # Dakini's dashboard documentation uses connected/disconnected/pending as
        # call outcomes. Keep those outcomes separate from actively dialing states.
        # Dakini's call-log docs use `connected` / `disconnected` as call states.
        # A disconnected call is a completed conversation, not an API failure.
        completed_statuses = {"completed", "complete", "finished", "success", "successful", "succeeded", "connected", "disconnected"}
        ongoing_statuses = {"initiated", "pending", "queued", "scheduled", "dialing", "ringing", "active", "in_progress", "in-progress", "in progress", "processing", "answered", "connecting"}
        failed_statuses = {"failed", "failure", "error", "no_answer", "busy", "rejected", "unreachable"}
        stopped_statuses = {"stopped", "cancelled", "canceled", "aborted"}

        completed = sum(count for status, count in status_counts.items() if status in completed_statuses)
        # Batch-created placeholder rows are marked pending before Dakini has
        # assigned a call ID. They are submitted contacts, not active calls.
        pending_status_rows = sum(
            count for status, count in status_counts.items()
            if status in {"pending", "queued", "scheduled", "created"}
        )
        untriggered_records = max(0, lead_records_created - triggered_count)
        placeholder_pending = min(pending_status_rows, untriggered_records)
        ongoing = max(
            0,
            sum(count for status, count in status_counts.items() if status in ongoing_statuses)
            - placeholder_pending,
        )
        failed = sum(count for status, count in status_counts.items() if status in failed_statuses)
        stopped = sum(count for status, count in status_counts.items() if status in stopped_statuses)
        pending = max(0, pending_status_rows - placeholder_pending)
        total_contacts = int(batch.total_contacts or lead_records_created)
        processed = completed + failed + stopped
        triggered_contacts = triggered_contacts_count if triggered_contacts_count is not None else triggered_count
        processed_contacts = processed_contacts_count if processed_contacts_count is not None else processed

        return {
            "batch_id": batch.dakini_batch_id,
            "status": str(batch.status or "pending").lower(),
            "total_contacts": total_contacts,
            "lead_records_created": lead_records_created,
            # A call is counted as triggered only after Dakini returns an individual call ID.
            "calls_tracked": triggered_count,
            "triggered_count": triggered_count,
            "triggered_contacts_count": triggered_contacts,
            "completed_count": completed,
            "ongoing_count": ongoing,
            "failed_count": failed,
            "stopped_count": stopped,
            "pending_count": pending,
            # Retries can produce multiple call IDs for one contact. Count call
            # attempts as triggered, but count each lead only once as triggered.
            "not_triggered_count": max(0, total_contacts - triggered_contacts),
            "processed_count": processed,
            "processed_contacts_count": processed_contacts,
            "progress_percent": min(100.0, round((processed_contacts / total_contacts) * 100, 1)) if total_contacts else 0,
            "status_counts": status_counts,
            "transcripts_saved": transcript_count,
            "analyses_completed": analyzed_count,
            "analysis_pending": max(0, transcript_count - analyzed_count),
            "scheduled_at": batch.scheduled_at.isoformat() if batch.scheduled_at else None,
            "last_polled_at": batch.last_polled_at.isoformat() if batch.last_polled_at else None,
        }

    @classmethod
    def _batch_progress(cls, batch: DakiniBatch, calls: list[DakiniCall]) -> dict[str, Any]:
        status_counts: dict[str, int] = {}
        for call in calls:
            status = str(call.status or "unknown").strip().lower()
            status_counts[status] = status_counts.get(status, 0) + 1
        return cls._batch_summary(
            batch,
            status_counts,
            lead_records_created=len(calls),
            triggered_count=sum(1 for call in calls if call.dakini_call_id),
            transcript_count=sum(1 for call in calls if call.transcript_id),
            analyzed_count=sum(1 for call in calls if call.analyzed_at),
            triggered_contacts_count=len({call.lead_id for call in calls if call.dakini_call_id}),
            processed_contacts_count=len({
                call.lead_id for call in calls
                if str(call.status or "").strip().lower() in {
                    "completed", "complete", "finished", "success", "successful", "succeeded",
                    "connected", "failed", "failure", "error", "no_answer", "busy", "rejected",
                    "unreachable", "disconnected", "stopped", "cancelled", "canceled", "aborted",
                }
            }),
        )

    async def _assert_batch_access(self, batch: DakiniBatch) -> None:
        if not self.ctx.is_owner and batch.created_by != self.ctx.user_uuid:
            raise HTTPException(status_code=403, detail="You do not have permission to manage this batch")

    async def _batch_aggregate(self, batch: DakiniBatch) -> dict[str, Any]:
        filters = (
            DakiniCall.organization_id == self.ctx.tenant_uuid,
            DakiniCall.dakini_batch_id == batch.dakini_batch_id,
        )
        result = await self.session.execute(
            select(
                DakiniCall.status,
                func.count(DakiniCall.id),
                func.count(DakiniCall.dakini_call_id),
                func.count(DakiniCall.transcript_id),
                func.count(DakiniCall.analyzed_at),
            ).where(*filters).group_by(DakiniCall.status)
        )
        status_counts: dict[str, int] = {}
        record_count = triggered_count = transcript_count = analyzed_count = 0
        for status, count, triggered, transcripts, analyzed in result.all():
            key = str(status or "unknown").strip().lower()
            status_counts[key] = int(count or 0)
            record_count += int(count or 0)
            triggered_count += int(triggered or 0)
            transcript_count += int(transcripts or 0)
            analyzed_count += int(analyzed or 0)

        triggered_contacts_result = await self.session.execute(
            select(func.count(func.distinct(DakiniCall.lead_id))).where(
                *filters, DakiniCall.dakini_call_id.is_not(None)
            )
        )
        triggered_contacts_count = int(triggered_contacts_result.scalar() or 0)
        terminal_statuses = (
            "completed", "complete", "finished", "success", "successful", "succeeded",
            "connected", "failed", "failure", "error", "no_answer", "busy", "rejected",
            "unreachable", "disconnected", "stopped", "cancelled", "canceled", "aborted",
        )
        processed_contacts_result = await self.session.execute(
            select(func.count(func.distinct(DakiniCall.lead_id))).where(
                *filters, func.lower(DakiniCall.status).in_(terminal_statuses)
            )
        )
        processed_contacts_count = int(processed_contacts_result.scalar() or 0)
        return self._batch_summary(
            batch,
            status_counts,
            lead_records_created=record_count,
            triggered_count=triggered_count,
            transcript_count=transcript_count,
            analyzed_count=analyzed_count,
            triggered_contacts_count=triggered_contacts_count,
            processed_contacts_count=processed_contacts_count,
        )

    async def get_batch_state(self, batch_id: str) -> dict[str, Any]:
        batch = await self._get_batch_record(batch_id)
        await self._assert_batch_access(batch)
        return await self._batch_aggregate(batch)

    async def list_batches(self, limit: int = 100) -> list[dict[str, Any]]:
        query = select(DakiniBatch).where(DakiniBatch.organization_id == self.ctx.tenant_uuid)
        if not self.ctx.is_owner:
            query = query.where(DakiniBatch.created_by == self.ctx.user_uuid)
        query = query.order_by(DakiniBatch.created_at.desc(), DakiniBatch.id.desc()).limit(max(1, min(limit, 200)))
        result = await self.session.execute(query)
        batches = list(result.scalars().all())
        if not batches:
            return []

        batch_ids = [batch.dakini_batch_id for batch in batches]
        aggregates_result = await self.session.execute(
            select(
                DakiniCall.dakini_batch_id,
                DakiniCall.status,
                func.count(DakiniCall.id),
                func.count(DakiniCall.dakini_call_id),
                func.count(DakiniCall.transcript_id),
                func.count(DakiniCall.analyzed_at),
            )
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.dakini_batch_id.in_(batch_ids),
            )
            .group_by(DakiniCall.dakini_batch_id, DakiniCall.status)
        )
        aggregates: dict[str, dict[str, Any]] = {}
        for batch_id, status, count, triggered, transcripts, analyzed in aggregates_result.all():
            entry = aggregates.setdefault(str(batch_id), {
                "status_counts": {}, "records": 0, "triggered": 0,
                "transcripts": 0, "analyzed": 0,
            })
            entry["status_counts"][str(status or "unknown").strip().lower()] = int(count or 0)
            entry["records"] += int(count or 0)
            entry["triggered"] += int(triggered or 0)
            entry["transcripts"] += int(transcripts or 0)
            entry["analyzed"] += int(analyzed or 0)

        triggered_contacts_result = await self.session.execute(
            select(DakiniCall.dakini_batch_id, func.count(func.distinct(DakiniCall.lead_id)))
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.dakini_batch_id.in_(batch_ids),
                DakiniCall.dakini_call_id.is_not(None),
            )
            .group_by(DakiniCall.dakini_batch_id)
        )
        for batch_id, count in triggered_contacts_result.all():
            aggregates.setdefault(str(batch_id), {
                "status_counts": {}, "records": 0, "triggered": 0,
                "transcripts": 0, "analyzed": 0,
            })["triggered_contacts"] = int(count or 0)

        terminal_statuses = (
            "completed", "complete", "finished", "success", "successful", "succeeded",
            "connected", "failed", "failure", "error", "no_answer", "busy", "rejected",
            "unreachable", "disconnected", "stopped", "cancelled", "canceled", "aborted",
        )
        processed_contacts_result = await self.session.execute(
            select(DakiniCall.dakini_batch_id, func.count(func.distinct(DakiniCall.lead_id)))
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.dakini_batch_id.in_(batch_ids),
                func.lower(DakiniCall.status).in_(terminal_statuses),
            )
            .group_by(DakiniCall.dakini_batch_id)
        )
        for batch_id, count in processed_contacts_result.all():
            aggregates.setdefault(str(batch_id), {
                "status_counts": {}, "records": 0, "triggered": 0,
                "transcripts": 0, "analyzed": 0,
            })["processed_contacts"] = int(count or 0)

        output: list[dict[str, Any]] = []
        for batch in batches:
            aggregate = aggregates.get(batch.dakini_batch_id, {"status_counts": {}, "records": 0, "triggered": 0, "transcripts": 0, "analyzed": 0})
            summary = self._batch_summary(
                batch,
                aggregate["status_counts"],
                lead_records_created=aggregate["records"],
                triggered_count=aggregate["triggered"],
                transcript_count=aggregate["transcripts"],
                analyzed_count=aggregate["analyzed"],
                triggered_contacts_count=aggregate.get("triggered_contacts", 0),
                processed_contacts_count=aggregate.get("processed_contacts", 0),
            )
            summary.update({
                "created_at": batch.created_at.isoformat() if batch.created_at else None,
                "file_name": batch.file_name,
                "telephony_number": batch.telephony_number,
                "agent_id": batch.agent_id,
            })
            output.append(summary)
        return output

    async def get_batch_calls(self, batch_id: str, skip: int = 0, limit: int = 100) -> dict[str, Any]:
        batch = await self._get_batch_record(batch_id)
        await self._assert_batch_access(batch)
        safe_skip = max(0, skip)
        safe_limit = max(1, min(limit, 500))
        filters = (
            DakiniCall.organization_id == self.ctx.tenant_uuid,
            DakiniCall.dakini_batch_id == batch_id,
        )
        total_result = await self.session.execute(
            select(func.count(DakiniCall.id)).where(*filters)
        )
        total = int(total_result.scalar() or 0)
        result = await self.session.execute(
            select(DakiniCall, Lead)
            .join(Lead, Lead.id == DakiniCall.lead_id)
            .where(*filters)
            .where(Lead.organization_id == self.ctx.tenant_uuid, Lead.deleted_at.is_(None))
            .order_by(DakiniCall.created_at.asc(), DakiniCall.id.asc())
            .offset(safe_skip)
            .limit(safe_limit)
        )
        rows = result.all()
        attempt_numbers: dict[str, int] = {}
        items = []
        for call, lead in rows:
            lead_key = str(call.lead_id)
            attempt_numbers[lead_key] = attempt_numbers.get(lead_key, 0) + 1
            detail = await self._call_details(call)
            items.append({
                **detail,
                "lead_name": lead.name,
                "company": lead.company,
                "phone_number": call.phone_number,
                "email": lead.email,
                "interested_product": lead.interested_product,
                "attempt_number": attempt_numbers[lead_key],
            })
        return {"items": items, "total": total, "skip": safe_skip, "limit": safe_limit}

    async def poll_batch_status(self, batch_id: str) -> dict[str, Any]:
        """Refresh one batch from Dakini's documented Get Batch endpoint."""
        batch = await self._get_batch_record(batch_id)
        body = await self._request("GET", f"/batches/{batch_id}")
        data = _unwrap(body)
        remote_status = data.get("status")
        if remote_status:
            batch.status = str(remote_status).strip().lower()
        remote_total = data.get("total_contacts")
        if remote_total is not None:
            try:
                batch.total_contacts = max(0, int(remote_total))
            except (TypeError, ValueError):
                logger.warning("Dakini returned invalid total_contacts for batch %s", batch_id)
        batch.raw_response = body
        batch.last_polled_at = datetime.now(timezone.utc)
        # When the provider marks a batch terminal, untriggered placeholders must
        # not remain `pending` forever or block the lead's next explicitly requested call.
        if str(batch.status or "").lower() in {"completed", "complete", "finished", "failed", "stopped", "cancelled", "canceled"}:
            untriggered_result = await self.session.execute(
                select(DakiniCall).where(
                    DakiniCall.organization_id == self.ctx.tenant_uuid,
                    DakiniCall.dakini_batch_id == batch_id,
                    DakiniCall.dakini_call_id.is_(None),
                )
            )
            terminal_placeholder_status = "stopped" if str(batch.status).lower() in {"stopped", "cancelled", "canceled"} else "not_triggered"
            for placeholder in untriggered_result.scalars().all():
                placeholder.status = terminal_placeholder_status
                placeholder.synced_at = datetime.now(timezone.utc)
        await self.session.commit()
        return {"batch_id": batch_id, "status": batch.status, "total_contacts": batch.total_contacts}

    async def schedule_batch(self, batch_id: str, scheduled_at: datetime) -> dict[str, Any]:
        batch = await self._get_batch_record(batch_id)
        await self._assert_batch_access(batch)
        current_status = str(batch.status or "pending").strip().lower()
        if current_status not in {"created", "pending"}:
            raise HTTPException(status_code=409, detail="Only a created or pending batch can be scheduled")
        if getattr(batch, "scheduled_at", None) is not None:
            raise HTTPException(status_code=409, detail="This batch already has a scheduled start time")
        if scheduled_at.tzinfo is None:
            raise HTTPException(status_code=400, detail="scheduled_at must include a timezone")
        if scheduled_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
        utc_value = scheduled_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        body = await self._request("POST", f"/batches/{batch_id}/schedule", files={"scheduled_at": (None, utc_value)})
        data = _unwrap(body)
        batch = await self._get_batch_record(batch_id)
        batch.status = str(data.get("status") or "scheduled").strip().lower()
        batch.scheduled_at = scheduled_at.astimezone(timezone.utc)
        batch.raw_response = body
        await self.session.commit()
        return data

    async def stop_batch(self, batch_id: str) -> dict[str, Any]:
        batch = await self._get_batch_record(batch_id)
        await self._assert_batch_access(batch)
        if str(batch.status or "pending").lower() not in {"pending", "scheduled", "running"}:
            raise HTTPException(status_code=409, detail="Only pending, scheduled or running batches can be stopped")
        body = await self._request("POST", f"/batches/{batch_id}/stop")
        data = _unwrap(body)
        batch = await self._get_batch_record(batch_id)
        batch.status = str(data.get("status") or "stopped").strip().lower()
        batch.raw_response = body
        # Reflect the provider's stop action on local, not-yet-triggered placeholders.
        pending_result = await self.session.execute(
            select(DakiniCall).where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.dakini_batch_id == batch_id,
                DakiniCall.dakini_call_id.is_(None),
            )
        )
        for pending_call in pending_result.scalars().all():
            pending_call.status = "stopped"
            pending_call.synced_at = datetime.now(timezone.utc)
        await self.session.commit()
        return data

    async def _get_batch_record(self, batch_id: str) -> DakiniBatch:
        result = await self.session.execute(select(DakiniBatch).where(
            DakiniBatch.organization_id == self.ctx.tenant_uuid,
            DakiniBatch.dakini_batch_id == batch_id,
        ))
        batch = result.scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=404, detail="Dakini batch not found in this CRM organization")
        return batch

    async def get_call_state(self, call_id: str) -> dict[str, Any]:
        result = await self.session.execute(select(DakiniCall).where(
            DakiniCall.organization_id == self.ctx.tenant_uuid,
            DakiniCall.dakini_call_id == call_id,
        ))
        call = result.scalar_one_or_none()
        if not call:
            raise HTTPException(status_code=404, detail="Dakini call not found in this CRM organization")
        lead = await self.session.get(Lead, call.lead_id)
        if not lead or not await self._can_access_lead(lead):
            raise HTTPException(status_code=403, detail="You do not have permission to view this call")
        return await self._call_details(call)

    async def get_latest_lead_call(self, lead_id: str) -> dict[str, Any] | None:
        lead = await self._get_lead(lead_id)
        result = await self.session.execute(
            select(DakiniCall)
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.lead_id == lead.id,
                DakiniCall.dakini_call_id.is_not(None),
            )
            .order_by(DakiniCall.created_at.desc(), DakiniCall.id.desc())
            .limit(1)
        )
        call = result.scalar_one_or_none()
        if not call:
            fallback = await self.session.execute(
                select(DakiniCall)
                .where(DakiniCall.organization_id == self.ctx.tenant_uuid, DakiniCall.lead_id == lead.id)
                .order_by(DakiniCall.created_at.desc(), DakiniCall.id.desc())
                .limit(1)
            )
            call = fallback.scalar_one_or_none()
        if not call:
            return None
        detail = await self._call_details(call)
        # Include the current queue state separately, even when the latest visible
        # transcript belongs to the most recent call that actually received a call ID.
        active_result = await self.session.execute(
            select(DakiniCall)
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.lead_id == lead.id,
                func.lower(DakiniCall.status).in_(ACTIVE_CALL_STATUSES),
            )
            .order_by(DakiniCall.created_at.desc())
            .limit(1)
        )
        active_call = active_result.scalar_one_or_none()
        detail["current_queue_status"] = active_call.status if active_call else None
        detail["current_queue_batch_id"] = active_call.dakini_batch_id if active_call else None
        detail["current_queue_active"] = bool(active_call)
        return detail

    async def get_lead_call_statuses(self, lead_ids: list[str]) -> list[dict[str, Any]]:
        """Return persistent latest Dakini call status for a page of CRM leads."""
        try:
            ids = [uuid.UUID(value) for value in lead_ids]
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="One or more lead IDs are invalid") from exc
        if not ids:
            return []
        if len(set(ids)) != len(ids):
            ids = list(dict.fromkeys(ids))
        result = await self.session.execute(
            select(DakiniCall, Lead)
            .join(Lead, Lead.id == DakiniCall.lead_id)
            .where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                Lead.organization_id == self.ctx.tenant_uuid,
                Lead.deleted_at.is_(None),
                DakiniCall.lead_id.in_(ids),
            )
            .order_by(DakiniCall.created_at.desc(), DakiniCall.id.desc())
        )
        by_lead: dict[str, list[tuple[DakiniCall, Lead]]] = {}
        for call, lead in result.all():
            if not await self._can_access_lead(lead):
                continue
            by_lead.setdefault(str(lead.id), []).append((call, lead))

        statuses: list[dict[str, Any]] = []
        for lead_id, rows in by_lead.items():
            latest_call, lead = rows[0]
            latest_received = next(((call, owner) for call, owner in rows if call.dakini_call_id), None)
            received_call = latest_received[0] if latest_received else None
            # Any active placeholder or real call must keep this lead visibly queued/active,
            # even when a newer/older attempt has a terminal status.
            active_row = next(((call, owner) for call, owner in rows if str(call.status or "").strip().lower() in ACTIVE_CALL_STATUSES), None)
            active_call = active_row[0] if active_row else None
            status_source = active_call or received_call or latest_call
            status = str(status_source.status or "unknown").strip().lower()
            unique_call_ids = {str(call.dakini_call_id) for call, _ in rows if call.dakini_call_id}
            statuses.append({
                "lead_id": lead_id,
                "lead_name": lead.name,
                "has_ai_call": True,
                "has_received_call": received_call is not None,
                "call_attempt_count": len(unique_call_ids),
                "call_id": received_call.dakini_call_id if received_call else None,
                "latest_received_call_id": received_call.dakini_call_id if received_call else None,
                "latest_received_status": received_call.status if received_call else None,
                "batch_id": active_call.dakini_batch_id if active_call else latest_call.dakini_batch_id,
                "status": status,
                "is_active": active_call is not None,
                "is_queued_without_call_id": bool(active_call and not active_call.dakini_call_id),
                "transcript_saved": bool(received_call.transcript_id) if received_call else False,
                "analysis_saved": bool(received_call.analyzed_at) if received_call else False,
                "last_call_at": latest_call.created_at.isoformat() if latest_call.created_at else None,
                "last_received_at": received_call.created_at.isoformat() if received_call and received_call.created_at else None,
                "recording_url": received_call.recording_url if received_call else None,
            })
        return statuses

    async def poll_agent_call_logs(self, agent_id: str) -> dict[str, int]:
        """Fetch Dakini's agent logs and reconcile each external call ID exactly once.

        A batch contact may receive more than one call attempt when Dakini's own
        retry/callback workflow is enabled. Keep one CRM row per external call ID;
        never overwrite a prior attempt for the same lead/phone.
        """
        if not settings.DAKINI_CALL_LOG_SYNC_ENABLED:
            return {"call_logs_seen": 0, "calls_matched": 0, "attempts_created": 0}

        result = await self.session.execute(select(DakiniCall).where(
            DakiniCall.organization_id == self.ctx.tenant_uuid,
            DakiniCall.agent_id == agent_id,
        ))
        local_calls = list(result.scalars().all())
        if not local_calls:
            return {"call_logs_seen": 0, "calls_matched": 0, "attempts_created": 0}

        body = await self._request("GET", f"/call_logs/{agent_id}/list")
        # The provider may return either a direct list/map or an envelope. Unwrap
        # common response containers without assuming that `data` is always an object.
        entries: Any = body
        for _ in range(3):
            if isinstance(entries, list):
                break
            if not isinstance(entries, dict):
                break
            next_entries = None
            for field in ("call_logs", "calls", "logs", "items", "results", "data"):
                candidate = entries.get(field)
                if isinstance(candidate, (dict, list)):
                    next_entries = candidate
                    break
            if next_entries is None or next_entries is entries:
                break
            entries = next_entries
        if isinstance(entries, list):
            iterable = [
                (str(item.get("id") or item.get("call_id") or item.get("call_log_id") or ""), item)
                for item in entries if isinstance(item, dict)
            ]
        elif isinstance(entries, dict):
            iterable = [(str(key), value) for key, value in entries.items() if isinstance(value, dict)]
        else:
            iterable = []

        calls_by_id = {str(call.dakini_call_id): call for call in local_calls if call.dakini_call_id}
        calls_by_batch_phone: dict[tuple[str, str], list[DakiniCall]] = {}
        calls_by_phone: dict[str, list[DakiniCall]] = {}
        for call in local_calls:
            phone_key = self._normal_phone_key(call.phone_number)
            calls_by_phone.setdefault(phone_key, []).append(call)
            if call.dakini_batch_id:
                key = (str(call.dakini_batch_id), phone_key)
                calls_by_batch_phone.setdefault(key, []).append(call)

        matched = 0
        attempts_created = 0
        now = datetime.now(timezone.utc)
        for key, item in iterable:
            # Different provider responses place the call payload under `call`,
            # `details`, or `call_details`. Merge nested values first and top-level
            # fields last so explicit outer values take precedence.
            detail = {}
            for field in ("call", "details", "call_details", "result"):
                if isinstance(item.get(field), dict):
                    detail.update(item[field])
            detail.update(item)
            returned_call_id = str(detail.get("call_id") or detail.get("call_log_id") or detail.get("id") or key or "").strip()
            context = next((detail.get(field) for field in ("context_details", "context", "metadata") if isinstance(detail.get(field), dict)), {})
            batch_id = str(detail.get("batch_id") or context.get("batch_id") or context.get("dakini_batch_id") or "").strip()
            recipient_data = detail.get("recipient") if isinstance(detail.get("recipient"), dict) else {}
            to_data = detail.get("to") if isinstance(detail.get("to"), dict) else {}
            contact_data = detail.get("contact") if isinstance(detail.get("contact"), dict) else {}
            batch_data = detail.get("batch") if isinstance(detail.get("batch"), dict) else {}
            if not batch_id:
                batch_id = str(batch_data.get("batch_id") or batch_data.get("id") or "").strip()
            recipient = (
                context.get("recipient_phone_number")
                or context.get("phone_number")
                or detail.get("recipient_phone_number")
                or detail.get("receiver_phone_number")
                or detail.get("reciver_phone_number")
                or detail.get("phone_number")
                or detail.get("contact_number")
                or detail.get("to_number")
                or detail.get("to_phone_number")
                or detail.get("recipient_phone")
                or detail.get("receiver_phone")
                or recipient_data.get("phone_number")
                or recipient_data.get("phone")
                or to_data.get("phone_number")
                or to_data.get("phone")
                or contact_data.get("phone_number")
                or contact_data.get("phone")
            )

            local_call = calls_by_id.get(returned_call_id) if returned_call_id else None
            if local_call is None and recipient:
                phone_key = self._normal_phone_key(str(recipient))
                candidates = calls_by_batch_phone.get((batch_id, phone_key), []) if batch_id else []
                # Some list payloads omit batch_id. Only use phone-only matching when
                # that phone maps to one unique CRM lead across the agent's local rows.
                if not candidates and not batch_id:
                    phone_candidates = calls_by_phone.get(phone_key, [])
                    unique_leads = {candidate.lead_id for candidate in phone_candidates}
                    unique_batches = {candidate.dakini_batch_id for candidate in phone_candidates}
                    if len(unique_leads) == 1 and len(unique_batches) == 1:
                        candidates = phone_candidates
                # First bind a returned ID to an unused placeholder for the contact.
                local_call = next((call for call in candidates if not call.dakini_call_id), None)
                # If every placeholder already has an external ID, this is another
                # distinct attempt for the same recipient. Persist it separately.
                if local_call is None and candidates and returned_call_id:
                    source_call = candidates[0]
                    local_call = DakiniCall(
                        organization_id=source_call.organization_id,
                        lead_id=source_call.lead_id,
                        created_by=source_call.created_by,
                        dakini_call_id=returned_call_id,
                        dakini_batch_id=source_call.dakini_batch_id or batch_id or None,
                        agent_id=source_call.agent_id,
                        phone_number=source_call.phone_number,
                        status=str(detail.get("status") or "initiated").strip().lower(),
                    )
                    self.session.add(local_call)
                    candidates.append(local_call)
                    calls_by_phone.setdefault(phone_key, []).append(local_call)
                    calls_by_id[returned_call_id] = local_call
                    attempts_created += 1
                elif local_call is None and candidates:
                    # Some call-log records omit the external ID; still refresh the
                    # most recent local attempt without creating an unidentifiable row.
                    local_call = candidates[-1]

            if local_call is None:
                continue
            if returned_call_id and not local_call.dakini_call_id:
                local_call.dakini_call_id = returned_call_id
                calls_by_id[returned_call_id] = local_call
            await self._persist_call_log(local_call, detail, item)
            local_call.last_polled_at = now
            matched += 1

        await self.session.commit()
        if matched == 0 and iterable:
            logger.warning(
                "Dakini returned %s call-log record(s) for agent %s, but none matched local batch/call IDs; sample fields=%s",
                len(iterable), agent_id, sorted(iterable[0][1].keys())[:30],
            )
        else:
            logger.info(
                "Dakini call-log sync agent=%s seen=%s matched=%s additional_attempts=%s",
                agent_id, len(iterable), matched, attempts_created,
            )
        return {"call_logs_seen": len(iterable), "calls_matched": matched, "attempts_created": attempts_created}

    @staticmethod
    def _normal_phone_key(value: str) -> str:
        # E.164 digits preserve country-code distinctions for international leads.
        return "".join(ch for ch in value if ch.isdigit())

    async def _persist_call_log(
        self, call: DakiniCall, data: dict[str, Any], raw: dict[str, Any]
    ) -> None:
        call.status = str(data.get("status") or data.get("call_status") or data.get("state") or call.status).strip().lower()
        call.raw_response = raw
        call.synced_at = datetime.now(timezone.utc)
        telephony = data.get("telephony_data") if isinstance(data.get("telephony_data"), dict) else {}
        recording_url = telephony.get("recording_url") or data.get("recording_url")
        call.recording_url = str(recording_url) if recording_url else call.recording_url
        duration = (data.get("conversation_duration") or data.get("call_duration") or data.get("duration") or telephony.get("duration") or 0)
        try:
            if isinstance(duration, str) and ":" in duration:
                parts = [int(part) for part in duration.split(":")]
                if len(parts) == 3:
                    call.duration_seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
                elif len(parts) == 2:
                    call.duration_seconds = parts[0] * 60 + parts[1]
            else:
                call.duration_seconds = int(float(duration))
        except (TypeError, ValueError):
            pass
        transcript_value = (
            data.get("transcript")
            or data.get("transcript_text")
            or data.get("conversation_transcript")
            or data.get("transcription")
        )
        if isinstance(transcript_value, dict):
            transcript_text = (transcript_value.get("text") or transcript_value.get("content") or transcript_value.get("full_transcript"))
        else:
            transcript_text = transcript_value
        if not isinstance(transcript_text, str) or not transcript_text.strip():
            return

        existing_transcript = None
        if call.transcript_id:
            existing_transcript = await self.session.get(CallTranscript, call.transcript_id)
        if not existing_transcript:
            activity = Activity(
                organization_id=call.organization_id,
                lead_id=call.lead_id,
                user_id=call.created_by,
                type="call",
                subject="Dakini AI Call",
                description=f"Dakini AI call {call.dakini_call_id or call.dakini_batch_id}",
                start_at=data.get("initiated_at") or data.get("created_at") or datetime.now(timezone.utc),
                end_at=data.get("updated_at") or datetime.now(timezone.utc),
                duration_seconds=call.duration_seconds,
                status="completed",
            )
            # Normalize timestamp strings before ORM assignment.
            for field in ("start_at", "end_at"):
                value = getattr(activity, field)
                if isinstance(value, str):
                    try:
                        setattr(activity, field, datetime.fromisoformat(value.replace("Z", "+00:00")))
                    except ValueError:
                        setattr(activity, field, datetime.now(timezone.utc))
            self.session.add(activity)
            await self.session.flush()
            transcript = CallTranscript(
                organization_id=call.organization_id,
                activity_id=activity.id,
                external_call_id=str(call.dakini_call_id or f"batch:{call.dakini_batch_id}:{call.phone_number}")[:100],
                raw_text=transcript_text.strip(),
                diarization=data.get("diarization") or [],
                recording_url=call.recording_url[:500] if call.recording_url else None,
                duration_seconds=call.duration_seconds,
            )
            self.session.add(transcript)
            await self.session.flush()
            call.activity_id = activity.id
            call.transcript_id = transcript.id
            existing_transcript = transcript
        else:
            existing_transcript.raw_text = transcript_text.strip()
            existing_transcript.recording_url = call.recording_url[:500] if call.recording_url else None
            existing_transcript.duration_seconds = call.duration_seconds

        # Raw transcript is committed by the polling worker. Layer 5 runs in a separate queue.

    async def _analyze_transcript(self, transcript: str, user_id: str | None = None) -> dict[str, Any]:
        if not settings.AI_INTERNAL_API_KEY:
            raise RuntimeError("AI_INTERNAL_API_KEY is not configured")
        url = settings.AI_SERVICE_URL.rstrip("/") + "/v1/ai/transcript-analysis"
        headers = {
            "X-AI-Service-Key": settings.AI_INTERNAL_API_KEY,
            "X-CRM-Tenant-Id": str(self.ctx.tenant_uuid),
            "X-CRM-User-Id": user_id or str(self.ctx.user_uuid),
            "X-CRM-User-Role": self.ctx.role,
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(url, headers=headers, json={"transcript": transcript})
            response.raise_for_status()
            payload = response.json()
        outputs = payload.get("outputs") if isinstance(payload, dict) else None
        if not isinstance(outputs, dict):
            raise RuntimeError("Layer 5 returned an invalid analysis response")
        return outputs

    async def _call_details(self, call: DakiniCall) -> dict[str, Any]:
        """Return the call, persisted raw transcript, and latest manual AI analysis."""
        result = self._call_result(call, call.raw_response if isinstance(call.raw_response, dict) else {})
        transcript = await self.session.get(CallTranscript, call.transcript_id) if call.transcript_id else None
        result["transcript_text"] = transcript.raw_text if transcript else None
        result["diarization"] = transcript.diarization if transcript else None
        result["transcript_created_at"] = transcript.created_at.isoformat() if transcript and transcript.created_at else None
        analysis_result = None
        if transcript:
            analysis_query = await self.session.execute(
                select(CallAnalysis)
                .where(
                    CallAnalysis.organization_id == self.ctx.tenant_uuid,
                    CallAnalysis.transcript_id == transcript.id,
                    CallAnalysis.status == "completed",
                )
                .order_by(CallAnalysis.analyzed_at.desc(), CallAnalysis.created_at.desc())
                .limit(1)
            )
            analysis = analysis_query.scalar_one_or_none()
            if analysis:
                analysis_result = {
                    "summary": analysis.summary or {},
                    "improvements": analysis.improvements or {},
                    "sentiment": analysis.sentiment,
                    "call_outcome": analysis.call_outcome,
                    "status": analysis.status,
                    "analyzed_at": analysis.analyzed_at.isoformat() if analysis.analyzed_at else None,
                    "error_message": analysis.error_message,
                }
                result["analysis_saved"] = bool(analysis.analyzed_at and analysis.status == "completed")
        result["analysis_result"] = analysis_result
        return result

    async def manually_analyze_call(self, call_id: str) -> dict[str, Any]:
        """Analyze one stored Dakini transcript only after an authenticated user requests it."""
        call_query = await self.session.execute(
            select(DakiniCall).where(
                DakiniCall.organization_id == self.ctx.tenant_uuid,
                DakiniCall.dakini_call_id == call_id,
            )
        )
        call = call_query.scalar_one_or_none()
        if not call:
            raise HTTPException(status_code=404, detail="Dakini call not found in this CRM organization")
        lead = await self.session.get(Lead, call.lead_id)
        if not lead or lead.organization_id != self.ctx.tenant_uuid or not await self._can_access_lead(lead):
            raise HTTPException(status_code=403, detail="You do not have permission to analyse this call")
        if not call.transcript_id:
            raise HTTPException(status_code=409, detail="The call transcript has not been received yet")
        transcript = await self.session.get(CallTranscript, call.transcript_id)
        if not transcript or not transcript.raw_text.strip():
            raise HTTPException(status_code=409, detail="The call transcript is empty or unavailable")

        # Return an existing completed analysis rather than consuming provider quota again.
        if call.analyzed_at:
            return await self._call_details(call)
        completed_query = await self.session.execute(
            select(CallAnalysis).where(
                CallAnalysis.organization_id == self.ctx.tenant_uuid,
                CallAnalysis.transcript_id == transcript.id,
                CallAnalysis.status == "completed",
            ).order_by(CallAnalysis.analyzed_at.desc(), CallAnalysis.created_at.desc()).limit(1)
        )
        completed_analysis = completed_query.scalar_one_or_none()
        if completed_analysis:
            call.analyzed_at = completed_analysis.analyzed_at or datetime.now(timezone.utc)
            await self.session.commit()
            return await self._call_details(call)

        now = datetime.now(timezone.utc)
        call.analysis_attempts = int(call.analysis_attempts or 0) + 1
        call.analysis_last_attempt_at = now
        await self.session.commit()
        try:
            outputs = await self._analyze_transcript(transcript.raw_text, user_id=str(self.ctx.user_uuid))
        except httpx.HTTPStatusError as exc:
            call.error_message = f"Manual AI analysis failed (Layer 5 HTTP {exc.response.status_code}). {exc.response.text[:400]}"
            await self.session.commit()
            status_code = exc.response.status_code if exc.response.status_code in {400, 401, 403, 429} else 502
            raise HTTPException(status_code=status_code, detail=call.error_message) from exc
        except (httpx.HTTPError, RuntimeError) as exc:
            call.error_message = f"Manual AI analysis failed: {str(exc)[:450]}"
            await self.session.commit()
            raise HTTPException(status_code=502, detail=call.error_message) from exc

        summary = outputs.get("summary") if isinstance(outputs.get("summary"), dict) else outputs
        improvements = outputs.get("improvements") if isinstance(outputs.get("improvements"), (dict, list)) else {}
        existing = await self.session.execute(
            select(CallAnalysis).where(
                CallAnalysis.organization_id == self.ctx.tenant_uuid,
                CallAnalysis.transcript_id == transcript.id,
            ).order_by(CallAnalysis.created_at.desc()).limit(1)
        )
        analysis = existing.scalar_one_or_none()
        if analysis and analysis.status == "completed" and analysis.analyzed_at:
            call.analyzed_at = analysis.analyzed_at
        else:
            if analysis:
                analysis.summary = summary or {}
                analysis.improvements = improvements or {}
                analysis.status = "completed"
                analysis.analyzed_by = self.ctx.user_uuid
                analysis.analyzed_at = now
                analysis.error_message = None
                analysis.model_version = "layer5-manual-transcript-analysis"
            else:
                self.session.add(CallAnalysis(
                    organization_id=call.organization_id,
                    activity_id=call.activity_id,
                    transcript_id=call.transcript_id,
                    external_call_id=str(call.dakini_call_id)[:100],
                    lead_id=call.lead_id,
                    analyzed_by=self.ctx.user_uuid,
                    sentiment=str(outputs.get("sentiment") or "neutral"),
                    call_outcome=str(outputs.get("call_outcome") or "") or None,
                    summary=summary or {},
                    improvements=improvements or {},
                    status="completed",
                    model_version="layer5-manual-transcript-analysis",
                    analyzed_at=now,
                ))
            call.analyzed_at = now
        call.error_message = None
        product_interest = str(summary.get("product_interest") or "").strip()
        confidence = str(summary.get("product_interest_confidence") or "unknown").strip().lower()
        if product_interest and confidence in {"high", "medium"}:
            # A completed, user-requested transcript analysis can correct stale CRM
            # product data to the product the prospect actually expressed interest in.
            lead.interested_product = product_interest[:100]
        await self.session.commit()
        return await self._call_details(call)

    @staticmethod
    def _call_result(call: DakiniCall, data: dict[str, Any]) -> dict[str, Any]:
        return {
            "call_id": call.dakini_call_id,
            "lead_id": str(call.lead_id),
            "batch_id": call.dakini_batch_id,
            "status": call.status,
            "transcript_saved": bool(call.transcript_id),
            "analysis_saved": bool(call.analyzed_at),
            "duration_seconds": call.duration_seconds,
            "recording_url": call.recording_url,
            "last_polled_at": call.last_polled_at.isoformat() if call.last_polled_at else None,
            "transcript_id": str(call.transcript_id) if call.transcript_id else None,
            "activity_id": str(call.activity_id) if call.activity_id else None,
            "analysis_attempts": call.analysis_attempts,
            "synced_at": call.synced_at.isoformat() if call.synced_at else None,
            "error_message": call.error_message,
        }
