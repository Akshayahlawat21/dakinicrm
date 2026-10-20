# Dakini CRM — Enterprise Sales CRM & AI Copilot

An enterprise-grade Customer Relationship Management (CRM) application built with **React 18**, **React Router v6**, and a **Python FastAPI Layer 2 Edge / API Gateway**. Dakini CRM provides pipeline management, autonomous AI agent interactions, lead conversion flows, live telemetry analytics, and edge security.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher (or `pnpm` / `yarn`)
- **Python**: `3.10` or higher with `pip`

---

## 🖥️ Running the Application

### Step 1: Start the Layer 2 Python API Gateway (Backend)

The gateway acts as the secure entry point, handling JWT issuance/verification, rate limiting, request validation, and proxy routing.

#### 1. Setup Python Virtual Environment (One-time)
```bash
# Windows (PowerShell)
python -m venv gateway/.venv
.\gateway\.venv\Scripts\Activate.ps1
pip install -r gateway/requirements.txt

# Linux / macOS
python3 -m venv gateway/.venv
source gateway/.venv/bin/activate
pip install -r gateway/requirements.txt
```

#### 2. Launch the Gateway Server
```bash
# Windows / Linux / macOS (inside virtual environment):
python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8080 --reload

# Or via npm script (if python/uvicorn is in PATH):
npm run gateway
```
- **Gateway Root:** [http://localhost:8080](http://localhost:8080)
- **Interactive API Docs (Swagger):** [http://localhost:8080/docs](http://localhost:8080/docs)
- **Health Check Endpoint:** [http://localhost:8080/health](http://localhost:8080/health) or `/v1/health`

#### 3. Run Gateway Test Suite (27 Automated Tests)
```bash
# Windows
.\gateway\.venv\Scripts\python -m pytest gateway/tests -v

# Linux / macOS
./gateway/.venv/bin/python -m pytest gateway/tests -v
```

---

### Step 2: Start the React Frontend

The React frontend runs on Vite and connects to the Layer 2 Gateway via Vite's proxy (`/v1` and `/health` $\rightarrow$ `http://localhost:8080`).

```bash
# 1. Install frontend dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Authentication & Demo Credentials

When opening the app or logging out, you are presented with the split-screen Sign In page:

| Field | Default Value | Notes |
| :--- | :--- | :--- |
| **Email** | `elena.rostova@dakini.ai` | Sales Director profile |
| **Password** | `dakini_secure_2026` | Default dev password |
| **Tenant ID** | `tenant_enterprise_01` | Enterprise organization workspace |

> **Quick Login:** You can also click the **"1-Click Demo Login (Elena Rostova)"** button on `/login` to sign in instantly with verified Layer 2 JWT credentials.

---

## 🗺️ URL Routing & Navigation (React Router)

The application features full SPA client-side URL routing with history preservation and protected route guards:

| URL Path | Page / Component | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `/login` | `SignInPage` | Public | Split-screen login view (auto-redirects to `/dashboard` if already logged in) |
| `/` | Redirect | Dynamic | Redirects to `/dashboard` if authenticated, otherwise `/login` |
| `/dashboard` | `DashboardPage` | Protected | KPI metrics, real-time revenue trend charts, stage velocity, live sync |
| `/leads` | `LeadsPage` | Protected | Multi-tier lead table, CSV/JSON lead import, bulk delete, status filtering |
| `/leads/:id` | `LeadDetailPage` | Protected | 360° lead timeline, AI score explanation, conversion modal |
| `/lead-detail` | `LeadDetailPage` | Protected | Direct lead detail view with active selected lead |
| `/accounts` | `AccountsPage` | Protected | Enterprise client accounts directory, ARR metrics, and health scores |
| `/contacts` | `ContactsPage` | Protected | Customer directory, company mapping, and communication history |
| `/deals` | `DealsPage` | Protected | Kanban board pipeline with drag-and-drop stage progression |
| `/campaigns` | `CampaignsPage` | Protected | Omnichannel outreach campaigns, ROI, and conversion metrics |
| `/tasks` | `TasksPage` | Protected | Task list, priority filtering, and completion status |
| `/inbox` | `InboxPage` | Protected | AI-drafted email responses and communication threads |
| `/calendar` | `CalendarPage` | Protected | Sales meeting agenda, customer demo scheduling, and sync |
| `/reports` | `ReportsPage` | Protected | Executive sales analytics, quota attainment, and conversion funnels |
| `/automations`| `AutomationsPage` | Protected | Visual workflow builder and trigger-action automation engine |
| `/agents` | `AgentsPage` | Protected | Autonomous AI agent fleet controls, approval queues, and permissions |
| `/settings` | `SettingsPage` | Protected | Profile preferences, sales quota, integrations, and workspace sign out |
| `/*` | `NotFoundPage` | Protected | 404 handler with direct "Return to Dashboard" action |

---

## 🛠️ Available npm Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port 3000` | Starts the Vite dev server with instant HMR on port 3000 |
| `npm run build` | `vite build` | Compiles and optimizes assets into production bundle (`dist/`) |
| `npm run preview` | `vite preview` | Previews the compiled production build locally |
| `npm run gateway` | `python -m uvicorn gateway.main:app ...` | Launches the Layer 2 Python Gateway on port 8080 |
| `npm run gateway:test` | `pytest gateway/tests -v` | Runs the Python test suite |

---

## 🛡️ Layer 2 Gateway Architecture (LLD E1–E8)

The Python FastAPI Gateway in `gateway/` implements all 8 Low-Level Design modules:

1. **E1: Edge Shield** (`gateway/middleware/edge_shield.py`): Origin secret validation (`X-Edge-Secret`), cache prevention on `/v1/`, and Cloudflare WAF architecture.
2. **E2: Reverse-Proxy & Health** (`gateway/routers/health.py`): Non-blocking `/health` and `/v1/health` with upstream readiness probes.
3. **E3: Versioned Router** (`gateway/routers/proxy.py`): Proxies `/v1/*` to Layer 3 services, strictly disallowing mock responses in production (`can_mock_upstream`).
4. **E4: Token Validation** (`gateway/security/auth.py`): Issues and validates HMAC/OIDC Bearer JWTs, forwarding verified user/tenant claims (`X-User-Id`, `X-Tenant-Id`, `X-User-Roles`).
5. **E5: Rate Limiting** (`gateway/middleware/rate_limiter.py`): Sliding-window rate limiting with in-memory local fallback and Redis compatibility.
6. **E6: Request Validation** (`gateway/middleware/request_validation.py`): 16KB header limits, 1MB payload limits, method whitelist, Content-Type enforcement, and CORS.
7. **E7: Correlation Logging** (`gateway/middleware/correlation.py`): End-to-end `X-Correlation-ID` tracing (`req_<uuid>`), token redaction, and safe structured logging.
8. **E8: Error Normalization** (`gateway/errors.py`): Standardized JSON error envelopes across all HTTP status codes:
   ```json
   {
     "error": {
       "code": "UNAUTHORIZED",
       "message": "Token expired or invalid",
       "correlation_id": "req_f449ea380b4343d8a8d9de52735e6792"
     }
   }
   ```

---

## 🤝 Backend Developers Coordination (Connecting Layer 3 Domain Services)

For backend engineers developing Layer 3 domain microservices:
1. **Upstream Target:** Set `UPSTREAM_API_URL=http://your-layer3-host:port` in `gateway/.env`.
2. **Incoming Headers:** The Gateway authenticates requests and passes the following headers to your service:
   - `X-User-Id`: Authenticated user ID (e.g. `usr_elena`)
   - `X-Tenant-Id`: Tenant organization identifier (e.g. `tenant_enterprise_01`)
   - `X-User-Roles`: Comma-separated roles (e.g. `sales_executive,admin`)
   - `X-Correlation-ID`: Trace identifier for logs and spans
   - `X-Forwarded-For`: Client IP address
3. **Health Check:** Implement a `GET /health` endpoint on your service so the Gateway probe accurately reflects upstream status.

---

## 📁 Repository Structure

```text
dakinicrm/
├── index.html                 # HTML entry point and web typography
├── package.json               # Frontend dependencies and npm scripts
├── vite.config.js             # Vite config & Gateway proxies (/v1, /health)
├── gateway/                   # Layer 2 — Edge / API Gateway (Python FastAPI)
│   ├── config.py              # Pydantic settings & production security validators
│   ├── main.py                # ASGI app, CORS, and middleware pipeline
│   ├── errors.py              # E8 standardized error envelope builders
│   ├── requirements.txt       # Python gateway dependencies (FastAPI, uvicorn, PyJWT, etc.)
│   ├── edge_shield_guidance.md# Deployment and WAF architecture guide
│   ├── middleware/            # E1, E5, E6, E7 middleware modules
│   ├── security/              # E4 JWT token creation and verification
│   ├── routers/               # E2 health, E4 auth, E3 versioned proxy, webhooks
│   └── tests/                 # 27 automated pytest tests covering E1-E8
└── src/
    ├── main.jsx               # React entry point
    ├── App.jsx                # React Router v6 setup & protected route guards
    ├── context/               # CRMContext state, user auth, and navigation
    ├── services/              # api.js Gateway client with correlation & Bearer tokens
    ├── components/            # TopBar, Sidebar, Modals, CommandPalette, Charts
    ├── pages/                 # Dashboard, Leads, Deals, Accounts, SignInPage, etc.
    ├── data/                  # Mock sales dataset and schema definitions
    └── styles/                # CSS design system, typography, components, and layout
```
