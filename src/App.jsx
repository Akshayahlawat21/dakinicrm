import React from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import AgentDock from './components/layout/AgentDock';
import ConvertLeadModal from './components/modals/ConvertLeadModal';
import QuickCreateModal from './components/modals/QuickCreateModal';
import CommandPalette from './components/common/CommandPalette';
import NotificationsModal from './components/modals/NotificationsModal';

// Pages
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

function CRMContent() {
  const { currentTab } = useCRM();

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'leads':
        return <LeadsPage />;
      case 'lead-detail':
        return <LeadDetailPage />;
      case 'accounts':
        return <AccountsPage />;
      case 'contacts':
        return <ContactsPage />;
      case 'deals':
        return <DealsPage />;
      case 'campaigns':
        return <CampaignsPage />;
      case 'tasks':
        return <TasksPage />;
      case 'inbox':
        return <InboxPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'reports':
        return <ReportsPage />;
      case 'automations':
        return <AutomationsPage />;
      case 'agents':
        return <AgentsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

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
          {renderActivePage()}
        </main>
      </div>

      {/* 3. Right Slide-out / Pinned Dakini AI Agent Dock */}
      <AgentDock />

      {/* 4. Global Modals */}
      <ConvertLeadModal />
      <QuickCreateModal />
      <CommandPalette />
      <NotificationsModal />
    </div>
  );
}

export default function App() {
  return (
    <CRMProvider>
      <CRMContent />
    </CRMProvider>
  );
}
