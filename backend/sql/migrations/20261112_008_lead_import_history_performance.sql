-- Optimizes role-scoped lead import history lookups for managers and salespeople.
-- Safe to re-run; existing tenant-wide index remains useful for owner queries.
CREATE INDEX IF NOT EXISTS idx_import_batches_org_user_created
    ON lead_import_batches (organization_id, user_id, created_at DESC);
