# Dakini CRM lead-summary PostgreSQL hotfix

## Root cause

`get_leads_summary` previously selected `COALESCE(Lead.source, 'Direct / Referral')` and grouped by another SQLAlchemy `COALESCE` expression. PostgreSQL compiles the fallback literal as bind parameters; when the bound expressions differ, PostgreSQL rejects the query because the selected expression is not an exact grouping expression. The old implementation also ran the source and status breakdown queries even for a plain total-count question, so a breakdown failure hid a valid count.

## Fix included

- A simple lead-count request now runs the aggregate KPI query without any `GROUP BY` breakdown query.
- Source and status breakdowns run only when explicitly requested via `breakdown_by`.
- Source grouping uses the raw `Lead.source` column; null/blank labels are normalized in Python after retrieval.
- The `get_leads_summary` tool schema exposes `breakdown_by` values `none`, `source`, `status`, and `all`, and explains when the model should set them.
- Regression tests cover the fast count path, source breakdown with null source, composed lead filters, and tool schema registration among the wider CRM tool tests.

## Apply

From the root of your existing Git repository, extract/overwrite the two paths in this archive:

- `backend/app/application/services/ai_crm_tools.py`
- `backend/tests/test_ai_crm_tools_filtering.py`

Do not replace `.env`, `.git`, or other project configuration.

## Test

From the repository root, install the backend test requirements and run:

```powershell
python -m pytest backend/tests/test_ai_crm_tools_filtering.py -q
```

## Restart and verify

Restart the backend process/container that serves the CRM agent tools so it imports the updated Python module. Then test:

1. `How many leads do we have?` — should call `get_leads_summary` with no breakdown and return the total count.
2. `Show leads by source` — should call `get_leads_summary` with `breakdown_by: "source"` and return source counts.
3. `Show leads by status` — should call it with `breakdown_by: "status"`.

The system prompt alone cannot fix this SQL error; the backend module and tool schema must be deployed and the running backend restarted.
