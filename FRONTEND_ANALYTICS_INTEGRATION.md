# Layer 9 frontend integration map

## Shared request client
`src/services/analyticsApi.js` sends `X-Tenant-Id` and calls the Layer 9 report API. `VITE_TENANT_ID` must be the existing CRM organization's UUID or slug. Do not use an arbitrary placeholder.

In local development, Vite proxies `/analytics/*` to `http://localhost:8000/*`. In a deployed environment, point the client at the trusted Layer 2 gateway's analytics route and configure that gateway to validate the authenticated tenant; do not expose Layer 9 directly to untrusted clients.

## Dashboard page
- KPI values load from `/overview`, `/target-pace`, `/quota-leaderboard`.
- Revenue chart loads `/revenue-trend`.
- Pipeline bars load `/pipeline-by-stage`.
- Refresh and period changes trigger new API requests.
- Team leaderboard is loaded from target/deal records instead of `teamPerformance` mock data.
- Empty target rows display an explicit empty state. Values are not filled from mock figures.

## Reports & Analytics page
- Sales tab: `/overview`, `/revenue-trend`, `/pipeline-by-stage`.
- Leads tab: `/overview`, `/lead-sources`, `/conversion-funnel`.
- Activity tab: `/activity-performance`.
- Team tab: `/quota-leaderboard`, `/target-pace`.
- The date selector maps to `last_7_days`, `last_30_days`, `quarter`, and `ytd`.
- CSV export calls `/export.csv` for the selected report tab.

The revenue trend endpoint returns the last six calendar months; it remains a six-month trend regardless of the report tab's date-range filter. If multiple currencies occur in a month, the backend keeps the currency breakdown and does not combine incompatible values into a single chart series.
