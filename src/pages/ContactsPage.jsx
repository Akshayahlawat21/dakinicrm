import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Sparkles,
  ChevronRight,
  Send,
  Building2
} from 'lucide-react';

export default function ContactsPage() {
  const { contacts, setIsQuickCreateOpen, setQuickCreateType, setIsAgentDockOpen, sendAgentMessage } = useCRM();
  const [search, setSearch] = useState('');

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.account.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Contacts
            </h1>
            <span className="badge badge-blue">{contacts.length} total</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Buyers and decision makers across your accounts
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setQuickCreateType('contact');
            setIsQuickCreateOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="tab-group">
        <button className="tab-btn active">
          All
          <span className="tab-count-pill">{contacts.length}</span>
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem', maxWidth: 420 }}>
        <div className="search-bar-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Search contacts..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="crm-table-container">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Account</th>
              <th>Title</th>
              <th>Contact Info</th>
              <th style={{ textAlign: 'right' }}>Outreach Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {contact.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{contact.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{contact.industry || 'Enterprise'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>
                    {contact.account}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 500, color: '#334155' }}>
                    {contact.title}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: '0.8125rem' }}>
                    <div style={{ color: '#0f172a', fontWeight: 600 }}>{contact.email}</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{contact.phone}</div>
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setIsAgentDockOpen(true);
                      sendAgentMessage(`Draft an executive outreach pitch for ${contact.name} (${contact.title} at ${contact.account})`);
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Draft outreach</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
