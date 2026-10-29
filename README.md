# Dakini CRM — Enterprise Sales CRM & AI Copilot

[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Test Suite](https://img.shields.io/badge/Tests-136%20Passing%20(100%25)-brightgreen?logo=pytest&logoColor=white)](https://pytest.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Multi--Tier%20Microservices-blueviolet)]()
An enterprise-grade Customer Relationship Management (CRM) platform built with a high-performance **React 18 / Vite SPA**, a **FastAPI Layer 2 Edge & API Gateway**, a **FastAPI Layer 3 Application & Data Layer**, and a **FastAPI Layer 9 Analytics Service** backed by **Supabase PostgreSQL**.

Dakini CRM provides automated pipeline management, multi-tenant row-level security (RLS), autonomous AI copilot agents, drag-and-drop Kanban deal velocity boards, complete calendar scheduling (Day/Week/Month), an omnichannel communication hub with smart templates, and sales performance analytics.

---

## 🏛️ System Architecture & Port Map

The application runs as 4 coordinated microservices:

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
└─────────────────────┬──────────────────────────────────────────────────┬───────────────┘
                      │                                                  │
                      │ Proxy /v1/*                                      │ Proxy /v1/analytics/*
                      ▼                                                  ▼
┌──────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│        LAYER 3: APPLICATION API          │   │        LAYER 9: ANALYTICS SERVICE       │
│      FastAPI — http://localhost:8000     │   │     FastAPI — http://localhost:8090     │
│ (RBAC, Tenancy, Leads, Deals, Workflows) │   │ (KPI Aggregations, Funnels, CSV Export) │
└─────────────────────┬────────────────────┘   └─────────────────────────┬───────────────┘
                      │                                                  │
                      │ SQLAlchemy + Psycopg (Pooler: 5432)              │ Asyncpg (Pooler: 6543)
                      └─────────────────────┬────────────────────────────┘
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
| **Layer 9** | Analytics API | `8090` | [http://localhost:8090](http://localhost:8090) | [http://localhost:8090/docs](http://localhost:8090/docs) | [http://localhost:8090/health](http://localhost:8090/health) |
| **Layer 5** | AI api | '8050' | [http://localhost:8050](http://localhost:8050) | [http://localhost:8050/docs](http://localhost:8050/docs) | [http://localhost:8050/health](http://localhost:8050/health) |
---

## ⚡ Prerequisites

Before setting up the repository, make sure your system has the following installed:

- **Node.js**: `v18.0.0` or higher (`v20.x LTS` recommended) — [Download Node.js](https://nodejs.org/)
- **npm**: `v9.0.0` or higher (bundled with Node)
- **Python**: `3.10`, `3.11`, or `3.12` with `pip` and `venv` — [Download Python](https://www.python.org/)
- **Git**: [Download Git](https://git-scm.com/)

---

## 🚀 First-Time Developer Setup (Step-by-Step)

Follow these steps once to configure environment files, install dependencies, and verify database connectivity.

### Step 1: Clone Repository & Create `.env` Files

Clone the repository and enter the project root directory:

```bash
git clone https://github.com/Akshayahlawat21/dakinicrm.git
cd dakinicrm
```

The application relies on 4 environment files across its microservices. Copy the sample templates:

#### On Windows (PowerShell):
```powershell
copy .env.example .env
copy backend\.env.example backend\.env
copy gateway\.env.example gateway\.env
copy analytics\.env.example analytics\.env
```

#### On Linux / macOS:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp gateway/.env.example gateway/.env
cp analytics/.env.example analytics/.env
```

> [!IMPORTANT]
> **Environment Variables Checklist**:
> - **`backend/.env`**: Ensure `DATABASE_URL` is set to your Supabase PostgreSQL connection string (e.g. `postgresql+psycopg://postgres.<ref>:<password>@<host>:5432/postgres?sslmode=require`).
> - **`backend/.env` & `gateway/.env`**: `JWT_SECRET` must be identical between Gateway and Backend so that authentication tokens issued at Layer 2 are properly verified at Layer 3.
> - **`analytics/.env`**: Set `DATABASE_URL` with the asyncpg driver (e.g. `postgresql+asyncpg://postgres.<ref>:<password>@<host>:6543/postgres`).
> - **`.env` (root)**: Set `VITE_GATEWAY_URL=http://localhost:8080/v1`, `VITE_TENANT_ID=dakini-enterprise`, and `VITE_ANALYTICS_BASE_URL=http://localhost:8080/v1/analytics`.

---

### Step 2: Setup Python Virtual Environment

You can choose between the **Unified Environment** (Recommended & simplest for local full-stack development) or **Per-Service Environments**.

#### Option A: Unified Root Environment (Recommended)

One virtual environment in the project root handles all 3 Python services (Gateway, Backend, and Analytics):

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

#### Option B: Per-Service Environments (Isolated)

If you prefer isolated environments per microservice:

```bash
# Backend (Layer 3)
python -m venv backend/.venv
# Windows: .\backend\.venv\Scripts\Activate.ps1 | Linux/Mac: source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Gateway (Layer 2)
python -m venv gateway/.venv
# Windows: .\gateway\.venv\Scripts\Activate.ps1 | Linux/Mac: source gateway/.venv/bin/activate
pip install -r gateway/requirements.txt

# Analytics (Layer 9)
python -m venv analytics/.venv
# Windows: .\analytics\.venv\Scripts\Activate.ps1 | Linux/Mac: source analytics/.venv/bin/activate
pip install -r analytics/requirements.txt
```

---

### Step 3: Install Frontend Dependencies

From the project root:

```bash
npm install
```

---

### Step 4: Verify Database Connection

Ensure your Python virtual environment is activated, then run the database diagnostics script:

```bash
python scripts/test_supabase_conn.py
```

Expected output:
```text
Connected to Supabase successfully: [('postgres', 'postgres')]
Public tables: ['accounts', 'activities', 'campaigns', 'contacts', 'deals', 'leads', 'organizations', 'users', ...]
  Table users count: 12
  Table leads count: 28
  Table deals count: 31
  Table accounts count: 31
  Table contacts count: 36
  Table campaigns count: 10
```

> [!NOTE]
> If you are setting up a brand-new blank Supabase database, run the seed file [`supabase_seed_data.sql`](file:///c:/goku/project/dakini_ai/dakinicrm/supabase_seed_data.sql) in your Supabase SQL Editor to provision all tables, organizations, and sample records.

---

## 💻 Running the Full Stack Locally

To run the complete system with live metrics, open **four terminal windows** from the project root directory (with your virtual environment active in Python terminals):

```text
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  TERMINAL 1: BACKEND   │  │  TERMINAL 2: GATEWAY   │  │ TERMINAL 3: ANALYTICS  │  │  TERMINAL 4: FRONTEND  │
│ Layer 3 App (Port 8000)│  │ Layer 2 Edge (Port 8080│  │ Layer 9 Rpts (Port 8090│  │ React / Vite (Port 3000│
│    npm run backend     │  │    npm run gateway     │  │   npm run analytics    │  │      npm run dev       │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

### Terminal 1: Layer 3 Application API (Port 8000)
```bash
npm run backend
# Alternative: python backend/run.py
```
- Available at: **http://localhost:8000**
- Interactive Swagger: **http://localhost:8000/docs**
- Health: **http://localhost:8000/health**

### Terminal 2: Layer 2 Edge / API Gateway (Port 8080)
```bash
npm run gateway
# Alternative: python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8080 --reload
```
- Available at: **http://localhost:8080**
- Interactive Swagger: **http://localhost:8080/docs**
- Health: **http://localhost:8080/health**

### Terminal 3: Layer 9 Analytics Service (Port 8090)
```bash
npm run analytics
# Alternative: python -m uvicorn app.main:app --app-dir analytics --host 127.0.0.1 --port 8090 --reload
```
- Available at: **http://localhost:8090**
- Interactive Swagger: **http://localhost:8090/docs**
- Health: **http://localhost:8090/health**

### Terminal 4: Layer 1 React Frontend (Port 3000)
```bash
npm run dev
# Starts Vite on port 3000 with hot module reloading (HMR)
```
- Available at: **http://localhost:3000**

> [!TIP]
> **Minimal 2-Service Mode**: If you only need to work on core CRM features (Leads, Deals, Kanban, Contacts, Accounts) without reports, you only need **Terminal 1 (Backend)**, **Terminal 2 (Gateway)**, and **Terminal 4 (Frontend)**. Terminal 3 (Analytics) powers the Reports & Dashboard pace widgets.

---

## 🔐 Demo Accounts & 1-Click Login

Navigate to [http://localhost:3000/login](http://localhost:3000/login). You can click any role preset card for instant 1-click authentication, or manually type the credentials:

| Role | Name | Email | Password | Tenant ID | Permissions & Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Elena Rostova | `elena.rostova@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Full administrative access, tenant settings, user provisioning, revenue pacing, quota assignments |
| **Manager** | Marcus Vance | `marcus.vance@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Team oversight, quota monitoring, deal stage approvals, lead assignment |
| **Sales Rep** | Dev Singhania | `dev.singhania@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Lead qualification, deal progression, customer communication, outreach cadences |
| **Sales Rep** | Asha Nair | `asha.nair@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Account management, deal velocity tracking, calendar appointments, customer notes |

---

## 🧪 Automated Test Suite (136 Tests, 100% Passing)

The repository includes a comprehensive automated test suite covering all layers of the application.

### Run All 136 Tests in One Shot

```bash
# Windows (PowerShell)
.\.venv\Scripts\pytest -q

# Linux / macOS
pytest -q
```

Expected output:
```text
136 passed in 48.29s
```

### Run Layer-Specific Test Suites

| Command | Service Tested | Tests | Scope |
| :--- | :--- | :--- | :--- |
| `npm run backend:test` | Layer 3 Backend | **64 tests** | Multi-tenant RLS, Repositories, Domain Services, Auth routes, CRUD operations |
| `npm run gateway:test` | Layer 2 Gateway | **31 tests** | Edge Shield, JWT verification, rate limiting, request size validation, analytics proxy |
| `npm run analytics:test`| Layer 9 Analytics | **41 tests** | Revenue trends, conversion funnels, quota leaderboards, CSV exports, data caveats |

---

## 🛠️ Complete npm Scripts Reference

All primary development tasks are orchestrated through `package.json`:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port 3000` | Starts the React frontend development server on port 3000 |
| `npm run build` | `vite build` | Compiles the production frontend bundle into `dist/` |
| `npm run preview` | `vite preview` | Previews the production bundle locally |
| `npm run gateway` | `uvicorn gateway.main:app ...` | Starts the Layer 2 Gateway on port 8080 |
| `npm run gateway:test` | `pytest gateway/tests -v` | Runs all 31 Layer 2 Gateway security & proxy tests |
| `npm run backend` | `python backend/run.py` | Starts the Layer 3 Backend on port 8000 |
| `npm run backend:test` | `pytest backend/tests -v` | Runs all 64 Layer 3 Application & DB tests |
| `npm run analytics` | `uvicorn app.main:app ...` | Starts the Layer 9 Analytics service on port 8090 |
| `npm run analytics:test`| `pytest analytics/tests ...` | Runs all 41 Layer 9 Analytics tests |

---

## 🗄️ Verification & Proof Scripts

The `scripts/` directory contains validation utilities to inspect live database connections and verify API integrity:

```bash
# 1. Inspect live Supabase table schemas & row counts
python scripts/test_supabase_conn.py

# 2. Compare live raw SQL Supabase outputs against API responses
python scripts/live_proof.py

# 3. Test Gateway -> Supabase end-to-end roundtrip CRUD operations
python scripts/verify_live_api.py
```

---

## 🗺️ Application Pages & Routing Guide

| Route Path | Page Component | Access | Key Features |
| :--- | :--- | :--- | :--- |
| `/login` | `SignInPage` | Public | Split-screen authentication with 1-click role presets |
| `/dashboard` | `DashboardPage` | Protected | Live Supabase metrics, ARR revenue pacing, pipeline velocity charts |
| `/leads` | `LeadsPage` | Protected | Supabase lead directory, CSV import, status filtering, lead qualification |
| `/leads/:id` | `LeadDetailPage` | Protected | 360° lead timeline, AI score explanation, conversion modal |
| `/accounts` | `AccountsPage` | Protected | Enterprise client accounts directory, ARR health metrics |
| `/contacts` | `ContactsPage` | Protected | Customer directory, company associations, touchpoint history |
| `/deals` | `DealsPage` | Protected | Kanban pipeline board with drag-and-drop stage updates |
| `/campaigns` | `CampaignsPage` | Protected | Omnichannel outreach campaigns, conversion rates, and budgets |
| `/tasks` | `TasksPage` | Protected | Task management, priority filters, and due date tracking |
| `/inbox` | `InboxPage` | Protected | Multi-folder hub: Inbox, Sent, Drafts (autosave & AI compose), and Sales Templates |
| `/calendar` | `CalendarPage` | Protected | Interactive Day (hourly timeline), Week (7-day columns), and Month (35-day grid) views |
| `/reports` | `ReportsPage` | Protected | Sales analytics, quota attainment gauges, win-rate metrics, CSV exports |
| `/automations`| `AutomationsPage` | Protected | Trigger-action workflow automation builder |
| `/agents` | `AgentsPage` | Protected | Autonomous AI agent fleet controls, approval queue, and permissions |
| `/settings` | `SettingsPage` | Protected | Profile preferences with instant TopBar sync, credentials, and sign out |

---

## 📁 Repository Directory Structure

```text
dakinicrm/
├── index.html                 # HTML entry point and font definitions
├── package.json               # Frontend dependencies & npm orchestration scripts
├── vite.config.js             # Vite config & reverse proxy mappings (/v1, /analytics)
├── requirements.txt           # Unified Python requirements (FastAPI, SQLAlchemy, asyncpg, bcrypt)
├── pytest.ini                 # Pytest configuration with global pythonpath
├── supabase_seed_data.sql     # Complete schema and seed records for Supabase PostgreSQL
├── README.md                  # Team setup, running, and architecture guide
│
├── src/                       # Layer 1 — React 18 SPA Frontend
│   ├── main.jsx               # Application bootstrap
│   ├── App.jsx                # React Router v6/v7 route definitions & route guards
│   ├── context/CRMContext.jsx # Global CRM context, authentication state, TopBar sync
│   ├── services/              # API clients (`api.js` for Gateway, `analyticsApi.js` for Reports)
│   ├── components/            # Layout (TopBar, Sidebar), Modals, Charts, CommandPalette
│   ├── pages/                 # CRM Views: Dashboard, Leads, Deals, Calendar, Inbox, Reports, etc.
│   └── styles/                # CSS design system (tokens, components, typography, dark mode)
│
├── gateway/                   # Layer 2 — Edge & API Gateway (FastAPI)
│   ├── config.py              # Security settings, rate limits, upstream endpoints
│   ├── main.py                # ASGI application & middleware pipeline
│   ├── errors.py              # Standardized E8 error response envelope
│   ├── middleware/            # E1 Edge Shield, E5 Rate Limiter, E6 Validation, E7 Tracing
│   ├── routers/               # Health check, Auth, Analytics proxy, Layer 3 reverse proxy
│   ├── security/              # JWT issuance, verification, and role decoding
│   └── tests/                 # 31 automated Layer 2 pytest tests
│
├── backend/                   # Layer 3 — Application & Data Layer (FastAPI)
│   ├── run.py                 # Windows-safe async server entry point
│   ├── app/
│   │   ├── main.py            # FastAPI app initialization & route registration
│   │   ├── api/routes/        # Auth, Leads, Deals, Accounts, Contacts, Tasks, Targets, Dashboard
│   │   ├── api/schemas/       # Pydantic v2 request & response validation schemas
│   │   ├── application/       # Domain business logic (LeadService, DealService, UserService)
│   │   ├── core/              # Config, Security, Auth dependencies, Exceptions
│   │   └── data/              # SQLAlchemy async models, Repositories, RLS, and Engine
│   └── tests/                 # 64 automated Layer 3 pytest tests
│
├── analytics/                 # Layer 9 — Analytics & Reporting Service (FastAPI)
│   ├── README.md              # Analytics architecture & data definition notes
│   ├── app/                   # Reports router, SQL aggregations, CSV export builder
│   └── tests/                 # 41 automated Layer 9 pytest tests
│
└── scripts/                   # Developer Diagnostics & Verification Scripts
    ├── test_supabase_conn.py  # Supabase connectivity and table row counter
    ├── live_proof.py          # Direct SQL vs API response comparator
    └── verify_live_api.py     # Live API roundtrip tester
```

---

## ❓ Troubleshooting & Developer FAQ

### 1. `ModuleNotFoundError: No module named 'bcrypt'` or `'asyncpg'`
- **Cause**: Dependencies were installed from an older requirements file.
- **Fix**: Run `pip install -r requirements.txt` from the project root in your activated virtual environment.

### 2. Supabase Connection Timeout or SSL Error
- **Cause**: Supabase connection string lacks required SSL parameters or is using the wrong port.
- **Fix**:
  - In `backend/.env`, ensure `DATABASE_URL` ends with `?sslmode=require`.
  - For connection pooling, use Supabase port `5432` or `6543`.
  - Check whether your firewall allows outbound TCP traffic on port `5432`/`6543`.

### 3. Gateway Returns `502 Bad Gateway` on API Requests
- **Cause**: The Layer 3 Backend (`http://localhost:8000`) or Layer 9 Analytics (`http://localhost:8090`) is not running.
- **Fix**: Ensure Terminal 1 (`npm run backend`) and Terminal 3 (`npm run analytics`) are actively running and their health checks return `{"status":"ok"}`.

### 4. `401 Unauthorized` on Authenticated Endpoints
- **Cause**: `JWT_SECRET` in `gateway/.env` does not match `JWT_SECRET` in `backend/.env`.
- **Fix**: Copy the same secret string into both `.env` files. In development:
  ```ini
  JWT_SECRET=dakini-crm-dev-super-secret-key-change-in-production-123456789
  ```

### 5. Port Already in Use (`Errno 10048` on Windows / `EADDRINUSE`)
- **Cause**: A previous server instance remained running in the background.
- **Fix**:
  - **Windows (PowerShell)**:
    ```powershell
    # Find process on port (e.g., 8000)
    Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
    # Terminate process
    Stop-Process -Id <PID> -Force
    ```
  - **Linux / macOS**:
    ```bash
    lsof -ti:8000 | xargs kill -9
    ```

### 6. Windows Asyncio Event Loop Errors
- **Notice**: On Windows, psycopg and asyncio require the selector event loop policy. This is automatically handled at server launch in `backend/run.py` and `backend/app/main.py`:
  ```python
  if sys.platform == "win32":
      asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
  ```
