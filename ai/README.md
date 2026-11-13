# Dakini CRM — Layer 5 AI Service

Layer 5 provides two authenticated AI capabilities: CRM question answering with OpenAI-compatible tool-call responses, and sales-call transcript analysis. It does not connect directly to the CRM database. All CRM data reads and role checks are performed by Layer 3.

## CRM assistant architecture

`React AgentDock → Layer 2 Gateway → Layer 3 authenticated agent route → Layer 5 Gemini → Layer 3 read-only CRM tool registry → PostgreSQL`

For each chat request, Layer 3 sends the conversation and an allow-listed set of tool definitions to Layer 5. Layer 5 returns either a final assistant message or a function/tool call. Layer 3 executes supported tools against PostgreSQL, applies tenant and role restrictions, then sends the tool result back to Layer 5. The loop is bounded and read-only.

Available Layer 3 tools:

- `search_leads`: status, source, score, campaign, product, text, and creation-date filters.
- `search_deals`: stage, status, account, campaign, product, currency, amount, text, and creation-date filters.
- `get_pipeline_summary`: stage/currency counts, pipeline value, and weighted pipeline value.
- `get_campaign_performance`: campaign type/status/budget and visible lead counts.
- `get_product_performance`: product, visible lead counts, and deal totals separated by currency.
- `get_account_summary`: visible account deal counts and deal values.

The model chooses filters from the user's natural-language question. Browser-supplied dashboard filters are not treated as data scope. Layer 3 enforces scope on every tool call: owners can read tenant records, managers can read their active team's records plus their own, and sales roles can read only their own assigned/owned records. Unassigned leads are not returned to non-owner roles. Client input cannot provide a tenant ID, user ID, team ID, or SQL statement.

The assistant tools are read-only. Changes to leads, deals, campaigns, approvals, or other CRM records must continue through their separately authenticated CRM workflows.

## Transcript analysis

`Dialer/CRM transcript → Layer 3 authenticated bridge → Layer 5 LLM prompt → Summary + Improvements → CRM UI`

The transcript endpoint returns the structured sections `summary` and `improvements`. Layer 5 does not store transcript content or AI output.

## Configuration

Run the AI service from the `ai` folder on Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set these server-side variables in `ai\.env`:

```dotenv
AI_INTERNAL_API_KEY=<long random secret shared only with Layer 3>
GEMINI_API_KEY=<your Gemini API key>
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.8-flash
GEMINI_TIMEOUT_SECONDS=12
```

Set the matching `AI_INTERNAL_API_KEY` and `AI_SERVICE_URL=http://127.0.0.1:8005` in Layer 3 `backend\.env`. Keep both secret values server-side and do not commit either `.env` file.

## Start and test

```powershell
py -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
```

- Health: `http://127.0.0.1:8005/health`
- Swagger: `http://127.0.0.1:8005/docs`
- CRM chat (internal Layer 3 only): `POST /v1/ai/chat`
- Transcript analysis (internal Layer 3 only): `POST /v1/ai/transcript-analysis`

The browser must call Layer 3/Gateway, not Layer 5 directly. Run tests from this folder:

```powershell
py -m pytest -q
py -m py_compile app\*.py
```

Tests mock the LLM provider; they do not prove that live credentials, selected Gemini model, or provider-side tool calling are enabled for your account.
