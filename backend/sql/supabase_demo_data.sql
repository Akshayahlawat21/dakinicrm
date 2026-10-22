-- ============================================================================
-- DAKINI SALES CRM — COMPLETE SUPABASE DEMO & SEED DATA
-- Compatible with: PostgreSQL 14+, 15+, 16+ & Supabase SQL Editor
-- Schema Reference: backend/sql/schema.sql
-- Default Tenant: tenant_enterprise_01 (UUID: b4b76cde-a5e0-5ffb-9670-2df601cd5eef)
-- Default User: Elena Rostova (UUID: e7e81b6a-d30e-5270-87f1-260879092306)
-- ============================================================================

-- Ensure pgcrypto extension is active for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SCHEMA REPAIR & AUTO-MIGRATION (Fixes pre-existing tables in Supabase)
-- Ensures all columns (like manager_id, role_name, etc.) exist even if 
-- tables were created previously with an older version of schema.sql.
-- ============================================================================
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role_name VARCHAR(50) NOT NULL DEFAULT 'salesperson';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255) NULL;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS deals ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS deals ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE IF EXISTS deals ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'Qualified';
ALTER TABLE IF EXISTS deals ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS accounts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium';
ALTER TABLE IF EXISTS activities ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'scheduled';

ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS period_type VARCHAR(20) NOT NULL DEFAULT 'monthly';
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS period_start DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS period_end DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS target_amount DECIMAL(14, 2) NOT NULL DEFAULT 1000.00;
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS sales_targets ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$ 
BEGIN 
    -- If sales_targets has user_id instead of assigned_to_user_id, sync the values:
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_targets' AND column_name = 'user_id'
    ) THEN 
        UPDATE sales_targets SET assigned_to_user_id = user_id WHERE assigned_to_user_id IS NULL;
    END IF;
END $$;

ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'discovery';
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS probability INTEGER NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS expected_close_date DATE;
ALTER TABLE IF EXISTS opportunities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS sku VARCHAR(50);
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS due_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';

ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'wire_transfer';
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed';

ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NOT NULL DEFAULT 'other';
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_url VARCHAR(255);
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;


