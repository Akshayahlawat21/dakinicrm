-- Migration: 20261116_010_dakini_calling.sql
-- Description: Dakini AI Calling integration (external batches/calls persistence, call-log polling, and Layer 5 retry state)

-- 1. Dakini AI Calling integration: persist external batches/calls independently
-- of the existing LiveKit softphone and link every call to a CRM lead.
CREATE TABLE IF NOT EXISTS dakini_call_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dakini_batch_id VARCHAR(120) NOT NULL,
    agent_id VARCHAR(120) NOT NULL,
    telephony_number VARCHAR(24) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    total_contacts INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NULL,
    file_name VARCHAR(255) NULL,
    raw_response JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dakini_batch_org_external UNIQUE (organization_id, dakini_batch_id)
);
CREATE INDEX IF NOT EXISTS ix_dakini_batch_org_status ON dakini_call_batches (organization_id, status);

CREATE TABLE IF NOT EXISTS dakini_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    dakini_call_id VARCHAR(120) NULL,
    dakini_batch_id VARCHAR(120) NULL,
    agent_id VARCHAR(120) NOT NULL,
    phone_number VARCHAR(24) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'initiated',
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    transcript_id UUID REFERENCES call_transcripts(id) ON DELETE SET NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    recording_url VARCHAR(1000) NULL,
    synced_at TIMESTAMPTZ NULL,
    analyzed_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    raw_response JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dakini_call_org_external UNIQUE (organization_id, dakini_call_id)
);
CREATE INDEX IF NOT EXISTS ix_dakini_call_org_batch ON dakini_calls (organization_id, dakini_batch_id);
CREATE INDEX IF NOT EXISTS ix_dakini_call_org_lead ON dakini_calls (organization_id, lead_id);
CREATE INDEX IF NOT EXISTS ix_dakini_call_org_status ON dakini_calls (organization_id, status);

-- 2. Automatic Dakini call-log polling and Layer 5 retry state.
ALTER TABLE dakini_call_batches
ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ NULL;

ALTER TABLE dakini_calls
ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS analysis_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS analysis_last_attempt_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS ix_dakini_calls_pending_poll
ON dakini_calls (organization_id, agent_id, created_at)
WHERE transcript_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_dakini_calls_pending_analysis
ON dakini_calls (organization_id, analysis_last_attempt_at, created_at)
WHERE transcript_id IS NOT NULL AND analyzed_at IS NULL;

