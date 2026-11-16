# Dakini CRM — Combined Dashboard and AI Lead Fixes

This archive combines two overlays for the existing Dakini CRM repository:

1. **Dashboard All time filter** — adds the All time dashboard preset, maps it to unbounded dashboard/analytics date filters, and makes period-based quota reporting not applicable for an All time selection.
2. **AI lead summary PostgreSQL fix** — separates the simple total-lead KPI from optional grouped breakdowns, groups source counts by the raw `Lead.source` column, normalizes null/blank source names in Python, and exposes `breakdown_by` in the `get_leads_summary` tool schema.

## Files included

- `src/pages/DashboardPage.jsx`
- `src/utils/dashboardPeriods.js`
- `src/utils/__tests__/dashboardPeriods.test.js`
- `src/utils/__tests__/dealAnalyticsFilters.test.js`
- `analytics/app/analytics.py`
- `analytics/tests/` (the included dashboard analytics regression tests)
- `backend/app/application/services/ai_crm_tools.py`
- `backend/tests/test_ai_crm_tools_filtering.py`
- This report and the two individual fix notes

## Apply

Extract this archive into the root of your existing `dakinicrm` repository and allow the included files to overwrite matching paths. The archive intentionally does **not** contain `.env`, `.git`, or `node_modules`.

Restart the backend service that registers and serves CRM tools, and restart/redeploy the analytics service after applying the files.

## Validation performed against the uploaded full project

| Suite | Result |
|---|---:|
| Frontend utility tests (`node --test src/utils/__tests__/*.test.js`) | 32 passed |
| Analytics tests (`PYTHONPATH=analytics python -m pytest analytics/tests -q`) | 45 passed |
| AI CRM tool regression tests (`backend/tests/test_ai_crm_tools_filtering.py`) | 22 passed |
| Python syntax compilation for patched backend and analytics files | Passed |

The AI CRM tool test module was run with `--noconftest` and a temporary import-only `bcrypt` shim because `bcrypt` is not installed in the validation container. These tests use their own SQLite fixture and do not exercise password hashing. Install the project's backend requirements, including `bcrypt`, before running the normal backend test command locally.

## Not verified in this environment

- A live PostgreSQL connection/query against your deployed database.
- The Vite production build; frontend dependencies were not installed in this validation environment.
- Full end-to-end browser tests across the running API services.

## Local verification commands (PowerShell, from repository root)

```powershell
node --test src/utils/__tests__/*.test.js
python -m pytest analytics/tests -q
python -m pytest backend/tests/test_ai_crm_tools_filtering.py -q
npm ci
npm run build
```

Then manually verify:

1. Dashboard date filter has **All time**, and historical leads/deals are included.
2. Quota/target attainment is marked not applicable for All time.
3. `How many leads do we have?` returns the total without asking for a source breakdown.
4. `Show leads by source` returns normalized source counts, including null/blank source values.
5. `Show leads by status` returns status counts.

The AI fix is a backend/tool-schema correction; changing the system prompt alone cannot resolve the PostgreSQL grouping error.
