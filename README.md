# Dakini CRM — Enterprise Sales CRM & AI Copilot

[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Groq LLM](https://img.shields.io/badge/AI%20Copilot-Groq%20%2F%20GPT--OSS-orange?logo=openai&logoColor=white)](https://groq.com/)

An enterprise-grade Customer Relationship Management (CRM) platform built with a **React 18 / Vite SPA**, a **FastAPI Layer 2 Edge & API Gateway**, a **FastAPI Layer 3 Application & Data Layer**, a **FastAPI Layer 5 AI Transcript & Copilot Service**, and a **FastAPI Layer 9 Analytics Service** backed by **Supabase PostgreSQL**.

Dakini CRM provides automated pipeline management, multi-tenant row-level security (RLS), autonomous AI copilot agents, Kanban deal velocity boards with interactive stage filtering, bulk CSV/JSON lead imports with batch audit logs, full Light & Dark mode theming, calendar scheduling, a bidirectional inbox hub, and sales performance analytics.

---

## 🏛️ System Architecture & Port Map

The application runs as 5 coordinated services:

```text

┌────────────────────────────────────────────────────────────────────────────────────────┐

│                                 LAYER 1: FRONTEND SPA                                  │

│                             React 18 + Vite Dev Server                                 │

│                                http://localhost:3000                                   │

└───────────────────────────────────────────┬────────────────────────────────────────────┘

                                            │ Vite Reverse Proxy

                                            │ (/v1/* & /analytics/*)

                                            ▼

┌────────────────────────────────────────────────────────────────────────────────────────┐

│                              LAYER 2: EDGE / API GATEWAY                               │

│                         FastAPI — http://localhost:8080                                │

│       (JWT Auth, Origin Validation, Sliding-Window Rate Limiting, Correlation ID)      │

└───────────────┬───────────────────────────┬────────────────────────────┬───────────────┘

                │ Proxy /v1/*               │ Internal API Call          │ Proxy /v1/analytics/*

                ▼                           ▼                            ▼

┌───────────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────────┐

│   LAYER 3: APPLICATION API    │ │  LAYER 5: AI SERVICE      │ │LAYER 9: ANALYTICS ENGINE│

│ FastAPI — http://localhost:8000│ │FastAPI — localhost:8005  │ │FastAPI — localhost:8090 │

│ (RBAC, Tenancy, Leads, Deals) │ │(LLM Copilot, Transcripts) │ │(KPI Aggregations, Funnel│

└───────────────┬───────────────┘ └─────────────┬─────────────┘ └────────────┬────────────┘

                │ SQLAlchemy+Psycopg (Port: 5432)│ Asyncpg (Port: 5432)       │ Asyncpg (Port: 6543)

                └───────────────────────────────┼────────────────────────────┘

                                                ▼

┌────────────────────────────────────────────────────────────────────────────────────────┐

│                           DATABASE & DATA LAYER (LAYER 6)                              │

│                 Supabase PostgreSQL 15 (AWS Tokyo `aws-0-ap-northeast-1`)               │

│                  33 Normalized Relational Tables + Row-Level Security                  │

└────────────────────────────────────────────────────────────────────────────────────────┘

```

### Service Registry & Health Endpoints

| Tier | Service | Port | Base URL | Swagger / OpenAPI Docs | Health Check |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1** | React 18 SPA | `3000` | [http://localhost:3000](http://localhost:3000) | — | — |
| **Layer 2** | Edge / API Gateway | `8080` | [http://localhost:8080](http://localhost:8080) | [http://localhost:8080/docs](http://localhost:8080/docs) | [http://localhost:8080/health](http://localhost:8080/health) |
| **Layer 3** | Application API | `8000` | [http://localhost:8000](http://localhost:8000) | [http://localhost:8000/docs](http://localhost:8000/docs) | [http://localhost:8000/health](http://localhost:8000/health) |
| **Layer 5** | AI Copilot Service | `8005` | [http://localhost:8005](http://localhost:8005) | [http://localhost:8005/docs](http://localhost:8005/docs) | [http://localhost:8005/health](http://localhost:8005/health) |
| **Layer 9** | Analytics API | `8090` | [http://localhost:8090](http://localhost:8090) | [http://localhost:8090/docs](http://localhost:8090/docs) | [http://localhost:8090/health](http://localhost:8090/health) |

---

## 📁 Folder Structure

```text
dakinicrm/
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── pytest.ini
├── requirements.txt
├── vite.config.js
├── README.md
├── FRONTEND_ANALYTICS_INTEGRATION.md
├── TRANSCRIPT_ANALYSIS_V1_SETUP.md
├── Dakini_Sales_CRM_Database_and_RBAC_Specification.pdf
├── supabase_seed_data.sql
│
├── src/                                   # Layer 1: React 18 + Vite Frontend SPA
│   ├── main.jsx
│   ├── App.jsx
│   ├── context/
│   │   ├── CRMContext.jsx                 # Global CRM state, auth, theme, entity CRUD
│   │   └── CallContext.jsx                # WebRTC LiveKit softphone state machine, DTMF audio tone synthesis & conference merge
│   ├── data/
│   │   ├── countryCodes.js
│   │   └── mockData.js
│   ├── services/
│   │   ├── aiApi.js                       # Layer 5 AI Copilot & transcript client
│   │   ├── analyticsApi.js                # Layer 9 Analytics API client
│   │   ├── api.js                         # Layer 2/3 authenticated gateway API client
│   │   └── telephonyApi.js                # Layer 2/3 WebRTC telephony client (token, call, hangup, dtmf, control, merge, history)
│   ├── styles/
│   │   ├── index.css                      # Semantic Light/Dark theme CSS variables & base styles
│   │   ├── components.css                 # Shared cards, tables, buttons, badges, inputs
│   │   ├── layout.css                     # App shell, sidebar, topbar, agent dock styles
│   │   └── pages.css                      # Page layouts, Kanban board & tab styles
│   ├── components/
│   │   ├── common/                        # Charts, CommandPalette, CountryPhoneInput, ErrorBoundary, LoadingSymbol
│   │   ├── layout/                        # AgentDock, Sidebar, TopBar (with Dialer trigger)
│   │   ├── modals/                        # AssignOwnerModal, ChangePasswordModal, ConvertLeadModal, NotificationsModal, QuickCreateModal, SignInModal
│   │   ├── settings/                      # TeamRolesSettings
│   │   └── telephony/                     # Outbound Telephony & WebRTC Softphone Components
│   │       ├── ActiveCallPanel.jsx        # Floating call window with telemetry, mute, hold/resume, DTMF keypad & merge
│   │       ├── CallButton.jsx             # One-click lead table calling with phone normalization
│   │       └── DialerModal.jsx            # Floatable, minimizable softphone dialer with audio touch tones & navigation persistence
│   └── pages/                             # Route views
│       ├── AccountsPage.jsx
│       ├── AgentsPage.jsx
│       ├── AutomationsPage.jsx
│       ├── CalendarPage.jsx
│       ├── CallHistoryPage.jsx            # Engagement: Live call records, KPIs, filters & one-click call back
│       ├── CampaignsPage.jsx
│       ├── ContactsPage.jsx
│       ├── CustomerFeedbackPage.jsx
│       ├── CustomersPage.jsx
│       ├── DashboardPage.jsx
│       ├── DealsPage.jsx
│       ├── InboxPage.jsx
│       ├── LeadDetailPage.jsx
│       ├── LeadsPage.jsx
│       ├── NotFoundPage.jsx
│       ├── ReportsPage.jsx
│       ├── SettingsPage.jsx
│       ├── SignInPage.jsx
│       └── TasksPage.jsx
│
├── gateway/                               # Layer 2: Edge / API Gateway (Port 8080)
│   ├── .env.example
│   ├── config.py
│   ├── edge_shield_guidance.md
│   ├── errors.py
│   ├── main.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── middleware/                        # correlation, edge_shield, rate_limiter, request_validation
│   ├── routers/                           # analytics, auth, health, proxy (registered telephony resource), webhooks
│   ├── security/                          # auth (JWT)
│   └── tests/                             # test_e1..e8 & test_analytics_proxy
│
├── gateway-patch/                         # Analytics proxy patch & integration helper
│   ├── README.md
│   ├── apply_gateway_integration.py
│   └── gateway/routers/analytics.py
│
├── backend/                               # Layer 3: Core Application API (Port 8000)
│   ├── .env.example
│   ├── requirements.txt
│   ├── run.py
│   ├── app/
│   │   ├── main.py
│   │   ├── core/                          # config (telephony configuration & livekit signaling), logging
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   ├── routes/                    # accounts, agent, auth, calls, campaigns, contacts, dashboard, deals, health, leads, products, targets, tasks, teams, telephony, users
│   │   │   └── schemas/                   # Pydantic request/response schemas (incl. telephony.py)
│   │   ├── application/                   # context, exceptions, permissions, services/ (incl. telephony_service.py, lead_import_service.py)
│   │   └── data/                          # database, session, transactions, models/, repositories/
│   ├── sql/
│   │   ├── schema.sql
│   │   ├── supabase_demo_data.sql
│   │   └── migrations/                    # 001_team_and_roles .. 006_lead_bulk_import SQL migrations
│   └── tests/                             # RBAC, tenancy, CRUD, duplicate detection, bulk import, test_telephony.py
│
├── ai/                                    # Layer 5: AI Copilot & Transcript Service (Port 8005)
│   ├── .env.example
│   ├── README.md
│   ├── requirements.txt
│   ├── app/                               # config, main, security, transcript_analysis
│   └── tests/                             # test_main, test_transcript_analysis
│
├── analytics/                             # Layer 9: Analytics Service (Port 8090)
│   ├── .env.example
│   ├── README.md
│   ├── requirements.txt
│   ├── run.py
│   ├── app/                               # analytics, config, database, main, tenant
│   └── tests/                             # Overview, revenue trend, lead sources, CSV export & RBAC tests
│
├── sample_data/
│   └── lead_imports/                      # Sample CSV payloads for bulk lead import & deduplication tests
│       ├── 01_clean_1000_leads.csv
│       ├── 02_mixed_1000_leads_with_errors.csv
│       ├── 03_reupload_duplicate_test_1000.csv
│       └── 04_pure_errors_test.csv
│
├── scripts/                               # DB checks, PDF documentation generators, live verification & screenshots
│   ├── build_clean_zips.py
│   ├── build_pdf_report.py
│   ├── capture_screenshots.js
│   ├── generate_docs_pdf.py
│   ├── generate_pdf_report.js
│   ├── generate_rbac_schema_pdf.py
│   ├── live_proof.py
│   ├── test_supabase_conn.py
│   └── verify_live_api.py
│
├── docs/                                  # Architecture, RBAC & Sprint PDF reports
│   ├── Dakini_CRM_Backend_Sprint_Plan.pdf
│   ├── Dakini_CRM_Documentation_Guide.pdf
│   └── Dakini_CRM_RBAC_and_Database_Architecture_Report.pdf
│
└── screenshots/                           # UI reference captures & manifest.json
```

---

## ⚡ Prerequisites

Before setting up the repository, make sure your system has the following installed:

- **Node.js**: `v18.0.0` or higher (`v20.x LTS` recommended) — [Download Node.js](https://nodejs.org/)
- **npm**: `v9.0.0` or higher (bundled with Node)
- **Python**: `3.10`, `3.11`, or `3.12` with `pip` and `venv` — [Download Python](https://www.python.org/)
- **Git**: [Download Git](https://git-scm.com/)

---

## 🚀 Developer Setup (Step-by-Step)

### Step 1: Clone Repository & Create `.env` Files

```bash
git clone https://github.com/Akshayahlawat21/dakinicrm.git
cd dakinicrm
```

Copy the environment templates for all microservices:

#### Windows (PowerShell):

```powershell
copy .env.example .env
copy backend\.env.example backend\.env
copy gateway\.env.example gateway\.env
copy ai\.env.example ai\.env
copy analytics\.env.example analytics\.env
```

#### Linux / macOS:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
cp ai/.env.example ai/.env
cp analytics/.env.example analytics/.env
```

---

### Step 2: Setup Python Virtual Environment

```powershell
# Windows
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

```bash
# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 3: Install Frontend Dependencies

```bash
npm install
```

---

### Step 4: Verify Database Connection

```bash
python scripts/test_supabase_conn.py
```

Expected output:

```text
Connected to Supabase successfully: [('postgres', 'postgres')]
Public tables: ['accounts', 'activities', 'campaigns', 'contacts', 'deals', 'leads', 'organizations', 'users', ...]
```

---

## 💻 Running the Full Stack Locally

Run all 5 services in separate terminal windows:

```text
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  TERMINAL 1: BACKEND   │  │  TERMINAL 2: GATEWAY   │  │    TERMINAL 3: AI      │  │ TERMINAL 4: ANALYTICS  │  │  TERMINAL 5: FRONTEND  │
│ Layer 3 App (Port 8000)│  │ Layer 2 Edge (Port 8080│  │ Layer 5 AI (Port 8005) │  │ Layer 9 Rpts (Port 8090│  │ React / Vite (Port 3000│
│    npm run backend     │  │    npm run gateway     │  │      npm run ai        │  │   npm run analytics    │  │      npm run dev       │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

1. **Terminal 1 — Backend (Layer 3)**:
   ```bash
   npm run backend
   ```
2. **Terminal 2 — Gateway (Layer 2)**:
   ```bash
   npm run gateway
   ```
3. **Terminal 3 — AI Copilot (Layer 5)**:
   ```bash
   npm run ai
   ```
4. **Terminal 4 — Analytics (Layer 9)**:
   ```bash
   npm run analytics
   ```
5. **Terminal 5 — Frontend SPA**:
   ```bash
   npm run dev
   ```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔐 Demo Accounts & 1-Click Login

Navigate to [http://localhost:3000/login](http://localhost:3000/login):

| Role | Name | Email | Password | Tenant ID | Permissions & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Elena Rostova | `elena.rostova@dakini.ai` | `dakini_secure_2026` | `b4b76cde-a5e0-5ffb-9670-2df601cd5eef` | Full tenant admin, user provisioning, revenue pacing, quota assignments |
| **Manager** | Marcus Vance | `marcus.vance@dakini.ai` | `dakini_secure_2026` | `b4b76cde-a5e0-5ffb-9670-2df601cd5eef` | Team oversight, quota monitoring, deal stage approvals, lead assignment |
| **Sales Rep** | Dev Singhania | `dev.singhania@dakini.ai` | `dakini_secure_2026` | `b4b76cde-a5e0-5ffb-9670-2df601cd5eef` | Lead qualification, deal progression, customer communication |
| **Sales Rep** | Asha Nair | `asha.nair@dakini.ai` | `dakini_secure_2026` | `b4b76cde-a5e0-5ffb-9670-2df601cd5eef` | Account management, deal velocity tracking, calendar appointments |

---

## 🌟 Key Features & Recent Enhancements

- **Full Light & Dark Mode Theming**:
  - Switch themes from **Workspace Settings → Profile & User Settings** or the **TopBar** theme toggle (`localStorage`-persisted via `html[data-theme="dark"]`).
  - Semantic CSS variables in `src/styles/index.css` maintain accessible text, table, Kanban header, badge, input, and drawer contrast across all pages.
- **Interactive Stage Bar Filtering & Dedicated Stage Views**:
  - Clicking stage bars (`Qualified`, `Proposal`, `Negotiation`, etc.) in `Dashboard` or `Deals & Pipeline` navigates directly to and filters the corresponding deal stage section.
- **Bulk Lead Import, Deduplication & Batch Audit History**:
  - CSV/JSON bulk lead import (`sample_data/lead_imports/`), duplicate row detection with manual override, server-side paginated search, and persistent Import History diagnostics drawer.
- **Call Transcript & Sentiment Analysis**:
  - Integrated transcript analysis workflow in `Customer Feedback` powered by the Layer 5 AI service.
- **Dynamic Interactive Inbox & Real-Time Task Toggles**:
  - Live unread tracking, simulated inbound mail testing, Smart Reply, real-time Supabase task status updates (`PATCH /v1/tasks/{id}/status`), and profile name synchronization (`PATCH /v1/users/{id}`).
- **In-Memory Analytics Caching & Responsive Drawers**:
  - 60-second TTL caching for analytics metrics and non-overlapping detail/copilot drawers across smaller viewports.
- **Outbound WebRTC Telephony & Human Softphone Integration**:
  - Direct salesperson browser audio calling powered by LiveKit WebRTC and carrier PSTN multi-trunk infrastructure.
  - One-click calling from Leads table and Lead detail views with automated E.164 phone normalization.
  - Floatable, minimizable manual phone dialer accessible globally with full navigation persistence across all CRM pages.
  - Active Call Panel with LiveKit/PSTN telemetry, timer, mute, hold/resume, interactive touch-tone DTMF keypad, and multi-party Call Merge (Conference).
  - Dedicated Call History & Telephony module under Engagement with live call logs, KPI summaries, and one-click call back.
  - Strict `HUMAN_ONLY` dispatch mode with complete AI agent isolation and configurable backend integration.

---

## 🧪 Automated Test Suite

```bash
# Run all tests
pytest -q

# Run layer-specific tests
npm run backend:test
npm run gateway:test
npm run analytics:test
npm run ai:test
```

---

## 🛠️ npm Scripts Reference

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port 3000` | Starts React frontend development server |
| `npm run build` | `vite build` | Compiles production bundle |
| `npm run preview` | `vite preview` | Previews the built production bundle locally |
| `npm run gateway` | `python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8080 --reload` | Starts Layer 2 Gateway on port 8080 |
| `npm run backend` | `python backend/run.py` | Starts Layer 3 Backend on port 8000 |
| `npm run ai` | `python -m uvicorn app.main:app --app-dir ai --host 127.0.0.1 --port 8005 --reload` | Starts Layer 5 AI Service on port 8005 |
| `npm run analytics` | `python analytics/run.py` | Starts Layer 9 Analytics on port 8090 |
| `npm run backend:test` | `pytest backend/tests -v` | Runs Layer 3 backend tests |
| `npm run gateway:test` | `pytest gateway/tests -v` | Runs Layer 2 gateway tests |
| `npm run analytics:test` | `pytest analytics/tests -o pythonpath=analytics -v` | Runs Layer 9 analytics tests |
| `npm run ai:test` | `python -m pytest ai/tests -o pythonpath=ai -v` | Runs Layer 5 AI service tests |
