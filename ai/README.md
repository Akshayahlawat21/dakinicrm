# Dakini CRM — Layer 5 Transcript Analysis

Layer 5 implements only the current AI requirement: one sales-call transcript in, two structured outputs out. It does not provide the old general CRM AI chat, lead-scoring endpoint, CRM database queries, autonomous agents, or AI-output persistence.

## Flow

`Dialer/CRM transcript → Layer 3 authenticated bridge → Layer 5 LLM prompt → Summary + Improvements → CRM UI`

For each submitted transcript, the hosted LLM returns exactly two top-level sections:

- `summary`: `call_summary`, `positive_feedback`, `negative_feedback`, `customer_needs`, `buying_signals`
- `improvements`: `conversion_blockers`, `product_improvements`, `sales_recommendations`, `next_steps`

Layer 5 returns these outputs directly and does not store the transcript or results in the CRM database. If the user submits the same transcript again, it will be analyzed again; there is no result cache or database persistence in the current scope.

## Configuration

From the `ai` folder on Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set these server-side environment variables in `ai\.env`:

```dotenv
AI_INTERNAL_API_KEY=<long random secret shared only with Layer 3>
LLM_API_KEY=<your hosted LLM provider key>
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-20b
LLM_TIMEOUT_SECONDS=40
```

Use an LLM base URL/model that is enabled for your provider account. Never expose either key in the browser or commit it to Git.

## Start and test

```powershell
py -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload
```

- Health: `http://127.0.0.1:8005/health`
- Swagger: `http://127.0.0.1:8005/docs`
- Required authenticated route: `POST /v1/ai/transcript-analysis`

Layer 3 exposes `POST /v1/agent/transcript-analysis`; it forwards the call to Layer 5 after authenticating the CRM request and adding trusted identity headers. The browser must call Layer 3/Gateway, not Layer 5 directly.

Run unit tests from this folder:

```powershell
$env:PYTHONPATH = "."
py -m pytest -q
py -m py_compile app\*.py
```

The tests mock the LLM provider. They do not prove live credentials or the provider/model are configured correctly.

## Current limits

- Transcript input is pasted text from the UI; audio transcription and automatic dialer ingestion are not included in this patch.
- Outputs remain only in browser/application state; they are not retained when the state is cleared or the page reloads.
- The overall product-wide aggregate report is not part of this transcript-only patch. To build it later without resending every transcript to the LLM, the team must agree on a source/history and aggregation strategy.
