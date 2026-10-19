import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Users,
  DollarSign,
  Activity,
  Globe,
  MapPin,
  CheckCircle
} from 'lucide-react';

export default function AccountsPage() {
  const { accounts, navigateTo, deals, setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState(null);

  const filteredAccounts = accounts.filter((acc) => {
    const matchSearch =
      acc.name.toLowerCase().includes(search.toLowerCase()) ||
      acc.industry.toLowerCase().includes(search.toLowerCase());

    if (activeTab === 'Active') return matchSearch && acc.status === 'Active';
    if (activeTab === 'Prospect') return matchSearch && acc.status === 'Prospect';
    return matchSearch;
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Accounts & Companies
            </h1>
            <span className="badge badge-blue">{accounts.length} total</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Enterprise company profiles, contract ARR, and stakeholder hierarchies
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setQuickCreateType('lead');
            setIsQuickCreateOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Add Account</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="tab-group">
        {['All', 'Active', 'Prospect'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="tab-count-pill">
              {tab === 'All' ? accounts.length : accounts.filter((a) => a.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem', maxWidth: 420 }}>
        <div className="search-bar-wrapper">
          <Search size={16} className="search-icon-inside" />
          <input
            type="text"
            placeholder="Search accounts by name or industry..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="crm-table-container">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Industry</th>
              <th>Website</th>
              <th>Status</th>
              <th>Contacts</th>
              <th>Deals</th>
              <th>Annual ARR</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.map((acc) => (
              <tr
                key={acc.id}
                onClick={() => setSelectedAccount(acc)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{acc.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{acc.city || 'India'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ color: '#334155', fontWeight: 500 }}>{acc.industry}</span>
                </td>
                <td>
                  {acc.website && acc.website !== '—' ? (
                    <a
                      href={`https://${acc.website}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {acc.website} <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${acc.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>
                    <span className="badge-dot" />
                    {acc.status}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{acc.contactsCount}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{acc.dealsCount}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{acc.arr}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <ChevronRight size={16} color="#94a3b8" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account Details Drawer */}
      {selectedAccount && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: 0,
            bottom: 0,
            width: 440,
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-4px 0 25px rgba(0,0,0,0.1)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideLeft 0.2s ease'
          }}
        >
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedAccount.name}
                </h3>
                <span className="badge badge-green">{selectedAccount.status}</span>
              </div>
            </div>
            <button onClick={() => setSelectedAccount(null)} style={{ color: '#64748b' }}>
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Account Health Metric */}
            <div className="crm-card" style={{ background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                <span>Account Health Score</span>
                <strong style={{ color: '#2563eb' }}>{selectedAccount.healthScore || 92}%</strong>
              </div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${selectedAccount.healthScore || 92}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)', borderRadius: 4 }} />
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="crm-card" style={{ padding: '0.85rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Contract ARR</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{selectedAccount.arr}</div>
              </div>
              <div className="crm-card" style={{ padding: '0.85rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Key Contacts</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{selectedAccount.contactsCount} Buyers</div>
              </div>
            </div>

            {/* Account Info */}
            <div className="crm-card">
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
                Company Metadata
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Industry</span>
                  <span style={{ fontWeight: 600 }}>{selectedAccount.industry}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Location</span>
                  <span style={{ fontWeight: 600 }}>{selectedAccount.city}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Website</span>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{selectedAccount.website}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigateTo('deals')}>
              View Deals
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setQuickCreateType('deal');
                setIsQuickCreateOpen(true);
              }}
            >
              + Create Deal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
