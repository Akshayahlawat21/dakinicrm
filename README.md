# Dakini CRM — Enterprise Sales CRM & AI Copilot

[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

[![Groq LLM](https://img.shields.io/badge/AI%20Copilot-Groq%20%2F%20GPT--OSS-orange?logo=openai&logoColor=white)](https://groq.com/)

An enterprise-grade Customer Relationship Management (CRM) platform built with a high-performance **React 18 / Vite SPA**, a **FastAPI Layer 2 Edge & API Gateway**, a **FastAPI Layer 3 Application & Data Layer**, a **FastAPI Layer 5 AI Transcript & Copilot Service**, and a **FastAPI Layer 9 Analytics Service** backed by **Supabase PostgreSQL**.

Dakini CRM provides automated pipeline management, multi-tenant row-level security (RLS), autonomous AI copilot agents, drag-and-drop Kanban deal velocity boards, complete calendar scheduling, a live dynamic bidirectional communication hub with smart templates, and sales performance analytics.

---

## 🏛️ System Architecture & Port Map

The application runs as 5 coordinated microservices:

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

## 🌟 Recent Key Enhancements

- **Dynamic Interactive Inbox**:

  - Live unread count tracking that decreases when an email is clicked or viewed, and increments when new mail arrives.

  - Interactive `Simulate Inbound Email (+1)` button for immediate inbound testing.

  - Reading pane controls with `Mark Unread (+1)`, `Reply`, and `Dakini Smart Reply`.

- **Real-Time Supabase Task Toggle**:

  - Task completion toggles are persisted in real time via `PATCH /v1/tasks/{id}/status`.

  - Checking a task keeps it checked and completed across page refreshes.

  - Dashboard priority tasks filter completed items so open tasks move up smoothly.

- **Persistent Profile & User Settings**:

  - User name updates in Workspace Settings are committed to Supabase via `PATCH /v1/users/{id}`.

  - Custom names persist across logout and re-authentication.

- **Responsive Viewport & Drawer Layout**:

  - Fixed drawer overlap where Dakini AI Copilot obscured the Account & Lead detail view panels.

  - TopBar search bar input squishing resolved on smaller viewports.

- **In-Memory Analytics Caching**:

  - Implemented 60-second TTL caching for dashboard and analytics metrics, preventing repeated remote Tokyo database round-trips.

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

| `npm run gateway` | `uvicorn gateway.main:app ...` | Starts Layer 2 Gateway on port 8080 |

| `npm run backend` | `python backend/run.py` | Starts Layer 3 Backend on port 8000 |

| `npm run ai` | `uvicorn app.main:app ...` | Starts Layer 5 AI Service on port 8005 |

| `npm run analytics` | `uvicorn app.main:app ...` | Starts Layer 9 Analytics on port 8090 |

