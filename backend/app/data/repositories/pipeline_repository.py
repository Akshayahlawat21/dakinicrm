import uuid
from typing import List, Optional, Dict
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.data.models.pipeline import Pipeline, PipelineStage, UserDealColumn
from backend.app.data.repositories.base import BaseRepository


DEFAULT_CORE_STAGES = [
    {"name": "Qualified", "order_index": 1000, "color": "#3b82f6", "win_probability": 50, "tags": ["high qualified"], "is_system": True, "is_won": False, "is_lost": False},
    {"name": "Proposal", "order_index": 2000, "color": "#8b5cf6", "win_probability": 75, "tags": [], "is_system": True, "is_won": False, "is_lost": False},
    {"name": "Negotiation", "order_index": 3000, "color": "#f59e0b", "win_probability": 85, "tags": [], "is_system": True, "is_won": False, "is_lost": False},
    {"name": "Won", "order_index": 4000, "color": "#10b981", "win_probability": 100, "tags": [], "is_system": True, "is_won": True, "is_lost": False},
    {"name": "Lost", "order_index": 5000, "color": "#ef4444", "win_probability": 0, "tags": [], "is_system": True, "is_won": False, "is_lost": True},
]


class PipelineRepository(BaseRepository[Pipeline]):
    """Tenant- and user-scoped repository for dynamic pipelines, custom stages, and deal column overrides."""

    def __init__(self, session: AsyncSession):
        super().__init__(Pipeline, session)

    async def ensure_default_pipeline(self, tenant_id: str | uuid.UUID) -> Pipeline:
        """Fetches the org's default pipeline, or lazily creates + seeds core stages if absent."""
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(Pipeline)
            .where(
                Pipeline.organization_id == tenant_uuid,
                Pipeline.deleted_at.is_(None),
            )
            .order_by(Pipeline.is_default.desc(), Pipeline.created_at.asc())
        )
        res = await self.session.execute(stmt)
        pipeline = res.scalars().first()

        if not pipeline:
            pipeline = Pipeline(
                id=uuid.uuid4(),
                organization_id=tenant_uuid,
                name="Sales Pipeline",
                description="Default organization sales pipeline",
                is_default=True,
                status="active",
            )
            self.session.add(pipeline)
            await self.session.flush()

        # Verify org stages exist on this pipeline
        stg_stmt = select(PipelineStage).where(
            PipelineStage.pipeline_id == pipeline.id,
            PipelineStage.organization_id == tenant_uuid,
            PipelineStage.scope == "org",
            PipelineStage.deleted_at.is_(None),
        )
        existing_org_stages = list((await self.session.execute(stg_stmt)).scalars().all())
        existing_names = {s.name.lower().strip() for s in existing_org_stages}

        added = False
        for cfg in DEFAULT_CORE_STAGES:
            if cfg["name"].lower() not in existing_names:
                self.session.add(
                    PipelineStage(
                        id=uuid.uuid4(),
                        pipeline_id=pipeline.id,
                        organization_id=tenant_uuid,
                        user_id=None,
                        scope="org",
                        parent_base_stage=cfg["name"],
                        name=cfg["name"],
                        order_index=cfg["order_index"],
                        color=cfg["color"],
                        win_probability=cfg["win_probability"],
                        qualification_tags=list(cfg["tags"]),
                        is_system=cfg["is_system"],
                        is_won=cfg["is_won"],
                        is_lost=cfg["is_lost"],
                    )
                )
                added = True
        if added:
            await self.session.flush()

        return pipeline

    async def list_visible_stages(
        self,
        tenant_id: str | uuid.UUID,
        pipeline_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> List[PipelineStage]:
        """Returns shared 'org' stages + caller's own 'personal' custom stages sorted by order_index."""
        tenant_uuid = self._parse_uuid(tenant_id)
        pipe_uuid = self._parse_uuid(pipeline_id)
        user_uuid = self._parse_uuid(user_id)

        stmt = (
            select(PipelineStage)
            .where(
                PipelineStage.organization_id == tenant_uuid,
                PipelineStage.pipeline_id == pipe_uuid,
                PipelineStage.deleted_at.is_(None),
                or_(
                    PipelineStage.scope == "org",
                    and_(
                        PipelineStage.scope == "personal",
                        PipelineStage.user_id == user_uuid,
                    ),
                ),
            )
            .order_by(PipelineStage.order_index.asc(), PipelineStage.created_at.asc())
        )
        res = await self.session.execute(stmt)
        return list(res.scalars().all())

    async def list_pipelines_with_stages(
        self,
        tenant_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
    ) -> List[tuple[Pipeline, List[PipelineStage]]]:
        await self.ensure_default_pipeline(tenant_id)
        tenant_uuid = self._parse_uuid(tenant_id)
        stmt = (
            select(Pipeline)
            .where(
                Pipeline.organization_id == tenant_uuid,
                Pipeline.deleted_at.is_(None),
            )
            .order_by(Pipeline.is_default.desc(), Pipeline.created_at.asc())
        )
        pipelines = list((await self.session.execute(stmt)).scalars().all())

        result = []
        for p in pipelines:
            stages = await self.list_visible_stages(tenant_uuid, p.id, user_id)
            result.append((p, stages))
        return result

    async def get_stage_scoped(
        self,
        stage_id: str | uuid.UUID,
        tenant_id: str | uuid.UUID,
    ) -> Optional[PipelineStage]:
        tenant_uuid = self._parse_uuid(tenant_id)
        stage_uuid = self._parse_uuid(stage_id)
        stmt = select(PipelineStage).where(
            PipelineStage.id == stage_uuid,
            PipelineStage.organization_id == tenant_uuid,
            PipelineStage.deleted_at.is_(None),
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def resolve_org_stage_by_name(
        self,
        tenant_id: str | uuid.UUID,
        stage_name: str,
        pipeline_id: Optional[uuid.UUID] = None,
    ) -> Optional[PipelineStage]:
        tenant_uuid = self._parse_uuid(tenant_id)
        if not pipeline_id:
            pipeline = await self.ensure_default_pipeline(tenant_uuid)
            pipeline_id = pipeline.id

        stmt = select(PipelineStage).where(
            PipelineStage.organization_id == tenant_uuid,
            PipelineStage.pipeline_id == pipeline_id,
            PipelineStage.scope == "org",
            PipelineStage.deleted_at.is_(None),
        )
        stages = list((await self.session.execute(stmt)).scalars().all())
        clean = (stage_name or "Qualified").lower().strip()
        for s in stages:
            if s.name.lower().strip() == clean:
                return s
        # Fallback to Qualified / lowest order_index org stage
        stages.sort(key=lambda s: s.order_index)
        return stages[0] if stages else None

    async def get_user_deal_overrides_map(
        self,
        tenant_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
        deal_ids: List[uuid.UUID],
    ) -> Dict[uuid.UUID, PipelineStage]:
        """Returns {deal_id: PipelineStage} for active personal column placements owned by user_id."""
        if not deal_ids:
            return {}
        tenant_uuid = self._parse_uuid(tenant_id)
        user_uuid = self._parse_uuid(user_id)
        stmt = (
            select(UserDealColumn.deal_id, PipelineStage)
            .join(PipelineStage, UserDealColumn.stage_id == PipelineStage.id)
            .where(
                UserDealColumn.organization_id == tenant_uuid,
                UserDealColumn.user_id == user_uuid,
                UserDealColumn.deal_id.in_(deal_ids),
                PipelineStage.deleted_at.is_(None),
            )
        )
        res = await self.session.execute(stmt)
        return {deal_id: stage_obj for deal_id, stage_obj in res.all()}

    async def upsert_user_deal_override(
        self,
        tenant_id: str | uuid.UUID,
        user_id: str | uuid.UUID,
        deal_id: uuid.UUID,
        stage_id: uuid.UUID,
    ) -> None:
        tenant_uuid = self._parse_uuid(tenant_id)
        user_uuid = self._parse_uuid(user_id)
        stmt = select(UserDealColumn).where(
            UserDealColumn.user_id == user_uuid,
            UserDealColumn.deal_id == deal_id,
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if existing:
            existing.stage_id = stage_id
            existing.updated_at = now
        else:
            self.session.add(
                UserDealColumn(
                    id=uuid.uuid4(),
                    organization_id=tenant_uuid,
                    user_id=user_uuid,
                    deal_id=deal_id,
                    stage_id=stage_id,
                    created_at=now,
                    updated_at=now,
                )
            )
        await self.session.flush()

    async def delete_user_deal_override(
        self,
        user_id: str | uuid.UUID,
        deal_id: uuid.UUID,
    ) -> None:
        user_uuid = self._parse_uuid(user_id)
        await self.session.execute(
            delete(UserDealColumn).where(
                UserDealColumn.user_id == user_uuid,
                UserDealColumn.deal_id == deal_id,
            )
        )
        await self.session.flush()

    async def clear_stale_deal_overrides_for_core_move(
        self,
        deal_id: uuid.UUID,
        new_base_stage_name: str,
    ) -> None:
        """Removes personal column overrides on this deal that were scoped under a different core stage."""
        subq = select(PipelineStage.id).where(
            PipelineStage.parent_base_stage != new_base_stage_name
        )
        await self.session.execute(
            delete(UserDealColumn).where(
                UserDealColumn.deal_id == deal_id,
                UserDealColumn.stage_id.in_(subq),
            )
        )
        await self.session.flush()

