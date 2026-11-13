import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError
from backend.app.data.models.deal import Deal, Opportunity
from backend.app.data.models.pipeline import Pipeline, PipelineStage, UserDealColumn
from backend.app.data.repositories.pipeline_repository import PipelineRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository


class PipelineService:
    """Service layer managing dynamic pipelines, per-user custom columns, and safe deal reassignment."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.pipeline_repo = PipelineRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def list_pipelines(self, ctx: RequestContext) -> List[Dict[str, Any]]:
        pairs = await self.pipeline_repo.list_pipelines_with_stages(ctx.tenant_id, ctx.user_id)
        await self.session.commit()
        return [
            {
                "id": str(p.id),
                "organization_id": str(p.organization_id),
                "name": p.name,
                "description": p.description,
                "is_default": p.is_default,
                "status": p.status,
                "created_at": p.created_at,
                "stages": [self._stage_to_dict(s) for s in stages],
            }
            for p, stages in pairs
        ]

    async def create_pipeline(
        self,
        ctx: RequestContext,
        name: str,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not (ctx.is_owner or ctx.is_manager):
            raise ForbiddenError("Only Owners or Managers can create new pipelines.")
        clean_name = (name or "").strip()
        if not clean_name:
            raise BadRequestError("Pipeline name is required.")

        pipe = Pipeline(
            id=uuid.uuid4(),
            organization_id=ctx.tenant_uuid,
            name=clean_name,
            description=description,
            is_default=False,
            status="active",
        )
        self.session.add(pipe)
        await self.session.flush()
        stages = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)
        await self.session.commit()
        return {
            "id": str(pipe.id),
            "organization_id": str(pipe.organization_id),
            "name": pipe.name,
            "description": pipe.description,
            "is_default": pipe.is_default,
            "status": pipe.status,
            "created_at": pipe.created_at,
            "stages": [self._stage_to_dict(s) for s in stages],
        }

    async def create_stage(
        self,
        ctx: RequestContext,
        pipeline_id: str,
        name: str,
        parent_stage_id: Optional[str] = None,
        parent_base_stage: Optional[str] = None,
        color: Optional[str] = "#06b6d4",
        win_probability: Optional[int] = None,
        qualification_tags: Optional[List[str]] = None,
        scope: str = "personal",
    ) -> Dict[str, Any]:
        clean_name = (name or "").strip()
        if not clean_name:
            raise BadRequestError("Column name is required.")

        clean_scope = (scope or "personal").lower().strip()
        if clean_scope not in ("personal", "org"):
            raise BadRequestError("Stage scope must be 'personal' or 'org'.")
        if clean_scope == "org" and not ctx.is_owner:
            raise ForbiddenError("Only Owners can create organization-wide shared columns. Use scope='personal' instead.")

        pipe = await self._get_pipeline_scoped(pipeline_id, ctx.tenant_uuid)
        visible_stages = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)

        if any(s.name.lower().strip() == clean_name.lower() for s in visible_stages):
            raise BadRequestError(f"A column named '{clean_name}' already exists on your board.")

        # Resolve parent column where '+' was clicked (or fallback to Qualified)
        parent_stage: Optional[PipelineStage] = None
        if parent_stage_id:
            parent_stage = next((s for s in visible_stages if str(s.id) == str(parent_stage_id)), None)
            if not parent_stage:
                raise NotFoundError(f"Parent stage '{parent_stage_id}' was not found or is not accessible.")
        else:
            base_target = (parent_base_stage or "Qualified").lower().strip()
            parent_stage = next(
                (s for s in visible_stages if s.scope == "org" and s.name.lower().strip() == base_target),
                visible_stages[0] if visible_stages else None,
            )

        if not parent_stage:
            raise BadRequestError("Could not resolve a parent stage for this pipeline.")

        resolved_base_stage = parent_stage.parent_base_stage or parent_stage.name
        resolved_is_won = bool(parent_stage.is_won)
        resolved_is_lost = bool(parent_stage.is_lost)

        if resolved_is_won:
            resolved_prob = win_probability if win_probability is not None else 100
            default_color = "#10b981"
        elif resolved_is_lost:
            resolved_prob = win_probability if win_probability is not None else 0
            default_color = "#ef4444"
        else:
            resolved_prob = win_probability if win_probability is not None else parent_stage.win_probability
            default_color = "#06b6d4"

        new_order = await self._allocate_order_index_after(visible_stages, parent_stage, ctx.user_uuid)

        new_stage = PipelineStage(
            id=uuid.uuid4(),
            pipeline_id=pipe.id,
            organization_id=ctx.tenant_uuid,
            user_id=None if clean_scope == "org" else ctx.user_uuid,
            scope=clean_scope,
            parent_stage_id=parent_stage.id,
            parent_base_stage=resolved_base_stage,
            name=clean_name,
            order_index=new_order,
            color=color or default_color,
            win_probability=resolved_prob,
            qualification_tags=list(qualification_tags or []),
            is_system=False,
            is_won=resolved_is_won,
            is_lost=resolved_is_lost,
        )
        self.session.add(new_stage)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="pipeline_stage",
            resource_id=new_stage.id,
            new_values={
                "name": clean_name,
                "scope": clean_scope,
                "parent_base_stage": resolved_base_stage,
                "parent_stage_id": str(parent_stage.id),
            },
        )
        await self.session.commit()
        return self._stage_to_dict(new_stage)

    async def update_stage(
        self,
        ctx: RequestContext,
        pipeline_id: str,
        stage_id: str,
        name: Optional[str] = None,
        color: Optional[str] = None,
        win_probability: Optional[int] = None,
        qualification_tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        pipe = await self._get_pipeline_scoped(pipeline_id, ctx.tenant_uuid)
        stage = await self.pipeline_repo.get_stage_scoped(stage_id, ctx.tenant_uuid)
        if not stage or stage.pipeline_id != pipe.id:
            raise NotFoundError(f"Stage '{stage_id}' was not found in this pipeline.")

        self._check_stage_write_permission(ctx, stage)

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise BadRequestError("Column name cannot be empty.")
            if stage.is_system and clean_name.lower() != stage.name.lower():
                raise BadRequestError(f"Protected core stage '{stage.name}' cannot be renamed.")
            visible = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)
            if any(s.id != stage.id and s.name.lower().strip() == clean_name.lower() for s in visible):
                raise BadRequestError(f"A column named '{clean_name}' already exists on your board.")
            old_name = stage.name
            stage.name = clean_name
            if stage.scope == "org":
                await self.session.execute(
                    update(Deal)
                    .where(Deal.stage_id == stage.id, Deal.organization_id == ctx.tenant_uuid)
                    .values(stage=clean_name)
                )
                await self.session.execute(
                    update(PipelineStage)
                    .where(
                        PipelineStage.organization_id == ctx.tenant_uuid,
                        PipelineStage.parent_base_stage == old_name,
                    )
                    .values(parent_base_stage=clean_name)
                )

        if color is not None:
            stage.color = color
        if win_probability is not None:
            stage.win_probability = win_probability
        if qualification_tags is not None:
            stage.qualification_tags = list(qualification_tags)

        stage.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return self._stage_to_dict(stage)

    async def reorder_stages(
        self,
        ctx: RequestContext,
        pipeline_id: str,
        stage_ids: List[str],
    ) -> List[Dict[str, Any]]:
        pipe = await self._get_pipeline_scoped(pipeline_id, ctx.tenant_uuid)
        visible = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)
        stage_by_id = {str(s.id): s for s in visible}
        now = datetime.now(timezone.utc)

        # Preserve sequence using visible stage order as fallback for omitted items
        seen = set()
        ordered: List[PipelineStage] = []
        for sid in stage_ids:
            st = stage_by_id.get(str(sid))
            if st and st.id not in seen:
                ordered.append(st)
                seen.add(st.id)
        for st in visible:
            if st.id not in seen:
                ordered.append(st)
                seen.add(st.id)

        def _can_move(st: PipelineStage) -> bool:
            if st.scope == "org":
                return ctx.is_owner
            return st.user_id == ctx.user_uuid or ctx.is_owner

        if ctx.is_owner:
            for idx, st in enumerate(ordered):
                if _can_move(st):
                    st.order_index = (idx + 1) * 1000
                    st.updated_at = now
        else:
            # Interpolate movable personal columns smoothly between fixed 'org' stage anchors
            n = len(ordered)
            i = 0
            while i < n:
                if not _can_move(ordered[i]):
                    i += 1
                    continue
                left_order = ordered[i - 1].order_index if i > 0 else 0
                j = i
                while j < n and _can_move(ordered[j]):
                    j += 1
                right_order = ordered[j].order_index if j < n else (left_order + 1000)
                run_len = j - i
                span = max(right_order - left_order, run_len + 1)
                for k in range(run_len):
                    st = ordered[i + k]
                    st.order_index = left_order + int(((k + 1) * span) / (run_len + 1))
                    st.updated_at = now
                i = j

        await self.session.commit()
        updated = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)
        return [self._stage_to_dict(s) for s in updated]

    async def delete_stage(
        self,
        ctx: RequestContext,
        pipeline_id: str,
        stage_id: str,
        reassign_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Safely deletes a custom stage column:
        - Blocks deletion of protected core stages (Qualified, Won, Lost).
        - Atomically transfers deals (to explicit `reassign_to`, or parent stage, or Qualified by default)
          and re-links child custom columns before deleting.
        """
        pipe = await self._get_pipeline_scoped(pipeline_id, ctx.tenant_uuid)
        stage = await self.pipeline_repo.get_stage_scoped(stage_id, ctx.tenant_uuid)
        if not stage or stage.pipeline_id != pipe.id:
            raise NotFoundError(f"Stage '{stage_id}' was not found in this pipeline.")

        self._check_stage_write_permission(ctx, stage)

        if stage.is_system:
            raise BadRequestError(
                f"Core system column '{stage.name}' cannot be deleted because it anchors CRM workflow reporting."
            )

        visible = await self.pipeline_repo.list_visible_stages(ctx.tenant_id, pipe.id, ctx.user_id)
        target_stage: Optional[PipelineStage] = None

        if reassign_to:
            target_stage = next((s for s in visible if str(s.id) == str(reassign_to)), None)
            if not target_stage or target_stage.id == stage.id:
                raise BadRequestError("Selected reassignment destination stage is invalid.")
            if stage.scope == "org" and target_stage.scope != "org":
                raise BadRequestError("Shared organization stages can only be reassigned to another organization stage.")
        else:
            # Default fallback chain: immediate parent -> root parent_base_stage -> Qualified
            if stage.parent_stage_id:
                target_stage = next(
                    (s for s in visible if s.id == stage.parent_stage_id and s.id != stage.id),
                    None,
                )
            if not target_stage and stage.parent_base_stage:
                target_stage = next(
                    (s for s in visible if s.scope == "org" and s.name.lower() == stage.parent_base_stage.lower() and s.id != stage.id),
                    None,
                )
            if not target_stage:
                target_stage = next(
                    (s for s in visible if s.scope == "org" and s.name.lower() == "qualified" and s.id != stage.id),
                    None,
                )

        if not target_stage:
            raise BadRequestError("No valid destination column exists to safely reassign existing deals.")

        now = datetime.now(timezone.utc)
        reassigned_count = 0

        if stage.scope == "personal":
            # Re-link any child personal columns that pointed to this column up to target_stage
            await self.session.execute(
                update(PipelineStage)
                .where(
                    PipelineStage.organization_id == ctx.tenant_uuid,
                    PipelineStage.parent_stage_id == stage.id,
                )
                .values(
                    parent_stage_id=target_stage.id,
                    parent_base_stage=target_stage.parent_base_stage or target_stage.name,
                    updated_at=now,
                )
            )

            # Find deals sitting in this user's custom column
            override_res = await self.session.execute(
                select(UserDealColumn.deal_id).where(
                    UserDealColumn.stage_id == stage.id,
                    UserDealColumn.organization_id == ctx.tenant_uuid,
                )
            )
            affected_deal_ids = [r[0] for r in override_res.all()]
            reassigned_count = len(affected_deal_ids)

            target_base_name = target_stage.parent_base_stage or target_stage.name
            if affected_deal_ids and target_base_name != (stage.parent_base_stage or "Qualified"):
                # Moving to a different canonical stage (e.g. Proposal / Negotiation)
                target_org_stage = await self.pipeline_repo.resolve_org_stage_by_name(
                    ctx.tenant_id, target_base_name, pipe.id
                )
                if target_org_stage:
                    new_status = "won" if target_org_stage.is_won else ("lost" if target_org_stage.is_lost else "open")
                    await self.session.execute(
                        update(Deal)
                        .where(Deal.id.in_(affected_deal_ids), Deal.organization_id == ctx.tenant_uuid)
                        .values(
                            stage_id=target_org_stage.id,
                            stage=target_org_stage.name,
                            status=new_status,
                            updated_at=now,
                        )
                    )

            if target_stage.scope == "personal":
                await self.session.execute(
                    update(UserDealColumn)
                    .where(UserDealColumn.stage_id == stage.id)
                    .values(stage_id=target_stage.id, updated_at=now)
                )
            else:
                # Target is an 'org' column (like Qualified fallback): clear overrides so deals drop naturally into it
                await self.session.execute(
                    delete(UserDealColumn).where(UserDealColumn.stage_id == stage.id)
                )
        else:
            # Organization-wide non-system column deletion: atomically move deals in DB
            deal_count_stmt = select(func.count(Deal.id)).where(
                Deal.stage_id == stage.id,
                Deal.organization_id == ctx.tenant_uuid,
                Deal.deleted_at.is_(None),
            )
            reassigned_count = (await self.session.execute(deal_count_stmt)).scalar_one()

            new_status = "won" if target_stage.is_won else ("lost" if target_stage.is_lost else "open")
            await self.session.execute(
                update(Deal)
                .where(Deal.stage_id == stage.id, Deal.organization_id == ctx.tenant_uuid)
                .values(
                    stage_id=target_stage.id,
                    stage=target_stage.name,
                    status=new_status,
                    updated_at=now,
                )
            )
            await self.session.execute(
                delete(UserDealColumn).where(UserDealColumn.stage_id == stage.id)
            )

        stage.deleted_at = now
        stage.updated_at = now

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="pipeline_stage",
            resource_id=stage.id,
            old_values={"name": stage.name, "scope": stage.scope},
            new_values={
                "reassigned_to_stage_id": str(target_stage.id),
                "reassigned_to_stage_name": target_stage.name,
                "reassigned_deals_count": reassigned_count,
            },
        )
        await self.session.commit()

        return {
            "deleted_stage_id": str(stage.id),
            "deleted_stage_name": stage.name,
            "reassigned_to_stage_id": str(target_stage.id),
            "reassigned_to_stage_name": target_stage.name,
            "reassigned_deals_count": reassigned_count,
        }

    async def _get_pipeline_scoped(self, pipeline_id: str, tenant_uuid: uuid.UUID) -> Pipeline:
        try:
            pipe_uuid = uuid.UUID(str(pipeline_id))
        except ValueError:
            raise BadRequestError("Invalid pipeline ID format.")
        stmt = select(Pipeline).where(
            Pipeline.id == pipe_uuid,
            Pipeline.organization_id == tenant_uuid,
            Pipeline.deleted_at.is_(None),
        )
        pipe = (await self.session.execute(stmt)).scalar_one_or_none()
        if not pipe:
            raise NotFoundError(f"Pipeline '{pipeline_id}' was not found in this organization.")
        return pipe

    def _check_stage_write_permission(self, ctx: RequestContext, stage: PipelineStage) -> None:
        if stage.scope == "org" and not ctx.is_owner:
            raise ForbiddenError("Only Owners can modify shared organization stages.")
        if stage.scope == "personal" and stage.user_id != ctx.user_uuid and not ctx.is_owner:
            raise ForbiddenError("You can only modify your own custom columns.")

    async def _allocate_order_index_after(
        self,
        visible_stages: List[PipelineStage],
        parent_stage: PipelineStage,
        user_uuid: uuid.UUID,
    ) -> int:
        """Computes an integer order_index placing the new column immediately right of parent_stage."""
        p_idx = next((i for i, s in enumerate(visible_stages) if s.id == parent_stage.id), -1)
        if p_idx == -1 or p_idx == len(visible_stages) - 1:
            return parent_stage.order_index + 100

        next_col = visible_stages[p_idx + 1]
        gap = next_col.order_index - parent_stage.order_index
        if gap >= 2:
            return parent_stage.order_index + (gap // 2)

        # If bracket got tightly packed, re-space user's personal columns evenly between enclosing org brackets
        left_org_idx = parent_stage.order_index
        for i in range(p_idx, -1, -1):
            if visible_stages[i].scope == "org":
                left_org_idx = visible_stages[i].order_index
                break

        right_org_idx = left_org_idx + 1000
        for i in range(p_idx + 1, len(visible_stages)):
            if visible_stages[i].scope == "org":
                right_org_idx = visible_stages[i].order_index
                break

        personal_in_bracket = [
            s for s in visible_stages
            if s.scope == "personal"
            and s.user_id == user_uuid
            and left_org_idx < s.order_index < right_org_idx
        ]
        total_slots = len(personal_in_bracket) + 2
        step = max(1, (right_org_idx - left_org_idx) // total_slots)

        cursor = left_org_idx
        new_pos = left_org_idx + step
        insert_after_personal = parent_stage.scope == "personal"

        slot = 1
        for ps in personal_in_bracket:
            ps.order_index = left_org_idx + (slot * step)
            if ps.id == parent_stage.id:
                slot += 1
                new_pos = left_org_idx + (slot * step)
            slot += 1
        if not insert_after_personal:
            new_pos = left_org_idx + step
            for idx_ps, ps in enumerate(personal_in_bracket):
                ps.order_index = left_org_idx + ((idx_ps + 2) * step)
        await self.session.flush()
        return new_pos

    @staticmethod
    def _stage_to_dict(s: PipelineStage) -> Dict[str, Any]:
        return {
            "id": str(s.id),
            "pipeline_id": str(s.pipeline_id),
            "organization_id": str(s.organization_id),
            "user_id": str(s.user_id) if s.user_id else None,
            "scope": s.scope,
            "parent_stage_id": str(s.parent_stage_id) if s.parent_stage_id else None,
            "parent_base_stage": s.parent_base_stage,
            "name": s.name,
            "order_index": s.order_index,
            "color": s.color,
            "win_probability": s.win_probability,
            "qualification_tags": list(s.qualification_tags or []),
            "is_system": s.is_system,
            "is_won": s.is_won,
            "is_lost": s.is_lost,
        }
