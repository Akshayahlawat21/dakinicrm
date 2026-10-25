import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation
} from 'react-router-dom';
import { CRMProvider, useCRM } from './context/CRMContext';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import AgentDock from './components/layout/AgentDock';
import ConvertLeadModal from './components/modals/ConvertLeadModal';
import QuickCreateModal from './components/modals/QuickCreateModal';
import CommandPalette from './components/common/CommandPalette';
import NotificationsModal from './components/modals/NotificationsModal';
import SignInModal from './components/modals/SignInModal';

// Pages
import SignInPage from './pages/SignInPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import AccountsPage from './pages/AccountsPage';
import ContactsPage from './pages/ContactsPage';
import DealsPage from './pages/DealsPage';
import CampaignsPage from './pages/CampaignsPage';
import TasksPage from './pages/TasksPage';
import InboxPage from './pages/InboxPage';
import CalendarPage from './pages/CalendarPage';
import ReportsPage from './pages/ReportsPage';
import AutomationsPage from './pages/AutomationsPage';
import AgentsPage from './pages/AgentsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Protected route guard that redirects to /login if unauthenticated,
 * preserving target location in state for seamless post-login return.
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useCRM();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

/**
 * Authenticated Workspace Layout containing Sidebar, TopBar,
 * dynamic page Outlet, and global modals/dock.
 */
function AppLayout() {
  return (
    <div className="app-container">
      {/* 1. Left Nav Rail (Expandable / Collapsible) */}
      <Sidebar />

      {/* 2. Main Middle Workspace */}
      <div className="main-layout">
        {/* Top Global Bar */}
        <TopBar />

        {/* Dynamic Page Content Viewport */}
        <main className="content-viewport">
          <Outlet />
        </main>
      </div>

      {/* 3. Right Slide-out / Pinned Dakini AI Agent Dock */}
      <AgentDock />

      {/* 4. Global Modals */}
      <ConvertLeadModal />
      <QuickCreateModal />
      <CommandPalette />
      <NotificationsModal />
      <SignInModal />
    </div>
  );
}

/**
 * Main application routes hierarchy
 */
function AppRoutes() {
  const { isAuthenticated } = useCRM();

  return (
    <Routes>
      {/* Public Login Route — redirects to /dashboard if already authenticated */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignInPage />
        }
      />

      {/* Root / Route — redirects based on authentication state */}
      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
        }
      />

      {/* Protected CRM Workspace Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/lead-detail" element={<LeadDetailPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/deals" element={<DealsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Unknown routes inside workspace show 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CRMProvider>
        <AppRoutes />
      </CRMProvider>
    </BrowserRouter>
  );
}
