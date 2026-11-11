-- Migration: 20261110_007_custom_pipelines_and_stages.sql
-- Sprint Tasks: CRM-BE-03 / CRM-BE-04 / CRM-BE-05 (Dynamic Pipelines, Per-User Custom Columns & Safe Reassignment)
-- Description: Creates pipelines, pipeline_stages, and user_deal_columns tables; extends deals with pipeline_id & stage_id; seeds default stages and backfills deals.

-- 1. Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_pipelines_org
    ON pipelines(organization_id) WHERE deleted_at IS NULL;

-- 2. Create pipeline_stages table (supports both shared 'org' stages & per-user 'personal' columns)
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL DEFAULT 'org',
    parent_stage_id UUID NULL REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    parent_base_stage VARCHAR(50) NULL,
    name VARCHAR(100) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 1000,
    color VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
    win_probability INTEGER NOT NULL DEFAULT 50,
    qualification_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_lookup
    ON pipeline_stages(organization_id, pipeline_id, scope, user_id, order_index)
    WHERE deleted_at IS NULL;

-- 3. Create user_deal_columns table (per-user custom column placement mapping)
CREATE TABLE IF NOT EXISTS user_deal_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_deal_column UNIQUE (user_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_user_deal_cols_user
    ON user_deal_columns(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_deal_cols_stage
    ON user_deal_columns(stage_id);

-- 4. Extend deals table with additive nullable pipeline_id & stage_id + composite index
ALTER TABLE IF EXISTS deals
    ADD COLUMN IF NOT EXISTS pipeline_id UUID NULL REFERENCES pipelines(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS deals
    ADD COLUMN IF NOT EXISTS stage_id UUID NULL REFERENCES pipeline_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_org_pipeline_stage
    ON deals(organization_id, pipeline_id, stage_id)
    WHERE deleted_at IS NULL;

-- 5. Seed default pipeline + 5 canonical stages per existing organization & backfill existing deals
DO $$
DECLARE
    org_rec RECORD;
    def_pipe_id UUID;
    stg_qual_id UUID;
    stg_prop_id UUID;
    stg_nego_id UUID;
    stg_won_id UUID;
    stg_lost_id UUID;
BEGIN
    FOR org_rec IN SELECT id FROM organizations LOOP
        SELECT id INTO def_pipe_id
        FROM pipelines
        WHERE organization_id = org_rec.id AND is_default = TRUE AND deleted_at IS NULL
        LIMIT 1;

        IF def_pipe_id IS NULL THEN
            INSERT INTO pipelines (organization_id, name, description, is_default, status)
            VALUES (org_rec.id, 'Sales Pipeline', 'Default organization sales pipeline', TRUE, 'active')
            RETURNING id INTO def_pipe_id;
        END IF;

        -- Seed Qualified (order_index 1000)
        SELECT id INTO stg_qual_id FROM pipeline_stages
        WHERE pipeline_id = def_pipe_id AND scope = 'org' AND LOWER(name) = 'qualified' AND deleted_at IS NULL LIMIT 1;
        IF stg_qual_id IS NULL THEN
            INSERT INTO pipeline_stages (pipeline_id, organization_id, user_id, scope, parent_base_stage, name, order_index, color, win_probability, qualification_tags, is_system, is_won, is_lost)
            VALUES (def_pipe_id, org_rec.id, NULL, 'org', 'Qualified', 'Qualified', 1000, '#3b82f6', 50, '["high qualified"]'::jsonb, TRUE, FALSE, FALSE)
            RETURNING id INTO stg_qual_id;
        END IF;

        -- Seed Proposal (order_index 2000)
        SELECT id INTO stg_prop_id FROM pipeline_stages
        WHERE pipeline_id = def_pipe_id AND scope = 'org' AND LOWER(name) = 'proposal' AND deleted_at IS NULL LIMIT 1;
        IF stg_prop_id IS NULL THEN
            INSERT INTO pipeline_stages (pipeline_id, organization_id, user_id, scope, parent_base_stage, name, order_index, color, win_probability, qualification_tags, is_system, is_won, is_lost)
            VALUES (def_pipe_id, org_rec.id, NULL, 'org', 'Proposal', 'Proposal', 2000, '#8b5cf6', 75, '[]'::jsonb, TRUE, FALSE, FALSE)
            RETURNING id INTO stg_prop_id;
        END IF;

        -- Seed Negotiation (order_index 3000)
        SELECT id INTO stg_nego_id FROM pipeline_stages
        WHERE pipeline_id = def_pipe_id AND scope = 'org' AND LOWER(name) = 'negotiation' AND deleted_at IS NULL LIMIT 1;
        IF stg_nego_id IS NULL THEN
            INSERT INTO pipeline_stages (pipeline_id, organization_id, user_id, scope, parent_base_stage, name, order_index, color, win_probability, qualification_tags, is_system, is_won, is_lost)
            VALUES (def_pipe_id, org_rec.id, NULL, 'org', 'Negotiation', 'Negotiation', 3000, '#f59e0b', 85, '[]'::jsonb, TRUE, FALSE, FALSE)
            RETURNING id INTO stg_nego_id;
        END IF;

        -- Seed Won (order_index 4000)
        SELECT id INTO stg_won_id FROM pipeline_stages
        WHERE pipeline_id = def_pipe_id AND scope = 'org' AND LOWER(name) = 'won' AND deleted_at IS NULL LIMIT 1;
        IF stg_won_id IS NULL THEN
            INSERT INTO pipeline_stages (pipeline_id, organization_id, user_id, scope, parent_base_stage, name, order_index, color, win_probability, qualification_tags, is_system, is_won, is_lost)
            VALUES (def_pipe_id, org_rec.id, NULL, 'org', 'Won', 'Won', 4000, '#10b981', 100, '[]'::jsonb, TRUE, TRUE, FALSE)
            RETURNING id INTO stg_won_id;
        END IF;

        -- Seed Lost (order_index 5000)
        SELECT id INTO stg_lost_id FROM pipeline_stages
        WHERE pipeline_id = def_pipe_id AND scope = 'org' AND LOWER(name) = 'lost' AND deleted_at IS NULL LIMIT 1;
        IF stg_lost_id IS NULL THEN
            INSERT INTO pipeline_stages (pipeline_id, organization_id, user_id, scope, parent_base_stage, name, order_index, color, win_probability, qualification_tags, is_system, is_won, is_lost)
            VALUES (def_pipe_id, org_rec.id, NULL, 'org', 'Lost', 'Lost', 5000, '#ef4444', 0, '[]'::jsonb, TRUE, FALSE, TRUE)
            RETURNING id INTO stg_lost_id;
        END IF;

        -- Backfill existing deals for this org
        UPDATE deals
        SET
            pipeline_id = def_pipe_id,
            stage_id = CASE
                WHEN LOWER(TRIM(stage)) IN ('proposal') THEN stg_prop_id
                WHEN LOWER(TRIM(stage)) IN ('negotiation') THEN stg_nego_id
                WHEN LOWER(TRIM(stage)) IN ('won', 'closed won', 'closed_won') THEN stg_won_id
                WHEN LOWER(TRIM(stage)) IN ('lost', 'closed lost', 'closed_lost') THEN stg_lost_id
                ELSE stg_qual_id
            END
        WHERE organization_id = org_rec.id
          AND (pipeline_id IS NULL OR stage_id IS NULL);
    END LOOP;
END $$;

-- DOWN MIGRATION (ROLLBACK INSTRUCTIONS):
-- DROP INDEX IF EXISTS idx_deals_org_pipeline_stage;
-- ALTER TABLE IF EXISTS deals DROP COLUMN IF EXISTS stage_id;
-- ALTER TABLE IF EXISTS deals DROP COLUMN IF EXISTS pipeline_id;
-- DROP TABLE IF EXISTS user_deal_columns CASCADE;
-- DROP TABLE IF EXISTS pipeline_stages CASCADE;
-- DROP TABLE IF EXISTS pipelines CASCADE;