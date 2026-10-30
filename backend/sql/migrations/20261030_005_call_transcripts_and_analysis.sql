-- Migration: 20261030_005_call_transcripts_and_analysis.sql
-- Description: Adds call transcripts, call analysis, and activities lead extension with RBAC indexes

-- 1. Extend activities table to support unconverted Leads and explicit call duration
ALTER TABLE IF EXISTS activities
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS activities
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_org_user_start ON activities(organization_id, user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_org_lead_start ON activities(organization_id, lead_id, start_at DESC);

-- 2. Call Transcripts Table (1:1 with Call Activity)
CREATE TABLE IF NOT EXISTS call_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    external_call_id VARCHAR(100) NULL,
    raw_text TEXT NOT NULL,
    diarization JSONB DEFAULT '[]'::jsonb,
    recording_url VARCHAR(500) NULL,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_call_transcripts_activity UNIQUE (activity_id)
);

CREATE INDEX IF NOT EXISTS idx_transcripts_org ON call_transcripts(organization_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_activity ON call_transcripts(activity_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_org_activity ON call_transcripts(organization_id, activity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_org_ext_call 
    ON call_transcripts(organization_id, external_call_id) 
    WHERE external_call_id IS NOT NULL;

-- 3. Call Analysis Table (1:N with Transcript to support versioning / re-analysis)
CREATE TABLE IF NOT EXISTS call_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
    transcript_id UUID REFERENCES call_transcripts(id) ON DELETE CASCADE,
    external_call_id VARCHAR(100) NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    analyzed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sentiment VARCHAR(20) DEFAULT 'neutral',
    call_outcome VARCHAR(50) NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    improvements JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT NULL,
    model_version VARCHAR(50) NULL,
    analyzed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure missing columns are added if call_analysis table already exists
ALTER TABLE IF EXISTS call_analysis
ADD COLUMN IF NOT EXISTS transcript_id UUID REFERENCES call_transcripts(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS call_analysis
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'neutral';

ALTER TABLE IF EXISTS call_analysis
ADD COLUMN IF NOT EXISTS call_outcome VARCHAR(50) NULL;

-- Indexes for Call Analysis with RBAC and filtering performance
CREATE INDEX IF NOT EXISTS idx_call_analysis_org ON call_analysis(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_activity ON call_analysis(activity_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_transcript ON call_analysis(transcript_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_lead ON call_analysis(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_analysis_analyzed_by ON call_analysis(analyzed_by);
CREATE INDEX IF NOT EXISTS idx_call_analysis_status ON call_analysis(status);
CREATE INDEX IF NOT EXISTS idx_call_analysis_sentiment ON call_analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_call_analysis_call_outcome ON call_analysis(call_outcome);
CREATE INDEX IF NOT EXISTS idx_call_analysis_org_lead_created ON call_analysis(organization_id, lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_analysis_org_analyzed_created ON call_analysis(organization_id, analyzed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_analysis_org_transcript_created ON call_analysis(organization_id, transcript_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_analysis_org_status_created ON call_analysis(organization_id, status, created_at DESC);

-- GIN indexes for JSON searching
CREATE INDEX IF NOT EXISTS idx_call_analysis_summary_gin ON call_analysis USING GIN (summary);
CREATE INDEX IF NOT EXISTS idx_call_analysis_improvements_gin ON call_analysis USING GIN (improvements);
