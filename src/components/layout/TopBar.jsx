import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import {
  Search,
  Sparkles,
  Plus,
  Bell,
  ChevronDown,
  User,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Database,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function TopBar() {
  const {
    isAgentDockOpen,
    setIsAgentDockOpen,
    setIsCommandPaletteOpen,
    setIsQuickCreateOpen,
    setQuickCreateType,
    approvals,
    isNotificationsOpen,
    setIsNotificationsOpen,
    navigateTo,
    gatewayStatus,
    currentUser,
    isAuthenticated,
    isLoadingData,
    fetchSupabaseData,
    logout,
    setIsSignInModalOpen
  } = useCRM();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  return (
    <header className="crm-topbar">
      {/* Search Bar / Command Palette Trigger */}
      <div className="topbar-left">
        <button
          className="topbar-search-trigger"
          onClick={() => setIsCommandPaletteOpen(true)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Search size={17} />
            <span>Search records, accounts, or ask Dakini...</span>
          </div>
        </button>
      </div>

      {/* TopBar Actions */}
      <div className="topbar-actions">
        {/* Loading Spinner Icon (only shown while fetching) */}
        {isLoadingData && (
          <div
            id="global-loading-spinner"
            title="Loading data..."
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              color: '#2563eb',
            }}
          >
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}

        {/* + Ask Dakini Sparkle Button */}
        <button
          className="btn btn-sparkle"
          onClick={() => setIsAgentDockOpen(!isAgentDockOpen)}
        >
          <Sparkles size={16} />
          <span>Ask Dakini</span>
        </button>

        {/* + New Record Menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setIsNewMenuOpen(!isNewMenuOpen)}
          >
            <Plus size={16} />
            <span>New</span>
            <ChevronDown size={14} />
          </button>

          {isNewMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 180,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '0.4rem',
                zIndex: 100
              }}
              onMouseLeave={() => setIsNewMenuOpen(false)}
            >
              {[
                { type: 'lead', label: 'New Lead' },
                { type: 'deal', label: 'New Deal' },
                { type: 'contact', label: 'New Contact' },
                { type: 'task', label: 'New Task' },
                { type: 'campaign', label: 'New Campaign' }
              ].map((opt) => (
                <button
                  key={opt.type}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 6,
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  className="nav-item"
                  onClick={() => {
                    setQuickCreateType(opt.type);
                    setIsQuickCreateOpen(true);
                    setIsNewMenuOpen(false);
                  }}
                >
                  <Plus size={14} color="#2563eb" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button
            className="topbar-action-icon"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            title="Notifications & Agent Approvals"
          >
            <Bell size={19} />
            {approvals.length > 0 && <span className="topbar-notif-dot" />}
          </button>
        </div>

        {/* User Profile Pill or Sign In Button */}
        {isAuthenticated && currentUser ? (
          <div style={{ position: 'relative' }}>
            <div
              className="topbar-avatar-pill"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
              <div className="avatar-circle">
                {(currentUser.name || 'ER')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div style={{ textAlign: 'left', paddingRight: '0.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  {currentUser.name || 'Elena Rostova'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                  {currentUser.role || 'Sales Director'}
                </div>
              </div>
              <ChevronDown size={14} color="#64748b" />
            </div>

            {isUserMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 220,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                  padding: '0.5rem',
                  zIndex: 100
                }}
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    {currentUser.name || 'Elena Rostova'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {currentUser.email || 'elena.rostova@dakini.ai'}
                  </div>
                </div>
                <button
                  className="nav-item"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.8125rem' }}
                  onClick={() => {
                    navigateTo('settings');
                    setIsUserMenuOpen(false);
                  }}
                >
                  <User size={15} />
                  User Preferences
                </button>
                <button
                  className="nav-item"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.8125rem' }}
                  onClick={() => {
                    navigateTo('agents');
                    setIsUserMenuOpen(false);
                  }}
                >
                  <ShieldCheck size={15} />
                  Agent Permissions
                </button>
                <div style={{ borderTop: '1px solid #f1f5f9', margin: '0.35rem 0' }} />
                <button
                  className="nav-item"
                  style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.8125rem', color: '#dc2626' }}
                  onClick={() => {
                    logout();
                    setIsUserMenuOpen(false);
                  }}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="btn btn-primary"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-full)',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onClick={() => setIsSignInModalOpen(true)}
          >
            <User size={15} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
