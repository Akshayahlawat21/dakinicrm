# Dakini AI Assistant — Gemini-only operation and CRM retrieval

## Provider policy

Layer 5 uses exactly one configured Gemini model (`GEMINI_MODEL`). Model fallback is disabled.
Do not configure Groq, OpenAI, or alternate Gemini models for this deployment.

```dotenv
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_SECONDS=12
```

`GEMINI_FALLBACK_MODELS` is ignored for compatibility and should be removed from local
environment files. Restart Layer 5 after changing its environment.

## Error behavior

- Daily Gemini `429` quota exhaustion: return HTTP 429 with a clear quota message. Do not
  retry or call another model.
- Temporary `429` rate limit: return HTTP 429 with a short `Retry-After`.
- Gemini `500`/`502`/`503`/`504`: return a temporary-unavailable response.
- Request timeout: return HTTP 504 with a timeout message.
- Layer 3 preserves these upstream statuses so the browser can show the actual reason
  instead of converting every provider error into HTTP 502.

A new API key in the same Google Cloud / AI Studio project does not reset project quota.
Check usage and limits in Google AI Studio before retrying after a daily quota error.

## CRM data retrieval

Layer 3 executes allow-listed, read-only SQLAlchemy tools. Tenant and user/role scope is
applied by the backend, never accepted from browser-provided context.

Available tools:
- `search_leads`: status, source, score, campaign, product, assignee, text and date filters.
- `search_deals`: stage, status, account, campaign, product, owner, currency, amount and date filters.
- `get_pipeline_summary`: counts and values by stage/currency, including weighted value.
- `get_campaign_performance`: campaign status, budget and visible lead counts.
- `get_product_performance`: product list price and visible lead/deal metrics.
- `get_account_summary`: account deal counts and values.
- `search_contacts`: contact name, email, title and account.
- `search_activities`: tasks, calls, meetings and emails by type, status, priority, text and date.

Relative date filters include today, yesterday, this week, last week, last 7/30/90 days,
this month, this quarter, this year and all time. Explicit ISO date bounds are also accepted.

Independent CRM tool calls are executed concurrently using separate database sessions.
The orchestration loop is bounded to four model round trips and eight total tool calls.
Each query is limited to 50 rows unless it is an aggregate summary.

## Troubleshooting

1. Check Layer 5 logs for the exact Gemini HTTP status and model.
2. For HTTP 429 daily quota, stop repeated requests and wait for quota reset or ask the
   administrator to review the project's billing/tier and quota.
3. For 503, retry later; do not cycle models.
4. For missing CRM answers, check that the requested domain has a tool, the logged-in
   role can see the records, and the tool's filters match actual CRM field values.
5. If the tool returns an error, the assistant must report retrieval failure rather than
   claiming there are zero matching records.
6. Restart Layer 2, Layer 3 and Layer 5 after environment or backend code changes.

## Verification boundary

Automated unit tests cover Layer 5 tool forwarding and Gemini error handling. Database
integration tests and live Gemini requests must also be run in the deployment environment
with its actual database schema, credentials, role setup and installed dependencies.