-- ============================================================================
-- 1. ORGANIZATIONS (Multi-Tenant Isolation)
-- ============================================================================
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES 
    ('b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Dakini Enterprise', 'dakini-enterprise', NOW(), NOW()),
    ('4022dbcc-6f17-5e95-b58d-1814573bdb1a', 'Acme Corporation', 'acme-corp', NOW(), NOW()),
    ('4c9c5249-b20a-52d2-b7f4-7f4bedee8773', 'Beta Logistics Global', 'beta-logistics', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug;

-- ============================================================================
-- 2. ROLES (RBAC Hierarchy)
-- ============================================================================
INSERT INTO roles (id, organization_id, name, description)
VALUES
    ('11111111-1111-1111-1111-111111110001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'owner', 'Executive Director & System Administrator with full organization authority'),
    ('11111111-1111-1111-1111-111111110002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'manager', 'Sales Manager with team oversight, target assignment, and approvals'),
    ('11111111-1111-1111-1111-111111110003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'salesperson', 'Field Sales Representative handling assigned leads, pipeline deals, and customer touchpoints')
ON CONFLICT (organization_id, name) DO NOTHING;

-- ============================================================================
-- 3. PERMISSIONS
-- ============================================================================
INSERT INTO permissions (id, resource, action)
VALUES
    ('22222222-2222-2222-2222-222222220001', 'leads', 'create'),
    ('22222222-2222-2222-2222-222222220002', 'leads', 'read'),
    ('22222222-2222-2222-2222-222222220003', 'leads', 'update'),
    ('22222222-2222-2222-2222-222222220004', 'leads', 'delete'),
    ('22222222-2222-2222-2222-222222220005', 'deals', 'create'),
    ('22222222-2222-2222-2222-222222220006', 'deals', 'read'),
    ('22222222-2222-2222-2222-222222220007', 'deals', 'update'),
    ('22222222-2222-2222-2222-222222220008', 'deals', 'delete'),
    ('22222222-2222-2222-2222-222222220009', 'users', 'manage'),
    ('22222222-2222-2222-2222-222222220010', 'sales_targets', 'assign')
ON CONFLICT (resource, action) DO NOTHING;

-- ============================================================================
-- 4. USERS (Matches Gateway claims and Frontend context)
-- ============================================================================
-- Note: e7e81b6a-d30e-5270-87f1-260879092306 matches 'usr_elena.rostova' & 'elena.rostova@dakini.ai'
INSERT INTO users (id, organization_id, role_id, manager_id, role_name, hashed_password, name, email, status)
VALUES
    -- 1. Elena Rostova (Owner / Sales Director)
    ('e7e81b6a-d30e-5270-87f1-260879092306', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '11111111-1111-1111-1111-111111110001', NULL, 'owner', '$2b$12$eD...mockpasswordhash', 'Elena Rostova', 'elena.rostova@dakini.ai', 'active'),
    -- 2. Marcus Vance (Sales Manager)
    ('33333333-3333-3333-3333-333333330002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '11111111-1111-1111-1111-111111110002', 'e7e81b6a-d30e-5270-87f1-260879092306', 'manager', '$2b$12$eD...mockpasswordhash', 'Marcus Vance', 'marcus.vance@dakini.ai', 'active'),
    -- 3. Dev Singhania (Senior Salesperson)
    ('33333333-3333-3333-3333-333333330003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '11111111-1111-1111-1111-111111110003', '33333333-3333-3333-3333-333333330002', 'salesperson', '$2b$12$eD...mockpasswordhash', 'Dev Singhania', 'dev.singhania@dakini.ai', 'active'),
    -- 4. Asha Nair (Sales Representative)
    ('33333333-3333-3333-3333-333333330004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '11111111-1111-1111-1111-111111110003', '33333333-3333-3333-3333-333333330002', 'salesperson', '$2b$12$eD...mockpasswordhash', 'Asha Nair', 'asha.nair@dakini.ai', 'active'),
    -- 5. Tenant 2 User (Demonstrates isolation)
    ('33333333-3333-3333-3333-333333330005', '4022dbcc-6f17-5e95-b58d-1814573bdb1a', NULL, NULL, 'salesperson', '$2b$12$eD...mockpasswordhash', 'David Kim', 'david.kim@acme.corp', 'active')
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role_name = EXCLUDED.role_name,
    status = EXCLUDED.status;

-- ============================================================================
-- 5. TEAMS & TEAM MEMBERS
-- ============================================================================
INSERT INTO teams (id, organization_id, name, description)
VALUES
    ('44444444-4444-4444-4444-444444440001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Enterprise Logistics Squad', 'High-velocity tier-1 logistics and telematics accounts'),
    ('44444444-4444-4444-4444-444444440002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'FinTech & Growth Squad', 'High-growth fintech automation and compliance deals')
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_members (id, team_id, user_id, is_active)
VALUES
    ('44444444-4444-4444-4444-444444440011', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330002', TRUE), -- Marcus (Manager)
    ('44444444-4444-4444-4444-444444440012', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330003', TRUE), -- Dev
    ('44444444-4444-4444-4444-444444440013', '44444444-4444-4444-4444-444444440001', '33333333-3333-3333-3333-333333330004', TRUE)  -- Asha
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ============================================================================
-- 6. CAMPAIGNS
-- ============================================================================
INSERT INTO campaigns (id, organization_id, name, type, status, start_date, end_date, budget)
VALUES
    ('55555555-5555-5555-5555-555555550001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Q4 Enterprise Logistics Roadshow', 'Roadshow & In-Person', 'active', '2026-10-01', '2026-12-31', 25000.00),
    ('55555555-5555-5555-5555-555555550002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Autonomous Sales Agents Webinar Series', 'Webinar', 'completed', '2026-09-01', '2026-09-30', 12000.00),
    ('55555555-5555-5555-5555-555555550003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'FinTech Omnichannel Inbound 2026', 'Digital Ads', 'active', '2026-10-15', '2026-11-30', 18000.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. LEADS & SIGNALS (With Autonomous AI Telemetry Scores)
-- ============================================================================
INSERT INTO leads (id, organization_id, assigned_to, campaign_id, source, status, name, email, phone, industry, score)
VALUES
    -- Aarav Patel (Score 128, Converted)
    ('66666666-6666-6666-6666-666666660001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330002', '55555555-5555-5555-5555-555555550001', 'Website Demo', 'Converted', 'Aarav Patel', 'aarav@swiggydelivery.in', '+91 97112 33445', 'Logistics', 128),
    -- Priya Sharma (Score 86, New)
    ('66666666-6666-6666-6666-666666660002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330004', '55555555-5555-5555-5555-555555550002', 'Partner Referral', 'New', 'Priya Sharma', 'priya@acme.io', '+1 (555) 234-8901', 'Manufacturing', 86),
    -- Rahul Khanna (Score 64, Contacted)
    ('66666666-6666-6666-6666-666666660003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330003', '55555555-5555-5555-5555-555555550002', 'Webinar', 'Contacted', 'Rahul Khanna', 'rahul@zenith.com', '+91 98104 77211', 'Financial Services', 64),
    -- Ananya Roy (Score 95, Qualified)
    ('66666666-6666-6666-6666-666666660004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'e7e81b6a-d30e-5270-87f1-260879092306', '55555555-5555-5555-5555-555555550001', 'Organic Search', 'Qualified', 'Ananya Roy', 'ananya.roy@nexuscoldchain.com', '+91 99887 66554', 'Supply Chain', 95),
    -- Vikram Malhotra (Score 110, Negotiation)
    ('66666666-6666-6666-6666-666666660005', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330002', '55555555-5555-5555-5555-555555550003', 'Outbound Campaign', 'Negotiation', 'Vikram Malhotra', 'vikram@bharattelematics.org', '+91 91234 56789', 'Logistics', 110)
ON CONFLICT (id) DO NOTHING;

-- Signals powering Dakini Autonomous Lead AI
INSERT INTO lead_signals (id, lead_id, signal_type, signal_value, score, source, occurred_at)
VALUES
    ('66666666-6666-6666-6666-666666660101', '66666666-6666-6666-6666-666666660001', 'form_submit', 'Website Demo Request with 500+ fleet size', 95, 'dakini-web', NOW() - INTERVAL '2 days'),
    ('66666666-6666-6666-6666-666666660102', '66666666-6666-6666-6666-666666660001', 'email_click', 'Clicked Enterprise Pricing Calculator', 33, 'sendgrid', NOW() - INTERVAL '1 day'),
    ('66666666-6666-6666-6666-666666660103', '66666666-6666-6666-6666-666666660002', 'deck_open', 'Opened Q4 Enterprise Capability Deck', 60, 'clearbit', NOW() - INTERVAL '3 hours'),
    ('66666666-6666-6666-6666-666666660104', '66666666-6666-6666-6666-666666660002', 'call_connected', 'Discovery call completed (14 minutes)', 26, 'zoom', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. ACCOUNTS & CONTACTS
-- ============================================================================
INSERT INTO accounts (id, organization_id, name, industry, website, phone, address, status)
VALUES
    ('77777777-7777-7777-7777-777777770001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Aarav Patel Enterprises', 'Logistics', 'https://swiggydelivery.in', '+91 97112 33445', 'Indiranagar, Bangalore, Karnataka, India', 'active'),
    ('77777777-7777-7777-7777-777777770002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Acme Corp', 'Manufacturing', 'https://acme.io', '+1 (555) 234-8901', '742 Evergreen Terrace, Springfield, IL, USA', 'active'),
    ('77777777-7777-7777-7777-777777770003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Zenith Dynamics', 'Financial Services', 'https://zenith.com', '+91 98104 77211', 'Nariman Point, Mumbai, Maharashtra, India', 'active'),
    ('77777777-7777-7777-7777-777777770004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'TVS Mobility Solutions', 'Automotive Logistics', 'https://tvsmobility.com', '+91 44 2827 2233', 'Mount Road, Chennai, Tamil Nadu, India', 'active'),
    ('77777777-7777-7777-7777-777777770005', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Skyline Logistics Corp', 'Logistics', 'https://skylinelogistics.com', '+1 (555) 444-9988', 'Dallas Logistics Hub, TX, USA', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO contacts (id, account_id, first_name, last_name, email, phone, title, department)
VALUES
    ('77777777-7777-7777-7777-777777770011', '77777777-7777-7777-7777-777777770001', 'Aarav', 'Patel', 'aarav@swiggydelivery.in', '+91 97112 33445', 'Head of Logistics & Supply Operations', 'Operations'),
    ('77777777-7777-7777-7777-777777770012', '77777777-7777-7777-7777-777777770002', 'Priya', 'Sharma', 'priya@acme.io', '+1 (555) 234-8901', 'VP of Enterprise Supply Chain', 'Supply Chain'),
    ('77777777-7777-7777-7777-777777770013', '77777777-7777-7777-7777-777777770003', 'Rahul', 'Khanna', 'rahul@zenith.com', '+91 98104 77211', 'Chief Technology Officer', 'Engineering'),
    ('77777777-7777-7777-7777-777777770014', '77777777-7777-7777-7777-777777770004', 'Rajesh', 'Venkatesh', 'rajesh.v@tvsmobility.com', '+91 44 2827 5566', 'Director of Digital Fleet Operations', 'Procurement'),
    ('77777777-7777-7777-7777-777777770015', '77777777-7777-7777-7777-777777770005', 'Amanda', 'Clark', 'amanda.clark@skylinelogistics.com', '+1 (555) 444-9911', 'Chief Operating Officer', 'Executive')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. SALES TARGETS (Q4 Quota Allocation)
-- ============================================================================
INSERT INTO sales_targets (id, organization_id, assigned_to_user_id, assigned_by_user_id, team_id, period_type, period_start, period_end, target_amount, currency, status, notes)
VALUES
    ('88888888-8888-8888-8888-888888880001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330002', 'e7e81b6a-d30e-5270-87f1-260879092306', '44444444-4444-4444-4444-444444440001', 'quarterly', '2026-10-01', '2026-12-31', 250000.00, 'USD', 'active', 'Q4 Enterprise expansion quota for Team Logistics'),
    ('88888888-8888-8888-8888-888888880002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330003', '33333333-3333-3333-3333-333333330002', '44444444-4444-4444-4444-444444440001', 'quarterly', '2026-10-01', '2026-12-31', 120000.00, 'USD', 'active', 'Individual quota for Dev Singhania - FinTech focus'),
    ('88888888-8888-8888-8888-888888880003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330004', '33333333-3333-3333-3333-333333330002', '44444444-4444-4444-4444-444444440001', 'quarterly', '2026-10-01', '2026-12-31', 100000.00, 'USD', 'active', 'Individual quota for Asha Nair - Mid-Market Supply Chain')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. PRODUCTS & CATALOG
-- ============================================================================
INSERT INTO products (id, organization_id, name, sku, category, description, price, currency, is_active)
VALUES
    ('99999999-9999-9999-9999-999999990001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Dakini AI Sales Platform — Enterprise Core', 'DAK-CORE-ENT', 'Software License', 'Annual subscription for full enterprise autonomous sales intelligence and CRM orchestration.', 25000.00, 'USD', TRUE),
    ('99999999-9999-9999-9999-999999990002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Fleet Telematics Real-Time AI Connector', 'DAK-TELE-01', 'Add-on Module', 'Real-time telemetry ingestion pipeline for IoT logistics and dispatch routing.', 15000.00, 'USD', TRUE),
    ('99999999-9999-9999-9999-999999990003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Autonomous Lead Scoring & Enrichment Engine', 'DAK-LEAD-AI', 'AI Copilot', 'Automated ICP enrichment, real-time website signal capture, and predictive deal ranking.', 10000.00, 'USD', TRUE),
    ('99999999-9999-9999-9999-999999990004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'Enterprise Dedicated Multi-Region Security Pack', 'DAK-SEC-01', 'Infrastructure', 'Single-tenant data residency, SOC2 compliance vault, and custom KMS encryption.', 20000.00, 'USD', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 11. OPPORTUNITIES & DEALS (Kanban Pipeline)
-- ============================================================================
INSERT INTO opportunities (id, organization_id, account_id, contact_id, owner_id, name, amount, stage, probability, expected_close_date)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770001', '77777777-7777-7777-7777-777777770011', '33333333-3333-3333-3333-333333330002', 'Aarav Patel Route Optimization AI', 60000.00, 'proposal', 75, '2026-11-30'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770002', '77777777-7777-7777-7777-777777770012', '33333333-3333-3333-3333-333333330004', 'Acme Cloud Migration & CRM Co-Pilot', 85000.00, 'qualified', 50, '2026-12-15'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770003', '77777777-7777-7777-7777-777777770013', '33333333-3333-3333-3333-333333330003', 'Zenith Financial Pipeline Intelligence', 45000.00, 'discovery', 40, '2026-11-20'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770004', '77777777-7777-7777-7777-777777770014', 'e7e81b6a-d30e-5270-87f1-260879092306', 'TVS Fleet Telematics Enterprise Scope', 120000.00, 'negotiation', 85, '2026-11-15')
ON CONFLICT (id) DO NOTHING;

INSERT INTO deals (id, organization_id, account_id, opportunity_id, name, amount, currency, stage, close_date, status)
VALUES
    -- Deal 1: Aarav Patel (Proposal stage)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', 'Aarav Patel Enterprises — Route Optimization AI', 60000.00, 'USD', 'Proposal', '2026-11-30', 'open'),
    -- Deal 2: Acme Corp (Qualified stage)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', 'Acme Corp — Enterprise Cloud Migration & CRM Co-Pilot', 85000.00, 'USD', 'Qualified', '2026-12-15', 'open'),
    -- Deal 3: Zenith Dynamics (Discovery stage)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', 'Zenith Dynamics — Core Financial Automation', 45000.00, 'USD', 'Discovery', '2026-11-20', 'open'),
    -- Deal 4: TVS Mobility (Negotiation stage)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', 'TVS Mobility — National Telematics Rollout', 120000.00, 'USD', 'Negotiation', '2026-11-15', 'open'),
    -- Deal 5: Skyline Logistics (Won stage)
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0005', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770005', NULL, 'Skyline Logistics — Q3 Fleet Optimization Contract', 50000.00, 'USD', 'Won', '2026-10-01', 'won')
ON CONFLICT (id) DO NOTHING;

-- Link Products to Deals
INSERT INTO deal_products (id, deal_id, product_id, quantity, unit_price, discount)
VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0101', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001', '99999999-9999-9999-9999-999999990001', 1, 25000.00, 0.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0102', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001', '99999999-9999-9999-9999-999999990002', 1, 15000.00, 0.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0103', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001', '99999999-9999-9999-9999-999999990004', 1, 20000.00, 0.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0104', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004', '99999999-9999-9999-9999-999999990001', 2, 25000.00, 5.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0105', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004', '99999999-9999-9999-9999-999999990002', 3, 15000.00, 0.00),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0106', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004', '99999999-9999-9999-9999-999999990004', 1, 25000.00, 0.00)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 12. ACTIVITIES (Tasks, Meetings, Calls)
-- ============================================================================
INSERT INTO activities (id, organization_id, account_id, contact_id, opportunity_id, user_id, type, subject, description, start_at, end_at, timezone, location, status, priority)
VALUES
    -- Task 1: Security Quote for Rahul Khanna
    ('cccccccc-cccc-cccc-cccc-cccccccc0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770003', '77777777-7777-7777-7777-777777770013', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', '33333333-3333-3333-3333-333333330003', 'task', 'Call Rahul K. regarding security compliance quote', 'Provide custom KMS and SOC2 compliance architecture deck.', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '3 hours', 'UTC', 'Google Meet', 'scheduled', 'high'),
    -- Task 2: MSA Send to Aarav Patel
    ('cccccccc-cccc-cccc-cccc-cccccccc0002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770001', '77777777-7777-7777-7777-777777770011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', '33333333-3333-3333-3333-333333330002', 'task', 'Send final quote & Master Services Agreement to Aarav Patel', 'Finalize discount tier and attach signature pack via DocuSign.', NOW() - INTERVAL '1 hour', NOW(), 'UTC', 'DocuSign', 'completed', 'urgent'),
    -- Task 3: Procurement Review TVS Mobility
    ('cccccccc-cccc-cccc-cccc-cccccccc0003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770004', '77777777-7777-7777-7777-777777770014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004', 'e7e81b6a-d30e-5270-87f1-260879092306', 'task', 'Follow up with TVS Mobility on legal procurement review', 'Check whether data residency in AWS Mumbai region satisfies security team.', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 1 hour', 'UTC', 'Zoom', 'scheduled', 'high'),
    -- Meeting: Discovery with Priya Sharma
    ('cccccccc-cccc-cccc-cccc-cccccccc0004', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770002', '77777777-7777-7777-7777-777777770012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', '33333333-3333-3333-3333-333333330004', 'meeting', 'Executive Demo: Acme Enterprise Cloud Migration', 'Demonstrate AI lead prioritization and warehouse ERP synchronization.', NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 45 minutes', 'UTC', 'Microsoft Teams', 'scheduled', 'medium')
ON CONFLICT (id) DO NOTHING;

INSERT INTO activity_participants (id, activity_id, user_id, contact_id, response_status)
VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccc0101', 'cccccccc-cccc-cccc-cccc-cccccccc0001', '33333333-3333-3333-3333-333333330003', '77777777-7777-7777-7777-777777770013', 'accepted'),
    ('cccccccc-cccc-cccc-cccc-cccccccc0102', 'cccccccc-cccc-cccc-cccc-cccccccc0004', '33333333-3333-3333-3333-333333330004', '77777777-7777-7777-7777-777777770012', 'accepted')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 13. NOTES (Contextual Intelligence)
-- ============================================================================
INSERT INTO notes (id, organization_id, user_id, related_to_type, related_to_id, content)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddd0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330002', 'lead', '66666666-6666-6666-6666-666666660001', 'Aarav requested a live demo for freight telematics and route optimization. Fleet size is 520 delivery vehicles across south region.'),
    ('dddddddd-dddd-dddd-dddd-dddddddd0002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330004', 'account', '77777777-7777-7777-7777-777777770002', 'Acme Corp is transitioning off legacy Salesforce deployment. Priority requirement is autonomous AI lead scoring co-pilot and native SAP connector.'),
    ('dddddddd-dddd-dddd-dddd-dddddddd0003', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'e7e81b6a-d30e-5270-87f1-260879092306', 'deal', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004', 'TVS Mobility security review in final sign-off. Confirmed telemetry logs will stay entirely within AWS ap-south-1 (Mumbai).')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 14. INVOICES & PAYMENTS (Billing)
-- ============================================================================
INSERT INTO invoices (id, organization_id, account_id, deal_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total_amount, currency, status)
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0005', 'INV-2026-001', '2026-10-01', '2026-10-31', 50000.00, 0.00, 50000.00, 'USD', 'paid'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeee0002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '77777777-7777-7777-7777-777777770001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001', 'INV-2026-002', '2026-10-15', '2026-11-15', 30000.00, 0.00, 30000.00, 'USD', 'sent')
ON CONFLICT (invoice_number) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, discount, tax, subtotal, total)
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeee0101', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', '99999999-9999-9999-9999-999999990001', 'Dakini AI Sales Platform — Enterprise Core (Annual)', 1, 25000.00, 0.00, 0.00, 25000.00, 25000.00),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeee0102', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', '99999999-9999-9999-9999-999999990004', 'Enterprise Dedicated Multi-Region Security Pack', 1, 25000.00, 0.00, 0.00, 25000.00, 25000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, organization_id, invoice_id, amount, payment_method, transaction_id, payment_date, status)
VALUES
    ('ffffffff-ffff-ffff-ffff-ffffffff0001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', 50000.00, 'wire_transfer', 'WIRE_TRX_992837461', NOW() - INTERVAL '10 days', 'completed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 15. DOCUMENTS & ATTACHMENTS
-- ============================================================================
INSERT INTO documents (id, organization_id, uploaded_by, name, description, document_type, file_url, mime_type, file_size, storage_path, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'e7e81b6a-d30e-5270-87f1-260879092306', 'Dakini_AI_Enterprise_Security_Whitepaper.pdf', 'SOC2 Type II and ISO27001 compliance summary for enterprise security review', 'proposal', 'https://storage.dakini.ai/docs/security_whitepaper.pdf', 'application/pdf', 2450000, 's3://dakini-enterprise-vault/docs/security_whitepaper.pdf', 'active'),
    ('00000000-0000-0000-0000-000000000002', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', '33333333-3333-3333-3333-333333330002', 'Master_Services_Agreement_Aarav_Patel_v2.docx', 'Executed MSA and SLA annexure for Aarav Patel Enterprises route optimization rollout', 'contract', 'https://storage.dakini.ai/docs/msa_aarav_patel.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1120000, 's3://dakini-enterprise-vault/docs/msa_aarav_patel.docx', 'active')
ON CONFLICT (id) DO NOTHING;

-- Document Relations
INSERT INTO document_relations (id, document_id, related_to_type, related_to_id)
VALUES
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'account', '77777777-7777-7777-7777-777777770002'),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'deal', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 16. AUDIT LOG INITIALIZATION
-- ============================================================================
INSERT INTO audit_logs (id, organization_id, user_id, action, resource_type, resource_id, old_values, new_values, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000201', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', 'e7e81b6a-d30e-5270-87f1-260879092306', 'SEED_INIT', 'organization', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef', NULL, '{"seed_version": "1.0.0", "status": "completed"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Verification Query to check counts after execution
SELECT 
    (SELECT COUNT(*) FROM organizations) AS total_organizations,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM leads) AS total_leads,
    (SELECT COUNT(*) FROM accounts) AS total_accounts,
    (SELECT COUNT(*) FROM contacts) AS total_contacts,
    (SELECT COUNT(*) FROM deals) AS total_deals,
    (SELECT COUNT(*) FROM activities) AS total_activities,
    (SELECT COUNT(*) FROM sales_targets) AS total_sales_targets,
    (SELECT COUNT(*) FROM invoices) AS total_invoices;
