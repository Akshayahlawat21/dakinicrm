-- Automatic Dakini call-log polling and Layer 5 retry state.
-- Safe to run after 20261116_010_dakini_calling.sql.

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
