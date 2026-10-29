-- ============================================================================
-- MIGRATION: 20261028_003_duplicate_detection_hardening.sql
-- Description: Duplicate Detection & Data Integrity Hardening:
--              1. Concurrency-safe unique partial index on contacts(account_id, lower(email))
--              2. Performance indexes on leads(lower(email)) and deals(account_id, status)
-- ============================================================================

-- 1. Unique index on active contacts per account by normalized email
-- Guarantees that concurrent conversion or contact creation cannot create duplicate contacts
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_account_email_active 
ON public.contacts (account_id, LOWER(TRIM(email))) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

-- 2. Index on active leads by normalized email for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_lower_email 
ON public.leads (LOWER(TRIM(email))) 
WHERE deleted_at IS NULL AND email IS NOT NULL;

-- 3. Composite index on active deals for rapid duplicate opportunity lookup
CREATE INDEX IF NOT EXISTS idx_deals_active_account_status 
ON public.deals (account_id, status, stage) 
WHERE deleted_at IS NULL;
