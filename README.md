# Dakini CRM — Enterprise Sales CRM & AI Copilot

An enterprise-grade Customer Relationship Management (CRM) application built with **React 18 SPA**, a **Python FastAPI Layer 2 Edge / API Gateway**, and a **Python FastAPI Layer 3 Application & Data Layer** backed by **Supabase PostgreSQL**.

Dakini CRM provides automated pipeline management, multi-tenant row-level security, autonomous AI copilot agents, Kanban deal velocity tracking, calendar scheduling, and communication cadence templates.

---

## ⚡ Quick Start (Run the Full Stack in 3 Steps)

To run Dakini CRM locally with live Supabase PostgreSQL connectivity, open **three terminal windows** in the project root directory:

```text
┌─────────────────────────────────┐     ┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│     TERMINAL 1: BACKEND         │ ──> │      TERMINAL 2: GATEWAY        │ ──> │     TERMINAL 3: FRONTEND        │
│    Layer 3 Application API      │     │      Layer 2 API Gateway        │     │       React 18 / Vite SPA       │
│     http://localhost:8000       │     │      http://localhost:8080      │     │      http://localhost:3000      │
│  (Multi-Tenant + Supabase DB)   │     │  (JWT Auth, Rate Limit, Proxy)  │     │   (Interactive CRM Dashboard)   │
└─────────────────────────────────┘     └─────────────────────────────────┘     └─────────────────────────────────┘
```

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Python**: `3.10` or higher with `pip` and `venv`

---

### 🖥️ Terminal 1: Layer 3 Backend API (Port 8000)

The Layer 3 backend provides domain services, permission hierarchies, and live database queries into Supabase PostgreSQL.

#### 1. Setup Python Virtual Environment (One-time)
```bash
# Windows (PowerShell)
python -m venv backend/.venv
.\backend\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r backend/requirements.txt

# Linux / macOS
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

#### 2. Configure Environment Variables
Copy the example environment file if not already present:
```bash
# Windows
copy backend\.env.example backend\.env

# Linux / macOS
cp backend/.env.example backend/.env
```
Ensure your `DATABASE_URL` in `backend/.env` points to your Supabase PostgreSQL pooler:
```ini
DATABASE_URL=postgresql+psycopg://postgres.your-ref:your-password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require
JWT_SECRET=dakini-crm-dev-super-secret-key-change-in-production-123456789
```

#### 3. Start the Backend Server
```bash
# Inside activated virtual environment:
python backend/run.py

# Or from project root via npm:
npm run backend
```
- **Backend URL:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

### 🖥️ Terminal 2: Layer 2 Edge / API Gateway (Port 8080)

The Layer 2 Gateway provides edge security, token issuance/validation, sliding-window rate limiting, and reverse proxy routing to Layer 3.

#### 1. Setup Gateway Virtual Environment (One-time)
```bash
# Windows (PowerShell)
python -m venv gateway/.venv
.\gateway\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r gateway/requirements.txt

# Linux / macOS
python3 -m venv gateway/.venv
source gateway/.venv/bin/activate
pip install --upgrade pip
pip install -r gateway/requirements.txt
```

#### 2. Start the Gateway Server
```bash
# Inside activated virtual environment:
python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8080 --reload

# Or from project root via npm:
npm run gateway
```
- **Gateway Base URL:** [http://localhost:8080](http://localhost:8080)
- **Interactive Gateway Swagger:** [http://localhost:8080/docs](http://localhost:8080/docs)
- **Gateway Health Check:** [http://localhost:8080/health](http://localhost:8080/health)

---

### 🖥️ Terminal 3: React 18 Frontend SPA (Port 3000)

The React frontend communicates through the Layer 2 Gateway proxy (`/v1` $\rightarrow$ `http://localhost:8080`).

#### 1. Install Node Dependencies (One-time)
```bash
npm install
```

