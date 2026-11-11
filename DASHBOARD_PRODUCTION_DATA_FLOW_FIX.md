# Dashboard data-flow and drill-down corrections

## Revenue trend
- Revenue month labels now parse ISO dates, ISO timestamps, `YYYY-MM`, and supported date strings without appending an invalid `T00:00:00` suffix.
- Missing or malformed dates display `Unknown period` or the raw label; `Invalid Date` is never rendered.
- Dashboard analytics requests bypass the 60-second in-memory analytics cache and retrieve current report data from the authenticated Layer 9 API.

## Pipeline by stage
- Layer 9 query now includes closed Won/Lost opportunities and standalone deals rather than filtering closed records out.
- For linked opportunities, closed Won/Lost deal status takes precedence over a stale opportunity stage; otherwise deal stage, opportunity stage, and status fallback are used.
- Stage strings are canonicalized (including underscores and hyphens), and unknown stages are preserved rather than silently assigned to Qualified.
- API retains `weighted_value` for compatibility. The dashboard chart renders all five canonical buckets and fills absent buckets with zero.

## Total Leads click-through
- Dashboard stores only transient filter criteria in sessionStorage (campaign ID, product ID, date period), not CRM records.
- Leads page requests all pages from the authenticated Leads API (100 per request, max four concurrent requests), so the result is not limited to the first 50 records loaded by the shared CRM context.
- Results are filtered using the same campaign/product/date matching rules and RBAC-scoped API response.
- Leads table displays 100 rows per page; search/status filters operate over the fetched matching set.
- A failed page causes an explicit error instead of silently presenting a partial dataset.

## Browser storage audit
- Leads, deals, campaigns, products and analytics report values are fetched from the Gateway/Layer 9 APIs.
- `localStorage` is used for authentication token/user profile and transcript-analysis drafts. Calendar events are also currently stored in localStorage in CalendarPage and have not been migrated in this Dashboard-focused change because no calendar persistence API contract was established in the supplied project.
- Dashboard analytics no longer reuses the previous global in-memory 60-second cache. Session storage contains only one-time navigation/filter metadata.

## Validation
- Layer 9 analytics tests: 42 passed.
- Frontend utility/filter tests: 21 passed.
- Python compileall for analytics, backend and gateway: passed.
- Modified JSX/JS files parsed with the installed TypeScript transpiler: passed.
- Gateway tests: 30 passed, 1 pre-existing environment/health-service-name assertion failed (`dakini-layer3-app` vs expected `dakini-layer2-gateway`).
- Backend test collection is blocked by missing `bcrypt` dependency.
- Vite production build could not run because the supplied environment has no usable Vite executable/dependency installation.
- Live Supabase integration, production load/concurrency tests, and browser end-to-end tests require the user's running environment and database credentials.
