# Dakini CRM V1 — Transcript Analysis Setup

## What changed
- Lead detail Overview now has a transcript input and an **Analyze with AI** button.
- The right-side Lead Copilot panel was removed from the lead detail page.
- Successful results are shown on the same lead page.
- A new **Customer Feedback** sidebar page aggregates analyzed calls held in frontend application state, with an optional per-call product label/filter.
- No transcript or analysis is written to the CRM database in V1.
- Existing `POST /v1/agent` general agent route is preserved. The new endpoint is `POST /v1/agent/transcript-analysis`.

## Request flow
`Browser → Layer 2 Gateway (8080) → Layer 3 Backend (8000) → Layer 5 AI service (8005) → hosted LLM`

The browser must never call Layer 5 or the hosted LLM directly. The gateway upstream timeout is set to 60 seconds so it can wait for the LLM response.

## Configure Layer 3
Add these values to `backend/.env` (create the file if needed):

```dotenv
AI_SERVICE_URL=http://127.0.0.1:8005
AI_INTERNAL_API_KEY=replace-with-the-same-long-random-secret-used-by-Layer5
```

In the Layer 5 bundle's `ai/.env`, configure the same `AI_INTERNAL_API_KEY` and your provider settings:

```dotenv
AI_INTERNAL_API_KEY=replace-with-the-same-long-random-secret-used-by-Layer3
LLM_API_KEY=your-provider-api-key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-20b
LLM_TIMEOUT_SECONDS=40
```

Use the provider/model enabled for your account. Never commit `.env` files or expose these keys in the frontend.

## Start services
Use separate PowerShell terminals, from the appropriate project folders.

1. Layer 5, from the Layer5 bundle's `ai` folder:
   `py -m uvicorn app.main:app --host 127.0.0.1 --port 8005 --reload`
2. Layer 3, from the CRM repo root (using its existing backend run command or `py -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload`).
3. Layer 2 gateway, from the CRM repo root (using its existing gateway command or `py -m uvicorn gateway.main:app --host 127.0.0.1 --port 8080 --reload`).
4. Frontend, from the CRM repo root: `npm run dev`.

Check:
- Layer 5 health: `http://127.0.0.1:8005/health`
- Layer 3 OpenAPI: `http://127.0.0.1:8000/openapi.json`
- Gateway health: `http://127.0.0.1:8080/v1/health`

Sign in through the CRM so `dakini_access_token` is present. Then open a lead, paste a transcript, and click **Analyze with AI**.

## V1 limits
- No database persistence: analyzed results are held in React context memory only and will clear when the app is refreshed/restarted.
- The Customer Feedback page aggregates only calls analyzed in the current session.
- The current CRM lead model in the supplied ZIP has no product association, so V1 asks for an optional Product discussed label when analyzing each transcript. Dashboard filtering is based on that session-only label; use consistent product names. It is not validated against a product catalog.
- The actual LLM provider key/model and end-to-end live service flow must be verified in your local environment.
