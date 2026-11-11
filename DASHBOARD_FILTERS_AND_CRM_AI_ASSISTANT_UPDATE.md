# Dashboard Filters, Deals Analytics, and Dakini CRM Assistant

## Frontend
- Dashboard header now includes period, Campaign, and Product selectors.
- Dashboard revenue, open pipeline, won-deal count, lead count, conversion rate, revenue trend, and pipeline-by-stage chart respond to Campaign/Product selections using the already loaded CRM records.
- Deals & Pipeline opens with Bar chart selected.
- Funnel and Bar percentages are calculated as each stage's share of all filtered deals, not relative to the largest stage.
- Deal filter matching is extracted into `src/utils/dealAnalyticsFilters.js` and has Node built-in unit tests.
- Ask Dakini opens the existing right-side AgentDock explicitly. The dock close button closes it.
- Removed the hard-coded local AI answer fallback and the hard-coded sample assistant greeting.

## Backend / Layer 5
- Layer 3 `/v1/agent` now reads CRM records from PostgreSQL using the authenticated tenant UUID. Salesperson records are additionally scoped to the assigned user/owner.
- Context includes lead counts, pipeline grouped by stage and currency, campaign lead counts/budget/status, product pipeline grouped by currency, and the latest 50 deals/leads.
- Campaign/Product/Date filters from the active page are forwarded by the UI and applied to the Layer 3 queries.
- Layer 3 forwards only the trusted, tenant-scoped context and question to Layer 5.
- Layer 5 exposes `/v1/ai/chat` and uses the existing configured Gemini OpenAI-compatible API (`GEMINI_BASE_URL`, `GEMINI_MODEL`, `GEMINI_API_KEY`).
- No canned CRM facts are returned when the AI service is unavailable; the UI shows the service error instead.
- `AI_SERVICE_URL` default changed to `http://localhost:8005`, matching the project's `npm run ai` port. Production deployments should set this explicitly.
- Agent calls send `X-Mock-Fallback: false` so the gateway cannot silently return mock answers.

## Tests run
- `node --test src/utils/__tests__/dealAnalyticsFilters.test.js`: 9 passed.
- `pytest ai/tests -o pythonpath=ai`: 5 passed.
- Python compileall for backend and Layer 5: passed.
- Full backend test suite could not start because the environment lacks the `bcrypt` package.
- Frontend Vite build was not run because dependencies (`node_modules`) are not installed in this extracted project environment.

## Production validation still required
1. Configure matching `AI_INTERNAL_API_KEY` in Layer 3 and Layer 5, and `GEMINI_API_KEY` in Layer 5.
2. Set `AI_SERVICE_URL` to the deployed Layer 5 base URL.
3. Run `npm ci && npm run build`.
4. Run backend tests in the project's normal environment with `bcrypt` installed.
5. Verify live PostgreSQL queries, user-role scoping, and simultaneous chat/filter requests using separate authenticated tenant accounts.
6. Test dashboard totals across mixed currencies; revenue totals must remain currency-aware.
