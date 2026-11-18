"""Automatic Dakini call-log and batch-status polling worker.

The worker is started by the Layer 3 FastAPI lifespan. PostgreSQL advisory locking
ensures only one API instance performs Dakini status and transcript polling in a
multi-worker or multi-replica deployment. AI transcript analysis is user-triggered.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, text, or_

from backend.app.application.context import RequestContext
from backend.app.application.services.dakini_calling_service import ACTIVE_CALL_STATUSES, DakiniCallingService
from backend.app.core.config import settings
from backend.app.data.database import get_session_factory, get_engine
from backend.app.data.models.dakini_calling import DakiniBatch, DakiniCall

logger = logging.getLogger("backend.dakini_call_worker")
POSTGRES_ADVISORY_LOCK_KEY = 7_211_162_026


class DakiniCallWorker:
    def __init__(self) -> None:
        self._stopping = asyncio.Event()

    def stop(self) -> None:
        self._stopping.set()

    async def run_forever(self) -> None:
        logger.info(
            "Dakini call-log and batch polling worker started (call_poll=%ss, batch_poll=%ss)",
            settings.DAKINI_CALL_POLL_INTERVAL_SECONDS,
            settings.DAKINI_BATCH_STATUS_POLL_INTERVAL_SECONDS,
        )
        # Keep transcript ingestion and batch/call status polling automatic, but do not
        # start the AI analysis queue. Layer 5 must only run after a user clicks
        # "AI Analyse" in the CRM. This is intentionally hard-disabled for this release
        # so an old .env value cannot silently spend provider quota.
        tasks = [
            asyncio.create_task(self._poll_loop(), name="dakini-call-log-poller"),
            asyncio.create_task(self._batch_loop(), name="dakini-batch-status-poller"),
        ]
        logger.info("Automatic AI transcript analysis is disabled; raw transcripts are stored for manual analysis")
        try:
            await asyncio.gather(*tasks)
        finally:
            self.stop()
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info("Dakini background worker stopped")

    async def _poll_loop(self) -> None:
        interval = max(15, min(30, settings.DAKINI_CALL_POLL_INTERVAL_SECONDS))
        while not self._stopping.is_set():
            try:
                await self.poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Dakini automatic call-log polling cycle failed")
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass

    async def _batch_loop(self) -> None:
        interval = max(30, min(60, settings.DAKINI_BATCH_STATUS_POLL_INTERVAL_SECONDS))
        while not self._stopping.is_set():
            try:
                await self.poll_batches_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Dakini automatic batch-status polling cycle failed")
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass

    async def poll_once(self) -> dict[str, int]:
        """Poll the agent-level call-log list once per tenant/agent, not once per lead."""
        if not settings.DAKINI_CALL_LOG_SYNC_ENABLED or not settings.DAKINI_API_KEY.strip():
            return {"groups": 0, "matched": 0}

        session_factory = get_session_factory()
        async with session_factory() as session:
            # Include older scheduled batches too; pending calls must not expire merely
            # because their batch was created more than a few days ago.
            active_batch_ids = select(DakiniBatch.dakini_batch_id).where(
                DakiniBatch.status.in_(("pending", "scheduled", "running"))
            )
            result = await session.execute(
                select(DakiniCall.organization_id, DakiniCall.agent_id)
                .where(
                    or_(
                        DakiniCall.transcript_id.is_(None),
                        DakiniCall.dakini_batch_id.in_(active_batch_ids),
                        DakiniCall.status.in_(tuple(ACTIVE_CALL_STATUSES)),
                    )
                )
                .distinct()
            )
            groups = [(row[0], row[1]) for row in result.all()]

        total_matched = 0
        for organization_id, agent_id in groups:
            if self._stopping.is_set():
                break
            ctx = RequestContext(
                user_id=str(organization_id),
                tenant_id=str(organization_id),
                role="owner",
                correlation_id="dakini_background_poll",
            )
            async with session_factory() as session:
                try:
                    result = await DakiniCallingService(session, ctx).poll_agent_call_logs(str(agent_id))
                    total_matched += result.get("calls_matched", 0)
                except Exception:
                    await session.rollback()
                    logger.exception(
                        "Automatic Dakini call-log sync failed for tenant=%s agent=%s",
                        organization_id,
                        agent_id,
                    )
        if groups:
            logger.info("Dakini polling processed %s tenant/agent group(s), matched %s call(s)", len(groups), total_matched)
        return {"groups": len(groups), "matched": total_matched}

    async def poll_batches_once(self) -> dict[str, int]:
        """Refresh active batch lifecycle states independently of transcript availability."""
        if not settings.DAKINI_CALL_LOG_SYNC_ENABLED or not settings.DAKINI_API_KEY.strip():
            return {"batches_checked": 0, "batches_updated": 0}

        session_factory = get_session_factory()
        active_statuses = ("pending", "scheduled", "running")
        async with session_factory() as session:
            result = await session.execute(
                select(DakiniBatch.organization_id, DakiniBatch.dakini_batch_id)
                .where(DakiniBatch.status.in_(active_statuses))
                .order_by(DakiniBatch.created_at.asc())
            )
            batches = [(row[0], row[1]) for row in result.all()]

        updated = 0
        for organization_id, batch_id in batches:
            if self._stopping.is_set():
                break
            ctx = RequestContext(
                user_id=str(organization_id),
                tenant_id=str(organization_id),
                role="owner",
                correlation_id="dakini_background_batch_poll",
            )
            async with session_factory() as session:
                try:
                    await DakiniCallingService(session, ctx).poll_batch_status(str(batch_id))
                    updated += 1
                except Exception:
                    await session.rollback()
                    logger.exception(
                        "Automatic Dakini batch status refresh failed for tenant=%s batch=%s",
                        organization_id,
                        batch_id,
                    )
        if batches:
            logger.info("Dakini batch status poll checked %s batch(es), updated %s", len(batches), updated)
        return {"batches_checked": len(batches), "batches_updated": updated}

    async def analyze_once(self) -> int:
        """Background transcript analysis is disabled; use the authenticated manual endpoint."""
        return 0


async def run_with_singleton_lock() -> None:
    """Run the call-log and batch polling worker with a PostgreSQL advisory lock."""
    if not settings.DAKINI_BACKGROUND_WORKER_ENABLED:
        logger.info("Dakini background worker disabled by configuration")
        return
    if not settings.DAKINI_CALL_LOG_SYNC_ENABLED:
        logger.info("Dakini background worker not started because call-log sync is disabled")
        return

    engine = get_engine()
    is_postgres = engine.dialect.name == "postgresql"
    if not is_postgres:
        logger.warning(
            "Dakini worker is running without a cross-process advisory lock because the database is %s; "
            "run only one Layer 3 process when using SQLite.",
            engine.dialect.name,
        )
        await DakiniCallWorker().run_forever()
        return

    while True:
        acquired = False
        async with engine.connect() as lock_connection:
            try:
                result = await lock_connection.execute(
                    text("SELECT pg_try_advisory_lock(:lock_key)"),
                    {"lock_key": POSTGRES_ADVISORY_LOCK_KEY},
                )
                acquired = bool(result.scalar())
                # The advisory lock is session-scoped; commit now so this connection
                # does not hold an idle transaction for the worker's entire lifetime.
                await lock_connection.commit()
                if acquired:
                    logger.info("Dakini worker acquired PostgreSQL singleton lock")
                    try:
                        await DakiniCallWorker().run_forever()
                    finally:
                        await lock_connection.execute(
                            text("SELECT pg_advisory_unlock(:lock_key)"),
                            {"lock_key": POSTGRES_ADVISORY_LOCK_KEY},
                        )
                        await lock_connection.commit()
                        logger.info("Dakini worker released PostgreSQL singleton lock")
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Dakini worker singleton process failed")
        if not acquired:
            await asyncio.sleep(15)
