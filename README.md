# Dakini CRM — Enterprise Sales CRM & AI Copilot

An enterprise-grade Customer Relationship Management (CRM) web application built with **React 18** and **Vite**. Dakini CRM integrates pipeline tracking, lead conversion workflows, real-time analytics, and an autonomous AI agent fleet into a unified interface.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher (or `yarn` / `pnpm`)

### 1. Clone the Repository
```bash
git clone https://github.com/Akshayahlawat21/dakinicrm.git
cd dakinicrm
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite dev server on port `3000` with HMR |
| `npm run build` | Compiles and bundles production assets into `dist/` |
| `npm run preview` | Runs a local server previewing the production build |

---

## 📁 Project Structure

```text
dakinicrm/
├── index.html                 # Main HTML entry point & web fonts
├── package.json               # Project dependencies and npm scripts
├── vite.config.js             # Vite configuration (port 3000, React plugin)
├── screenshots/               # Application UI captures & documentation assets
├── scripts/                   # Report generation and screenshot scripts
└── src/
    ├── main.jsx               # Application entry point
    ├── App.jsx                # Layout orchestrator and tab router
    ├── context/
    │   └── CRMContext.jsx     # Central state management (leads, deals, tasks, copilot)
    ├── components/
    │   ├── common/            # Reusable UI elements (badges, buttons, search, command palette)
    │   ├── layout/            # TopBar, Sidebar nav rail, AI Copilot AgentDock
    │   └── modals/            # Quick create, lead conversion, notifications
    ├── pages/                 # CRM page views (Dashboard, Leads, Deals, Accounts, etc.)
    ├── data/                  # Initial mock dataset and schema definitions
    └── styles/                # CSS design tokens, components, and layout styling
```

---

## 🌟 Key Features

- **Executive Dashboard**: KPI summary cards, revenue forecast charts, and lead source breakdown.
- **Leads & Accounts Management**: Full lead lifecycle with status tracking, conversion modal, and account directories.
- **Deals Pipeline**: Visual Kanban board across multiple deal stages with drag/click interaction.
- **Dakini AI Fleet & Copilot**: Persistent AI side-dock providing context-aware suggestions, autonomous task delegation, and prompt assistance.
- **Command Palette**: Fast keyboard navigation and quick actions (`Ctrl+K` / `Cmd+K`).
- **Reports & Analytics**: Real-time sales velocity, win-rate metrics, and custom report views.

---

## 👥 Team Collaboration Workflow

### For Backend Collaborators:
1. **Clone the repository**:
   ```bash
   git clone https://github.com/Akshayahlawat21/dakinicrm.git
   cd dakinicrm
   ```
2. **Add the backend**:
   - Create your backend service (e.g. inside a `/server` or `/backend` directory).
   - Ensure you add any backend-specific ignores (like `.env`, `node_modules`, `venv`) to `.gitignore`.
3. **Verify it works**:
   - Test both frontend and backend integration locally.
4. **Push directly to the repository**:
   ```bash
   git add .
   git commit -m "Add backend service and API integration"
   git push origin main
   ```

### For Anyone Pulling the Latest Code:
```bash
git pull origin main
npm install
# Install backend dependencies (e.g., cd server && npm install)
npm run dev
```

---

## 📄 License

This repository is maintained for internal development and team collaboration.