#### 2. Start the Vite Dev Server
```bash
npm run dev
```
- **Frontend URL:** [http://localhost:3000](http://localhost:3000)

---

## 🧪 Automated Test Suite (59 Tests, 100% Passing)

Run the full end-to-end automated test suite across all architecture layers:

```bash
# Run all 59 tests in one shot (Windows PowerShell)
.\backend\.venv\Scripts\pytest -q

# Run all 59 tests in one shot (Linux / macOS)
./backend/.venv/bin/pytest -q

# Or run tests layer-by-layer via npm scripts:
npm run gateway:test    # 27 Layer 2 Gateway security & proxy tests
npm run backend:test    # 32 Layer 3 Application & Supabase domain tests
```

---

## 🗄️ Supabase Live Verification Scripts

To directly verify that live raw SQL in Supabase matches the API Layer responses, run the verification scripts:

```bash
# Live raw SQL vs API roundtrip proof
python scripts/live_proof.py

# Live Gateway -> Supabase CRUD roundtrip test
python scripts/verify_live_api.py
```

---

## 🔐 Authentication & Demo Credentials

When visiting `/login`, use the 1-click preset buttons or credentials below:

| Role | Name | Email | Password | Tenant ID | Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Elena Rostova | `elena.rostova@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Full organization & system admin access, settings, user management, sales quotas |
| **Manager** | Marcus Vance | `marcus.vance@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Team oversight, quota assignments, pipeline stage approvals |
| **Sales Rep** | Dev Singhania | `dev.singhania@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Lead qualification, customer communications, deals progression |
| **Sales Rep** | Asha Nair | `asha.nair@dakini.ai` | `dakini_secure_2026` | `tenant_enterprise_01` | Field sales, client accounts, task management |

---

## 🗺️ URL Routing & Application Pages

The frontend features full React Router v6 URL navigation with route guards and state persistence:

| Route Path | Page Component | Access | Key Features |
| :--- | :--- | :--- | :--- |
| `/login` | `SignInPage` | Public | Split-screen authentication with 1-click role presets |
| `/dashboard` | `DashboardPage` | Protected | Live Supabase metrics, ARR revenue pacing, pipeline velocity charts |
| `/leads` | `LeadsPage` | Protected | Supabase lead directory, CSV import, status filtering, lead conversion |
| `/leads/:id` | `LeadDetailPage` | Protected | 360° lead timeline, AI score explanation, conversion modal |
| `/accounts` | `AccountsPage` | Protected | Enterprise client accounts directory, ARR health metrics |
| `/contacts` | `ContactsPage` | Protected | Customer directory, company associations, touchpoint history |
| `/deals` | `DealsPage` | Protected | Kanban pipeline board with drag-and-drop stage updates |
| `/campaigns` | `CampaignsPage` | Protected | Omnichannel outreach campaigns, conversion rates, and budgets |
| `/tasks` | `TasksPage` | Protected | Task management, priority filters, and due date tracking |
| `/inbox` | `InboxPage` | Protected | Multi-folder hub: Inbox, Sent (with read tracking), Drafts (autosave & AI compose), and Sales Templates |
| `/calendar` | `CalendarPage` | Protected | Interactive Day (hourly timeline), Week (7-day columns), and Month (35-day grid) views |
| `/reports` | `ReportsPage` | Protected | Sales analytics, quota attainment gauges, win-rate metrics |
| `/automations`| `AutomationsPage` | Protected | Trigger-action workflow automation builder |
| `/agents` | `AgentsPage` | Protected | Autonomous AI agent fleet controls, approval queue, and permissions |
| `/settings` | `SettingsPage` | Protected | Profile preferences with instant TopBar name reflection, credentials, and sign out |

---

## 🚀 Key Features & Recent Upgrades

1. **Real-time User Profile & TopBar Sync**:
   - Changing user names or details in `/settings` immediately updates the TopBar profile pill and avatar initials (e.g., "rohit Rostova" $\rightarrow$ "RR") and persists across page reloads.

2. **Complete Calendar Views (Day, Week, Month)**:
   - **Day View**: Hourly timeline (8:00 AM – 6:00 PM) with event cards, attendee chips, and one-click video conference bridges.
   - **Week View**: 7-day Monday–Sunday column layout with scheduled meeting cards and today highlight.
   - **Month View**: 35-day October 2026 calendar grid displaying date cells, event pills, and quick-jump interactions.

3. **Multi-Folder Communication Hub**:
   - **Inbox**: Synchronized client email threads with linked CRM lead/contact cards and Smart AI reply generation.
   - **Sent**: Dispatched proposals and executive correspondence with read receipts and delivery tracking.
   - **Drafts**: Autosaved drafts with inline editor and Dakini AI tone polishing.
   - **Sales Templates**: Enterprise cadence templates (*Inbound Demo Follow-Up*, *Enterprise MSA & DocuSign*, *Pipeline Reviver*, *Executive Briefing*) with an interactive **Merge Variable Tester** (`{{first_name}}`, `{{company}}`), **Copy Template** clipboard action, and **Use in New Email** draft generator.

4. **Layer 2 Edge API Gateway (E1–E8)**:
   - Origin verification (`X-Edge-Secret`), JWT Bearer token issuance and validation, sliding-window rate limiting, request size validation, correlation tracing (`X-Correlation-ID`), and standardized E8 error envelopes.

5. **Layer 3 Supabase PostgreSQL Integration**:
   - Multi-tenant tenant isolation (`tenant_id`), database connection pooling with statement timeouts, and clean schema normalization for leads, deals, accounts, and tasks.

---

## 🛠️ Available npm Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port 3000` | Starts the Vite React frontend on port 3000 |
| `npm run build` | `vite build` | Compiles the production bundle into `dist/` |
| `npm run preview` | `vite preview` | Previews the production build locally |
| `npm run gateway` | `python -m uvicorn gateway.main:app --port 8080 --reload` | Starts the Layer 2 Gateway on port 8080 |
| `npm run gateway:test`| `pytest gateway/tests -v` | Runs the 27 Layer 2 Gateway tests |
| `npm run backend` | `python backend/run.py` | Starts the Layer 3 Backend API on port 8000 |
| `npm run backend:test`| `pytest backend/tests -v` | Runs the 32 Layer 3 Application & DB tests |

---

## 📁 Repository Directory Structure

```text
dakinicrm/
├── index.html                 # HTML entry point and web fonts
├── package.json               # Frontend dependencies & npm run scripts
├── vite.config.js             # Vite config & Gateway reverse proxy mapping
├── README.md                  # Comprehensive documentation & run guide
│
├── backend/                   # Layer 3 — Application & Supabase Data Layer
│   ├── run.py                 # Windows-safe async server entry point
│   ├── requirements.txt       # Backend dependencies (FastAPI, SQLAlchemy, psycopg, etc.)
│   ├── .env.example           # Supabase connection & JWT secrets template
│   ├── app/
│   │   ├── main.py            # FastAPI app initialization & route registration
│   │   ├── api/routes/        # Leads, Deals, Accounts, Contacts, Dashboard endpoints
│   │   ├── api/schemas/       # Pydantic request & response models
│   │   ├── application/       # Domain services (LeadService, DealService, etc.)
│   │   ├── data/              # SQLAlchemy models, Repositories, DB engine, and RLS
│   │   └── core/              # Config, Security, Auth dependencies, Exceptions
│   └── tests/                 # 32 automated Layer 3 pytest tests
│
├── gateway/                   # Layer 2 — Edge / API Gateway (FastAPI)
│   ├── config.py              # Gateway settings & security validators
│   ├── main.py                # ASGI app & middleware pipeline
│   ├── errors.py              # E8 standardized error envelope builders
│   ├── requirements.txt       # Gateway dependencies
│   ├── middleware/            # E1 Edge Shield, E5 Rate Limiter, E6 Validation, E7 Tracing
│   ├── security/              # E4 JWT token creation and verification
│   ├── routers/               # E2 Health, E4 Auth, E3 Versioned proxy
│   └── tests/                 # 27 automated Layer 2 pytest tests
│
├── scripts/                   # Verification & proof tools
│   ├── live_proof.py          # Raw SQL Supabase comparison vs API JSON
│   └── verify_live_api.py     # Live API roundtrip tester
│
└── src/                       # Layer 1 — React 18 Frontend SPA
    ├── main.jsx               # Application entry point
    ├── App.jsx                # React Router v6 route configuration & guards
    ├── context/CRMContext.jsx # Global CRM state, user profile, and live data sync
    ├── services/api.js        # Universal gateway client with correlation headers
    ├── components/            # Layout (TopBar, Sidebar), Modals, Charts, CommandPalette
    ├── pages/                 # Dashboard, Leads, Deals, Calendar, Inbox, Settings, etc.
    └── styles/                # CSS design system, typography, components, and layout
```
