import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  Trash2
} from 'lucide-react';

export default function ContactsPage() {
  const { contacts = [], deleteContact, setIsQuickCreateOpen, setQuickCreateType, setIsAgentDockOpen, sendAgentMessage, isLoadingData } = useCRM();

  const [search, setSearch] = useState('');

  const getContactName = (c) => {
    if (!c) return 'Contact';
    if (c.name && typeof c.name === 'string') return c.name;
    const full = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    return full || 'Enterprise Contact';
  };

  const getInitials = (c) => {
    const fullName = getContactName(c);
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] ? parts[0].slice(0, 2) : 'CN').toUpperCase();
  };

  const filteredContacts = (contacts || []).filter((c) => {
    if (!c) return false;
    const nameStr = getContactName(c).toLowerCase();
    const accStr = (c.account || c.company || '').toLowerCase();
    const titleStr = (c.title || '').toLowerCase();
    const q = (search || '').toLowerCase();
    return nameStr.includes(q) || accStr.includes(q) || titleStr.includes(q);
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Contacts
            </h1>
            <span className="badge badge-blue">{(contacts || []).length} total</span>
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
      <div className="tab-group" style={{ marginBottom: '1rem' }}>
        <button className="tab-btn active">
          All
          <span className="tab-count-pill">{(contacts || []).length}</span>
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem', maxWidth: 420 }}>
        <div className="search-bar-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Search contacts by name, company, or title..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading state indicator */}
      {isLoadingData && (contacts || []).length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
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
              {filteredContacts.map((contact) => {
                const displayName = getContactName(contact);
                const displayAccount = contact.account || contact.company || 'Enterprise Corp';
                const displayTitle = contact.title || 'Decision Maker';
                const displayIndustry = contact.industry || 'Logistics & Tech';
                const displayEmail = contact.email || '—';
                const displayPhone = contact.phone || '—';

                return (
                  <tr key={contact.id || `con-${displayName}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {getInitials(contact)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{displayName}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{displayIndustry}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#2563eb' }}>
                        {displayAccount}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: '#334155' }}>
                        {displayTitle}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        <div style={{ color: '#0f172a', fontWeight: 600 }}>{displayEmail}</div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{displayPhone}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          type="button"
                          title="Delete Contact"
                          onClick={() => {
                            if (window.confirm(`Delete contact "${displayName}"?`)) {
                              deleteContact(c.id);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setIsAgentDockOpen(true);
                            sendAgentMessage(`Draft an executive outreach pitch for ${displayName} (${displayTitle} at ${displayAccount})`);
                          }}
                        >
                          <Sparkles size={13} />
                          <span>Draft outreach</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                );
              })}
            </tbody>
          </table>

          {filteredContacts.length === 0 && !isLoadingData && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>No contacts found</div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>Try clearing search or create a new contact</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
