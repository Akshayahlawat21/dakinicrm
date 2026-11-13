-- AI copilot read-path indexes. Safe to apply repeatedly.
CREATE INDEX IF NOT EXISTS ix_leads_org_created_active
    ON public.leads (organization_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_leads_org_status_created_active
    ON public.leads (organization_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_leads_assignee_created_active
    ON public.leads (organization_id, assigned_to, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_deals_org_created_active
    ON public.deals (organization_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_deals_org_stage_status_created_active
    ON public.deals (organization_id, stage, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_deals_org_owner_created_active
    ON public.deals (organization_id, owner_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_activities_org_user_start
    ON public.activities (organization_id, user_id, start_at);

CREATE INDEX IF NOT EXISTS ix_activities_org_type_status_start
    ON public.activities (organization_id, type, status, start_at);
