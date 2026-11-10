-- Migration: 20261106_006_lead_bulk_import.sql
-- Description: Adds lead_import_batches tracking table, links leads to batches, and adds deduplication indexes

-- 1. Create lead_import_batches tracking table
CREATE TABLE IF NOT EXISTS lead_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    error_log JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'processing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Extend leads table to link each lead back to its import batch
ALTER TABLE IF EXISTS leads
ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES lead_import_batches(id) ON DELETE SET NULL;

-- 3. Indexes for batch lookup & high-performance deduplication
CREATE INDEX IF NOT EXISTS idx_import_batches_org ON lead_import_batches(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_import_batch ON leads(import_batch_id);

-- Product-aware deduplication composite indexes
CREATE INDEX IF NOT EXISTS idx_leads_org_email_product ON leads(organization_id, LOWER(TRIM(email)), LOWER(TRIM(interested_product)))
WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_phone_product ON leads(organization_id, TRIM(phone), LOWER(TRIM(interested_product)))
WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- DOWN MIGRATION (ROLLBACK INSTRUCTIONS):
-- ALTER TABLE IF EXISTS leads DROP COLUMN IF EXISTS import_batch_id;
-- DROP TABLE IF EXISTS lead_import_batches CASCADE;
