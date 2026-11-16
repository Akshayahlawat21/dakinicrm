# Dashboard All time date filter

## What changed
- Added an `All time` option to the Dashboard date-period selector.
- Maps the option to `all_time` for Layer 9 overview analytics and to an unbounded `all` filter for client-side lead/deal drilldowns.
- Added Layer 9 `all_time` date bounds using the earliest representable Python date through the current UTC day.
- Keeps quota/target attainment out of lifetime comparisons and returns `not_applicable_all_time` with an explanatory note.
- Existing This week, This month, This quarter and Year to date mappings remain unchanged.

## Files changed
- `src/pages/DashboardPage.jsx`
- `src/utils/dashboardPeriods.js`
- `src/utils/__tests__/dashboardPeriods.test.js`
- `src/utils/__tests__/dealAnalyticsFilters.test.js`
- `analytics/app/analytics.py`
- `analytics/tests/test_analytics.py`
- `analytics/tests/test_analytics_mocked.py`

## Validation
Run from the project root:

```powershell
npm run analytics:filters:test
node --test src/utils/__tests__/dashboardPeriods.test.js
python -m pytest analytics/tests/test_analytics.py analytics/tests/test_analytics_mocked.py -o pythonpath=analytics -q
```

The All time dashboard overview counts all historical tenant records through today. Revenue trend remains the existing latest-six-month chart, and pipeline-by-stage remains the current live pipeline snapshot. Quota attainment is not applicable to All time because targets are defined over explicit periods.
