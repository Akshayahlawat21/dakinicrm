-- ============================================================================
-- MIGRATION: 20261026_001_team_and_roles_schema.sql
-- Description: Staged, idempotent migration for Team & Roles, Case-Insensitive
--              login_id backfill with collision resolution, and token revocation.
-- ============================================================================

-- ============================================================================
-- STAGE 0: Preflight Inspection & Collision Report Query (Read-Only)
-- Run this query to audit candidate collisions before executing Stage 1 & 2.
-- ============================================================================
-- WITH sanitized_candidates AS (
--     SELECT 
--         id,
--         organization_id,
--         login_id AS current_login_id,
--         email,
--         CASE 
--             WHEN login_id IS NOT NULL AND TRIM(login_id) <> '' THEN LOWER(TRIM(login_id))
--             ELSE 
--                 COALESCE(
--                     NULLIF(LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_.-]', '', 'g')), ''),
--                     'user_' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)
--                 )
--         END AS candidate_base
--     FROM users
-- ),
-- collision_check AS (
--     SELECT 
--         organization_id,
--         candidate_base,
--         COUNT(*) as duplicate_count,
--         ARRAY_AGG(id) as affected_user_ids,
--         ARRAY_AGG(email) as affected_emails
--     FROM sanitized_candidates
--     GROUP BY organization_id, candidate_base
--     HAVING COUNT(*) > 1
-- )
-- SELECT * FROM collision_check;

-- ============================================================================
-- STAGE 1: Schema Expansion (Non-Destructive DDL)
-- ============================================================================
BEGIN;

-- 1. Add columns to users (nullable / default values prevent lock contention)
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

-- 2. Add columns to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Composite unique constraint on users for cross-tenant FK enforcement
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_org_id'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_org_id UNIQUE (organization_id, id);
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- STAGE 2: Deterministic Data Backfill with Collision Resolution
-- ============================================================================
BEGIN;

-- 1. Case-normalize any existing non-null login_ids
UPDATE users 
SET login_id = LOWER(TRIM(login_id)) 
WHERE login_id IS NOT NULL AND login_id <> LOWER(TRIM(login_id));

-- 2. Backfill login_ids deterministically:
-- Existing login_ids take absolute priority; NULL rows receive sequential suffixes if colliding.
WITH taken_existing AS (
    SELECT organization_id, LOWER(TRIM(login_id)) as taken_login
    FROM users 
    WHERE login_id IS NOT NULL
),
candidate_users AS (
    SELECT 
        id,
        organization_id,
        COALESCE(
            NULLIF(LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-z0-9_.-]', '', 'g')), ''),
            'user_' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)
        ) AS base_candidate,
        created_at
    FROM users
    WHERE login_id IS NULL
),
ranked_candidates AS (
    SELECT 
        c.id,
        c.organization_id,
        c.base_candidate,
        ROW_NUMBER() OVER (
            PARTITION BY c.organization_id, c.base_candidate 
            ORDER BY c.created_at ASC, c.id ASC
        ) as internal_rank,
        EXISTS (
            SELECT 1 FROM taken_existing te 
            WHERE te.organization_id = c.organization_id AND te.taken_login = c.base_candidate
        ) as base_is_taken
    FROM candidate_users c
)
UPDATE users u
SET login_id = CASE 
    WHEN r.internal_rank = 1 AND NOT r.base_is_taken THEN r.base_candidate
    WHEN r.internal_rank = 1 AND r.base_is_taken THEN r.base_candidate || '_2'
    ELSE r.base_candidate || '_' || (r.internal_rank + CASE WHEN r.base_is_taken THEN 1 ELSE 0 END)
END
FROM ranked_candidates r
WHERE u.id = r.id;

-- 3. Safe backfill of teams.manager_id from existing team_members where user role is manager
UPDATE teams t
SET manager_id = tm.user_id
FROM team_members tm
JOIN users u ON u.id = tm.user_id
WHERE tm.team_id = t.id 
  AND tm.is_active = TRUE 
  AND u.role_name = 'manager'
  AND t.manager_id IS NULL;

COMMIT;

-- ============================================================================
-- STAGE 3: Validation & Constraint Enforcement (Contract Phase)
-- ============================================================================
BEGIN;

-- 1. Explicit validation: verify zero NULL login_ids exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE login_id IS NULL OR TRIM(login_id) = '') THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found NULL or empty login_id after backfill.';
    END IF;
END $$;

-- 2. Explicit validation: verify zero case-insensitive duplicates exist per organization
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users 
        GROUP BY organization_id, LOWER(login_id) 
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Duplicate case-normalized login_ids detected.';
    END IF;
END $$;

-- 3. Set NOT NULL
ALTER TABLE users ALTER COLUMN login_id SET NOT NULL;

-- 4. Create Unique Index for Case-Insensitive Login IDs per Org
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_org_lower_login_id 
ON users (organization_id, LOWER(login_id));

-- 5. Create Partial Unique Index: At most 1 active team per Manager
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_active_manager 
ON teams (organization_id, manager_id) 
WHERE status = 'active' AND manager_id IS NOT NULL;

-- 6. Create Partial Unique Index: At most 1 active team per Salesperson
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_active_user 
ON team_members (user_id) 
WHERE is_active = TRUE;

-- 7. Add Composite Foreign Key: Guarantees team manager belongs to the same organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_teams_org_manager'
    ) THEN
        ALTER TABLE teams 
        ADD CONSTRAINT fk_teams_org_manager 
        FOREIGN KEY (organization_id, manager_id) 
        REFERENCES users(organization_id, id) 
        ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
