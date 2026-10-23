# Dakini CRM — Layer 9 Analytics API

Standalone FastAPI analytics service designed for the schema in `Akshayahlawat21/dakinicrm` branch `feat/layer3-application-data-layer`. It aggregates CRM records; it never writes business data.

## Endpoints

All report endpoints require `X-Tenant-Id` with an existing organization UUID or slug. Do not expose this service directly to untrusted clients; only the trusted gateway should forward a validated tenant context.

- `GET /health` — database connection check (`SELECT 1`)
- `GET /v1/reports/overview?period=month` — KPI totals, open/weighted pipeline, won revenue, conversions and activities when available
- `GET /v1/reports/revenue-trend?months=6` — monthly won revenue and deal count for the last 1–24 months; preserves currencies per month
- `GET /v1/reports/pipeline-by-stage` — open opportunities grouped by stage, value and weighted value
- `GET /v1/reports/lead-sources?period=last_30_days` — lead source counts and percentages
- `GET /v1/reports/conversion-funnel?period=last_30_days` — lead qualification/conversion and open/won pipeline stages with explicit metric definitions
- `GET /v1/reports/activity-performance?period=last_30_days` — activity totals, completion rate, type, status and owner breakdowns
- `GET /v1/reports/quota-leaderboard?period=month` — sales-target rows ranked by attainment, won revenue, won deal count and current open pipeline
- `GET /v1/reports/target-pace?period=quarter` — target, actual revenue, linear expected pace and ahead/behind amount
- `GET /v1/reports/export.csv?report=lead-sources&period=month` — CSV export for one supported report. Supported `report` values: `overview`, `revenue-trend`, `pipeline-by-stage`, `lead-sources`, `conversion-funnel`, `activity-performance`, `quota-leaderboard`, `target-pace`.

Supported periods: `week`, `month`, `quarter`, `year`, `last_7_days`, `last_30_days`, `ytd`.

## Local setup

1. Use Python 3.11+.
2. `python -m venv .venv`, then activate it.
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
5. Set `WON_VALUES` and `LOST_VALUES` to the actual status labels used by your CRM.
6. Run `uvicorn app.main:app --host 127.0.0.1 --port 8090`.
7. Open `http://127.0.0.1:8090/docs`.

## Data definitions and caveats

- Lead totals are based on `leads.created_at` in the selected period; soft-deleted leads are excluded.
- Source distribution groups `leads.source`; the percentage is calculated from the returned counts.
- Lead conversions use `lead_conversions.conversion_date`, joined back to `leads` for tenant scope because the CRM schema does not define `organization_id` on `lead_conversions`.
- MQL/SQL funnel stages count only explicitly labelled lead status values (`mql`, `marketing qualified`, `sql`, `sales qualified` and their underscore/hyphen variants). If your workflow uses different status labels, map them before interpreting the funnel.
- Open pipeline is current inventory, not limited by opportunity creation date. Stage closures use the configured won/lost labels plus `closed`, `cancelled`, `canceled`.
- Deal revenue uses status/stage configured as won and `close_date` first, falling back to `closed_at` or `created_at` only if the schema lacks earlier options.
- Salesperson revenue is attributed by `deals.opportunity_id -> opportunities.owner_id`. Deals without a linked opportunity or owner cannot be attributed to a salesperson by this schema and are not assigned arbitrarily.
- Quota rows use active/approved `sales_targets` whose period overlaps the requested report window. When `period_type` exists, the service selects one best-fitting target cadence (weekly/monthly/quarterly/yearly) instead of summing those different cadences together. The response includes target dates because a shorter report window may overlap a longer target period; callers should show this scope.
- Target pace uses linear elapsed calendar-day pacing across the requested report interval and target rows overlapping that interval. Confirm this policy with the sales operations owner before using it for compensation.
- Amounts are grouped by stored currency where possible. Do not sum or compare currencies without conversion or a same-currency filter.
- Empty data for a valid organization returns zero totals or empty arrays. Invalid tenant identifiers continue to return `404` by default; no tenant bypass is enabled.
- `ALLOW_EMPTY_TENANT` is a local-only legacy option on the original endpoints. Keep it `false` in shared, staging and production environments.

## Validation status

Unit tests validate route contracts, helper logic, mock query responses and CSV response shape. A successful `/health` response proves connection readiness only. Before production, run report endpoints against an approved, seeded non-production tenant and reconcile all totals against raw CRM records. This package cannot verify your private live database without its configured environment and test tenant.
