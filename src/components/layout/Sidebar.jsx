import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Handshake,
  Megaphone,
  Briefcase,
  Layers,
  Crosshair,
  CheckSquare,
  Mail,
  Calendar,
  BarChart3,
  MessageSquareText,
  Zap,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BadgeCheck
} from 'lucide-react';

export default function Sidebar() {
  const { currentTab, navigateTo, sidebarCollapsed, setSidebarCollapsed, leads, deals, tasks, approvals } = useCRM();

  const wonDealsCount = (deals || []).filter((d) => {
    const s = String(d?.stage || '').toLowerCase().trim();
    return s === 'won' || s.includes('won') || s === 'closed won' || s === 'closed_won';
  }).length;

  const navSections = [
    {
      title: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard }
      ]
    },
    {
      title: "Sales",
      items: [
        { id: "accounts", label: "Accounts", icon: Building2 },
        { id: "contacts", label: "Contacts", icon: Users },
        { id: "leads", label: "Leads", icon: UserCheck, count: leads.length },
        { id: "campaigns", label: "Campaigns", icon: Megaphone },
        { id: "deals", label: "Deals & Pipeline", icon: Handshake, count: deals.length },
        { id: "customers", label: "Customers", icon: BadgeCheck, count: wonDealsCount }
      ]
    },
    {
      title: "Engagement",
      items: [
        { id: "tasks", label: "Tasks & To-Dos", icon: CheckSquare, count: tasks.filter(t => !t.completed).length },
        { id: "inbox", label: "Inbox", icon: Mail, count: 1 },
        { id: "calendar", label: "Calendar", icon: Calendar }
      ]
    },
    {
      title: "Insights & Engine",
      items: [
        { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
        { id: "customer-feedback", label: "Customer Feedback", icon: MessageSquareText },
        { id: "automations", label: "Automations", icon: Zap }
      ]
    },
    {
      title: "AI & System",
      items: [
        { id: "agents", label: "Dakini AI Agents", icon: Bot, count: approvals.length, highlight: true },
        { id: "settings", label: "Settings", icon: Settings }
      ]
    }
  ];

  return (
    <aside className={`crm-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-logo-group" onClick={() => navigateTo('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="logo-icon-box">
            <Sparkles size={20} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="sidebar-brand-text">Dakini AI</span>
                <span className="sidebar-brand-badge">CRM</span>
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Sales Enterprise</span>
            </div>
          )}
        </div>
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav List */}
      <div className="sidebar-nav-scroll">
        {navSections.map((sec) => (
          <div key={sec.title} style={{ marginBottom: '0.75rem' }}>
            {!sidebarCollapsed && <div className="nav-section-title">{sec.title}</div>}
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id || (item.id === 'leads' && currentTab === 'lead-detail');

              return (
                <NavLink
                  key={item.id}
                  to={`/${item.id}`}
                  className={({ isActive: navActive }) =>
                    `nav-item ${navActive || (item.id === 'leads' && currentTab === 'lead-detail') ? 'active' : ''}`
                  }
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div className="nav-item-icon">
                    <Icon size={19} />
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <span className="nav-item-label">{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="nav-item-badge">{item.count}</span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Organization Widget */}
      {!sidebarCollapsed && (
        <div className="sidebar-footer-card">
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700
          }}>
            D
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Dakini AI Org
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: 600 }}>
              Enterprise Plan
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
