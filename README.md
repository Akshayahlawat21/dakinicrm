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

## 👥 Team Collaboration Guidelines

### 1. Branching Strategy
- `main`: Production-ready, stable code. Direct pushes are restricted.
- Feature branches: `feature/<feature-name>` (e.g., `feature/deal-filters`)
- Bug fix branches: `fix/<issue-description>` (e.g., `fix/lead-modal-state`)
- Chore / docs: `chore/<description>` or `docs/<description>`

### 2. Development Workflow
1. Pull the latest changes from `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create and switch to your feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Test your changes locally and verify the production build passes:
   ```bash
   npm run build
   ```
4. Commit your changes using descriptive commit messages:
   ```bash
   git commit -m "feat: add deal filtering by stage and owner"
   ```
5. Push to GitHub and open a Pull Request (PR) against `main`.

### 3. Pull Request Checklist
- [ ] Code builds without errors (`npm run build`).
- [ ] UI is responsive across desktop and laptop breakpoints.
- [ ] No extraneous console logs, debugging artifacts, or sensitive keys committed.
- [ ] PR description explains the motivation, changes introduced, and testing steps.

---

## 📄 License

This repository is maintained for internal development and team collaboration.
