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
  LogOut
} from 'lucide-react';
import TeamRolesSettings from '../components/settings/TeamRolesSettings';

export default function SettingsPage() {
  const { currentUser, updateUserProfile, logout } = useCRM();
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

  const handleSave = (e) => {
    e.preventDefault();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || 'Elena Rostova';
    if (updateUserProfile) {
      updateUserProfile({
        name: fullName,
        email: email.trim()
      });
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
          Workspace Settings
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
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
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
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
              <span>Settings successfully updated across all Salesforce instances.</span>
            </div>
          )}

          {activeSection === 'profile' && (
            <form onSubmit={handleSave}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
                Profile & User Settings
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
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
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Sales Role & Quota Assignment
                </label>
                <input
                  type="text"
                  className="input-field"
                  key={`role-${currentUser?.role || 'Sales Director'}`}
                  defaultValue={`${currentUser?.role || 'Sales Director'} — Enterprise APAC ($75,000 Quota)`}
                  readOnly
                  style={{ background: '#f8fafc' }}
                />
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  onClick={logout}
                >
                  <LogOut size={16} />
                  <span>Sign Out of Workspace</span>
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          )}

          {activeSection === 'integrations' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
                Connected Platforms
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { name: 'Salesforce CRM Enterprise', status: 'Connected', desc: 'Real-time two-way sync for Leads, Accounts, and Opportunities' },
                  { name: 'Google Workspace / Gmail', status: 'Connected', desc: 'Sync customer email threads and automatic calendar meetings' },
                  { name: 'Slack Sales Alerts', status: 'Connected', desc: 'Broadcast won deals and agent approval alerts into #sales-war-room' },
                  { name: 'WhatsApp Business API', status: 'Pending Config', desc: 'Omnichannel customer messaging and conversational quotes' }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.desc}</div>
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                {activeSection.replace('-', ' ')}
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1.5rem' }}>
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
