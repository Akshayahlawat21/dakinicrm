import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.activity import Activity, CallTranscript, CallAnalysis
from backend.app.data.models.lead import Lead
from backend.app.data.repositories.base import BaseRepository


class CallTranscriptRepository(BaseRepository[CallTranscript]):
    """Tenant-scoped repository for Call Transcripts (1:1 with Activities)."""

    def __init__(self, session: AsyncSession):
        super().__init__(CallTranscript, session)

    async def get_by_activity_id(
        self, activity_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> Optional[CallTranscript]:
        act_uuid = self._parse_uuid(activity_id)
        org_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(CallTranscript)
            .where(
                CallTranscript.activity_id == act_uuid,
                CallTranscript.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def get_by_external_call_id(
        self, external_call_id: str, tenant_id: str | uuid.UUID
    ) -> Optional[CallTranscript]:
        org_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(CallTranscript)
            .where(
                CallTranscript.external_call_id == external_call_id,
                CallTranscript.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()


class CallAnalysisRepository(BaseRepository[CallAnalysis]):
    """Tenant-scoped repository for Call Analysis results with RBAC filtering."""

    def __init__(self, session: AsyncSession):
        super().__init__(CallAnalysis, session)

    async def get_analysis_detail(
        self, analysis_id: str | uuid.UUID, tenant_id: str | uuid.UUID
    ) -> Optional[CallAnalysis]:
        an_uuid = self._parse_uuid(analysis_id)
        org_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(CallAnalysis)
            .options(
                joinedload(CallAnalysis.transcript),
                joinedload(CallAnalysis.lead),
                joinedload(CallAnalysis.activity),
                joinedload(CallAnalysis.analyst),
            )
            .where(
                CallAnalysis.id == an_uuid,
                CallAnalysis.organization_id == org_uuid,
            )
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def list_analyses_scoped(
        self,
        tenant_id: str | uuid.UUID,
        allowed_user_ids: Optional[List[uuid.UUID]] = None,
        lead_id: Optional[str | uuid.UUID] = None,
        product_id: Optional[str | uuid.UUID] = None,
        sentiment: Optional[str] = None,
        call_outcome: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[CallAnalysis], int]:
        org_uuid = self._parse_uuid(tenant_id)
        conditions = [CallAnalysis.organization_id == org_uuid]

        # RBAC: Filter by user ownership (Activity user_id, CallAnalysis analyzed_by, OR Lead assigned_to)
        if allowed_user_ids is not None:
            conditions.append(
                or_(
                    CallAnalysis.analyzed_by.in_(allowed_user_ids),
                    CallAnalysis.activity_id.in_(
                        select(Activity.id).where(
                            Activity.organization_id == org_uuid,
                            Activity.user_id.in_(allowed_user_ids),
                        )
                    ),
                    CallAnalysis.lead_id.in_(
                        select(Lead.id).where(
                            Lead.organization_id == org_uuid,
                            Lead.assigned_to.in_(allowed_user_ids),
                        )
                    ),
                )
            )

        if lead_id:
            conditions.append(CallAnalysis.lead_id == self._parse_uuid(lead_id))

        if product_id:
            prod_uuid = self._parse_uuid(product_id)
            # Filter by product through lead relationship
            conditions.append(
                CallAnalysis.lead_id.in_(
                    select(Lead.id).where(
                        Lead.organization_id == org_uuid,
                        Lead.product_id == prod_uuid,
                    )
                )
            )

        if sentiment:
            conditions.append(CallAnalysis.sentiment == sentiment.lower().strip())

        if call_outcome:
            conditions.append(CallAnalysis.call_outcome == call_outcome.strip())

        if status:
            conditions.append(CallAnalysis.status == status.strip())

        if date_from:
            conditions.append(CallAnalysis.created_at >= date_from)

        if date_to:
            conditions.append(CallAnalysis.created_at <= date_to)

        # Count total
        count_stmt = select(func.count(CallAnalysis.id)).where(*conditions)
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar_one()

        # Query records with eager loaded relationships
        stmt = (
            select(CallAnalysis)
            .options(
                joinedload(CallAnalysis.transcript),
                joinedload(CallAnalysis.lead),
                joinedload(CallAnalysis.activity),
                joinedload(CallAnalysis.analyst),
            )
            .where(*conditions)
            .order_by(CallAnalysis.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        records = list(res.scalars().all())

        return records, total

    async def get_analysis_metrics(
        self,
        tenant_id: str | uuid.UUID,
        allowed_user_ids: Optional[List[uuid.UUID]] = None,
        product_id: Optional[str | uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Calculates aggregated dashboard metrics for calls with RBAC and product scoping."""
        org_uuid = self._parse_uuid(tenant_id)
        conditions = [CallAnalysis.organization_id == org_uuid]

        if allowed_user_ids is not None:
            conditions.append(
                or_(
                    CallAnalysis.analyzed_by.in_(allowed_user_ids),
                    CallAnalysis.activity_id.in_(
                        select(Activity.id).where(
                            Activity.organization_id == org_uuid,
                            Activity.user_id.in_(allowed_user_ids),
                        )
                    ),
                    CallAnalysis.lead_id.in_(
                        select(Lead.id).where(
                            Lead.organization_id == org_uuid,
                            Lead.assigned_to.in_(allowed_user_ids),
                        )
                    ),
                )
            )

        if product_id:
            prod_uuid = self._parse_uuid(product_id)
            conditions.append(
                CallAnalysis.lead_id.in_(
                    select(Lead.id).where(
                        Lead.organization_id == org_uuid,
                        Lead.product_id == prod_uuid,
                    )
                )
            )

        # 1. Total analyses
        total_stmt = select(func.count(CallAnalysis.id)).where(*conditions)
        total_analyses = (await self.session.execute(total_stmt)).scalar_one()

        # 2. Sentiment distribution
        sentiment_stmt = (
            select(CallAnalysis.sentiment, func.count(CallAnalysis.id))
            .where(*conditions)
            .group_by(CallAnalysis.sentiment)
        )
        sentiment_res = await self.session.execute(sentiment_stmt)
        sentiment_counts = {str(row[0] or "neutral"): row[1] for row in sentiment_res.all()}

        # 3. Call outcomes
        outcome_stmt = (
            select(CallAnalysis.call_outcome, func.count(CallAnalysis.id))
            .where(*conditions, CallAnalysis.call_outcome.isnot(None))
            .group_by(CallAnalysis.call_outcome)
        )
        outcome_res = await self.session.execute(outcome_stmt)
        outcome_counts = {str(row[0]): row[1] for row in outcome_res.all()}

        return {
            "total_analyses": total_analyses,
            "sentiment_distribution": sentiment_counts,
            "call_outcomes": outcome_counts,
        }
