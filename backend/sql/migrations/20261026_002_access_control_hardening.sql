-- ============================================================================
-- MIGRATION: 20261026_002_access_control_hardening.sql
-- Description: Access Control Hardening:
--              1. Add explicit owner_id column & index to deals table.
--              2. Backfill deals.owner_id from linked opportunities.
--              3. Defense-in-depth Row Level Security (RLS) policies for direct access.
-- ============================================================================

-- 1. Explicit owner_id column on deals
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);

-- 2. Backfill existing deals with their opportunity owner_id
UPDATE public.deals d
SET owner_id = o.owner_id
FROM public.opportunities o
WHERE d.opportunity_id = o.id 
  AND d.owner_id IS NULL 
  AND o.owner_id IS NOT NULL;

-- 3. Row Level Security (RLS) Defense-in-Depth Policies
-- Ensure RLS is active on core CRM tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow trusted service role full access (FastAPI application backend & migrations)
DO $$
BEGIN
    -- LEADS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_leads') THEN
        CREATE POLICY service_role_all_leads ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- DEALS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_deals') THEN
        CREATE POLICY service_role_all_deals ON public.deals FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- ACCOUNTS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_accounts') THEN
        CREATE POLICY service_role_all_accounts ON public.accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- CONTACTS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_contacts') THEN
        CREATE POLICY service_role_all_contacts ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- ACTIVITIES policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_activities') THEN
        CREATE POLICY service_role_all_activities ON public.activities FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- SALES TARGETS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_sales_targets') THEN
        CREATE POLICY service_role_all_sales_targets ON public.sales_targets FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- USERS policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_users') THEN
        CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
