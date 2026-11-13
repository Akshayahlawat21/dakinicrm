# Dakini CRM AI retrieval update

Changes in this package:
- Disabled all Gemini model fallback. Layer 5 sends one request to `GEMINI_MODEL`.
- Detects daily Gemini quota exhaustion and returns HTTP 429 with a clear message.
- Preserves Gemini 429/503/504 statuses through Layer 3 instead of flattening all failures to 502.
- Expands the read-only CRM tool catalog with contact and activity retrieval.
- Improves tool-selection instructions so multi-domain questions request independent tools together.
- Raises the bounded orchestration budget to 4 model round trips / 8 tool calls.
- Adds today/yesterday/this-week/last-week date filters and applies activity date filters to activity start time.
- Adds PostgreSQL composite indexes for common tenant-scoped lead, deal and activity retrieval filters.
- Updates AI configuration example and troubleshooting documentation.

Verification:
- Python compileall for `ai/app` and `backend/app`: passed.
- Layer 5 unit tests (`ai/tests/test_main.py`): 7 passed.
- Backend DB/orchestration tests could not be run in this environment because the backend test setup imports `bcrypt`, which is not installed. Run the backend tests in the project's normal virtual environment.
- No live Gemini request or production database migration was run here. Apply the migration in a staging environment first.
