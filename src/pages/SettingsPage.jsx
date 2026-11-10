import React, { useState, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  User,
  Users,
  Layers,
  Sliders,
  Plug,
  CreditCard,
  ShieldCheck,
  Check,
  Save,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import TeamRolesSettings from '../components/settings/TeamRolesSettings';

export default function SettingsPage() {
  const { currentUser, updateUserProfile, logout, theme, setTheme } = useCRM();
  const [activeSection, setActiveSection] = useState('profile');
  const [savedNotice, setSavedNotice] = useState(false);

  // Controlled form state for user profile
  const [firstName, setFirstName] = useState(() => {
    return currentUser?.name ? currentUser.name.split(' ')[0] : 'Elena';
  });
  const [lastName, setLastName] = useState(() => {
    return currentUser?.name ? currentUser.name.split(' ').slice(1).join(' ') || '' : 'Rostova';
  });
  const [email, setEmail] = useState(() => {
    return currentUser?.email || 'elena.rostova@dakini.ai';
  });

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser?.name) {
      const parts = currentUser.name.trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  const sections = [
    { id: 'profile', label: 'Profile & Credentials', icon: User },
    { id: 'team', label: 'Team & Roles', icon: Users },
    { id: 'pipelines', label: 'Pipelines & Stages', icon: Layers },
    { id: 'custom-fields', label: 'Custom CRM Fields', icon: Sliders },
    { id: 'integrations', label: 'Integrations & Sync', icon: Plug },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
    { id: 'agent-permissions', label: 'Dakini Agent Permissions', icon: ShieldCheck }
  ];

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Elena Rostova';
    setIsSaving(true);
    if (updateUserProfile) {
      await updateUserProfile({
        name: fullName,
        email: email.trim()
      });
    }
    setIsSaving(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
          Workspace Settings
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Manage your user profile, CRM pipelines, integrations, and enterprise configuration
        </p>
      </div>

      {/* 2-Column Layout (Spec from PDF 5.12) */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Left Column: Settings Menu */}
        <div className="crm-card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
              >
                <Icon size={17} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Column: Settings Form */}
        <div className="crm-card" style={{ padding: '2rem' }}>
          {savedNotice && (
            <div style={{
              background: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              color: 'var(--success-text)',
              padding: '0.75rem 1rem',
              borderRadius: 8,
              fontSize: '0.8125rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <Check size={16} />
              <span>Settings successfully updated across all workspace instances.</span>
            </div>
          )}

          {activeSection === 'profile' && (
            <form onSubmit={handleSave}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Profile & User Settings
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                  Sales Role & Quota Assignment
                </label>
                <input
                  type="text"
                  className="input-field"
                  key={`role-${currentUser?.role || 'Sales Director'}`}
                  defaultValue={`${currentUser?.role || 'Sales Director'} — Enterprise APAC ($75,000 Quota)`}
                  readOnly
                  style={{ background: 'var(--surface-soft)' }}
                />
              </div>

              {/* Theme & Appearance (Dark Mode / Light Mode) */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: '0.65rem' }}>
                  Interface Theme & Appearance
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {/* Light Mode Selector Card */}
                  <div
                    onClick={() => setTheme('light')}
                    role="button"
                    tabIndex={0}
                    style={{
                      cursor: 'pointer',
                      border: theme === 'light' ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                      background: theme === 'light' ? 'var(--primary-light)' : 'var(--bg-card)',
                      boxShadow: theme === 'light' ? '0 0 0 1px var(--primary)' : 'none',
                      borderRadius: 10,
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Sun size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                          Light Mode
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Crisp white canvas & modern blue
                        </div>
                      </div>
                    </div>
                    {theme === 'light' && (
                      <span className="badge badge-blue" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.55rem' }}>
                        Active
                      </span>
                    )}
                  </div>

                  {/* Dark Mode Selector Card */}
                  <div
                    onClick={() => setTheme('dark')}
                    role="button"
                    tabIndex={0}
                    style={{
                      cursor: 'pointer',
                      border: theme === 'dark' ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                      background: theme === 'dark' ? 'var(--primary-light)' : 'var(--bg-card)',
                      boxShadow: theme === 'dark' ? '0 0 0 1px var(--primary)' : 'none',
                      borderRadius: 10,
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: '#1e293b',
                        color: '#60a5fa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Moon size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                          Dark Mode
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Deep obsidian slate for night focus
                        </div>
                      </div>
                    </div>
                    {theme === 'dark' && (
                      <span className="badge badge-blue" style={{ fontSize: '0.6875rem', padding: '0.2rem 0.55rem' }}>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: 'var(--danger-text)', borderColor: 'var(--danger-border)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  onClick={logout}
                >
                  <LogOut size={16} />
                  <span>Sign Out of Workspace</span>
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <Save size={16} />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {activeSection === 'integrations' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                Connected Platforms
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { name: 'Salesforce CRM Enterprise', status: 'Connected', desc: 'Real-time two-way sync for Leads, Accounts, and Opportunities' },
                  { name: 'Google Workspace / Gmail', status: 'Connected', desc: 'Sync customer email threads and automatic calendar meetings' },
                  { name: 'Slack Sales Alerts', status: 'Connected', desc: 'Broadcast won deals and agent approval alerts into #sales-war-room' },
                  { name: 'WhatsApp Business API', status: 'Pending Config', desc: 'Omnichannel customer messaging and conversational quotes' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-default)', borderRadius: 10, background: 'var(--bg-card)' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                    </div>
                    <span className={`badge ${item.status === 'Connected' ? 'badge-green' : 'badge-gray'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'team' && (
            <TeamRolesSettings currentUser={currentUser} />
          )}

          {activeSection !== 'profile' && activeSection !== 'integrations' && activeSection !== 'team' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                {activeSection.replace('-', ' ')}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Configure parameters, custom schemas, and role privileges for this section.
              </p>
              <button className="btn btn-primary" onClick={handleSave}>
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
