import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  Globe,
  Trash2,
  Users,
  Briefcase,
  Mail,
  Phone,
  DollarSign
} from 'lucide-react';

export default function AccountsPage() {
  const {
    accounts = [],
    contacts = [],
    deals = [],
    deleteAccount,
    navigateTo,
    setIsQuickCreateOpen,
    setQuickCreateType,
    isLoadingData,
    currentUser,
    isAgentDockOpen,
    setIsAgentDockOpen
  } = useCRM();

  const getAccountContacts = (acc) => {
    if (!acc) return [];
    return (contacts || []).filter(
      (c) =>
        (acc.id && c.account_id && String(c.account_id) === String(acc.id)) ||
        (c.account && acc.name && c.account.toLowerCase().trim() === acc.name.toLowerCase().trim())
    );
  };

  const getAccountDeals = (acc) => {
    if (!acc) return [];
    return (deals || []).filter(
      (d) =>
        (acc.id && d.account_id && String(d.account_id) === String(acc.id)) ||
        (d.company && acc.name && d.company.toLowerCase().trim() === acc.name.toLowerCase().trim())
    );
  };

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'owner').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');


  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState(null);

  const filteredAccounts = (accounts || []).filter((acc) => {
    if (!acc) return false;
    const nameStr = (acc.name || '').toLowerCase();
    const indStr = (acc.industry || '').toLowerCase();
    const q = (search || '').toLowerCase();
    const matchSearch = nameStr.includes(q) || indStr.includes(q);

    const statusLower = (acc.status || '').toLowerCase();
    if (activeTab === 'Active') return matchSearch && statusLower === 'active';
    if (activeTab === 'Prospect') return matchSearch && statusLower === 'prospect';
    return matchSearch;
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Accounts & Companies
            </h1>
            <span className="badge badge-blue">{(accounts || []).length} total</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Enterprise company profiles, contract ARR, and stakeholder hierarchies
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setQuickCreateType('account');
            setIsQuickCreateOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Add Account</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="tab-group" style={{ marginBottom: '1rem' }}>
        {['All', 'Active', 'Prospect'].map((tab) => {
          const count =
            tab === 'All'
              ? (accounts || []).length
              : (accounts || []).filter((a) => (a?.status || '').toLowerCase() === tab.toLowerCase()).length;

          return (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              <span className="tab-count-pill">{count}</span>
            </button>
          );
        })}
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

      {/* Loading state indicator */}
      {isLoadingData && (accounts || []).length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
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
              {filteredAccounts.map((acc) => {
                const displayName = acc.name || 'Enterprise Account';
                const displayIndustry = acc.industry || 'Logistics & Tech';
                const displayLocation = acc.city || acc.address || 'Global';
                const displayWebsite = acc.website && acc.website !== '—' ? acc.website : null;
                const statusText = (acc.status || 'Active').toLowerCase();
                const isStatusActive = statusText === 'active';

                const accContacts = getAccountContacts(acc);
                const accDeals = getAccountDeals(acc);
                const contactsCount = (contacts && Array.isArray(contacts))
                  ? accContacts.length
                  : (acc.contacts_count !== undefined ? Number(acc.contacts_count) : (acc.contactsCount || 0));
                const dealsCount = (deals && Array.isArray(deals))
                  ? accDeals.length
                  : (acc.deals_count !== undefined ? Number(acc.deals_count) : (acc.dealsCount || 0));
                const dealsArrSum = (deals && Array.isArray(deals))
                  ? accDeals.reduce((sum, d) => sum + Number(d.value || d.amount || 0), 0)
                  : (acc.arr_amount !== undefined ? Number(acc.arr_amount) : 0);
                const arrFormatted = `$${dealsArrSum.toLocaleString()}`;

                return (
                  <tr
                    key={acc.id || `acc-${displayName}`}
                    onClick={() => { setSelectedAccount(acc); if (window.innerWidth < 1280) setIsAgentDockOpen(false); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{displayName}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{displayLocation}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>{displayIndustry}</span>
                    </td>
                    <td>
                      {displayWebsite ? (
                        <a
                          href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe size={13} />
                          <span>{displayWebsite}</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${isStatusActive ? 'badge-green' : 'badge-amber'}`}>
                        <span className="badge-dot" />
                        {isStatusActive ? 'Active' : 'Prospect'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{contactsCount}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{dealsCount}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{arrFormatted}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          type="button"
                          title={isOwner ? "Delete Account" : "Permission Denied: Only Organization Owners can delete accounts"}
                          disabled={!isOwner}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isOwner) {
                              alert("Permission Denied: Only Organization Owners are permitted to delete accounts.");
                              return;
                            }
                            if (window.confirm(`Delete account "${displayName}"?`)) {
                              deleteAccount(acc.id);
                              if (selectedAccount?.id === acc.id) setSelectedAccount(null);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isOwner ? '#94a3b8' : '#cbd5e1',
                            cursor: isOwner ? 'pointer' : 'not-allowed',
                            padding: 4,
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            opacity: isOwner ? 1 : 0.4
                          }}
                          onMouseEnter={(e) => {
                            if (isOwner) e.currentTarget.style.color = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            if (isOwner) e.currentTarget.style.color = '#94a3b8';
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <ChevronRight size={16} color="#94a3b8" />
                      </div>
                    </td>
                  </tr>

                );
              })}
            </tbody>
          </table>

          {filteredAccounts.length === 0 && !isLoadingData && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Building2 size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>No accounts found</div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>Try clearing search or launch a new account</div>
            </div>
          )}
        </div>
      )}

      {/* Account Details Drawer */}
      {selectedAccount && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: isAgentDockOpen ? 360 : 0,
            bottom: 0,
            width: 440,
            maxWidth: 'calc(100vw - 380px)',
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-4px 0 25px rgba(0,0,0,0.1)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideLeft 0.2s ease',
          }}
        >
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedAccount.name || 'Account Details'}
                </h3>
                <span className="badge badge-green">
                  {(selectedAccount.status || 'Active').toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedAccount(null)}
              style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
            >
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
            {(() => {
              const drawerContacts = getAccountContacts(selectedAccount);
              const drawerDeals = getAccountDeals(selectedAccount);
              const drawerArrSum = (deals && Array.isArray(deals))
                ? drawerDeals.reduce((sum, d) => sum + Number(d.value || d.amount || 0), 0)
                : (selectedAccount.arr_amount !== undefined ? Number(selectedAccount.arr_amount) : 0);
              const drawerArrFormatted = `$${drawerArrSum.toLocaleString()}`;
              const drawerContactsCount = (contacts && Array.isArray(contacts))
                ? drawerContacts.length
                : (selectedAccount.contacts_count !== undefined ? Number(selectedAccount.contacts_count) : (selectedAccount.contactsCount || 0));

              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="crm-card" style={{ padding: '0.85rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Contract ARR</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{drawerArrFormatted}</div>
                    </div>
                    <div className="crm-card" style={{ padding: '0.85rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Key Contacts</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{drawerContactsCount} {drawerContactsCount === 1 ? 'Contact' : 'Contacts'}</div>
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
                        <span style={{ fontWeight: 600 }}>{selectedAccount.industry || 'Logistics & Tech'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Location</span>
                        <span style={{ fontWeight: 600 }}>{selectedAccount.city || selectedAccount.address || 'Global'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Website</span>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{selectedAccount.website || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Associated Contacts */}
                  <div className="crm-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Users size={16} color="#2563eb" />
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Associated Contacts
                        </h4>
                      </div>
                      <span className="badge badge-blue">{drawerContacts.length}</span>
                    </div>
                    {drawerContacts.length === 0 ? (
                      <div style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                        No contacts linked to this account yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {drawerContacts.map((c) => (
                          <div
                            key={c.id}
                            style={{
                              padding: '0.6rem 0.75rem',
                              background: '#f8fafc',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{c.name}</span>
                              <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, background: '#eff6ff', padding: '0.1rem 0.45rem', borderRadius: 4 }}>
                                {c.title || 'Decision Maker'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                              {c.email && c.email !== '—' && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Mail size={12} /> {c.email}
                                </span>
                              )}
                              {c.phone && c.phone !== '—' && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Phone size={12} /> {c.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Related Deals */}
                  <div className="crm-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Briefcase size={16} color="#059669" />
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                          Related Deals & Pipeline
                        </h4>
                      </div>
                      <span className="badge badge-green">{drawerDeals.length}</span>
                    </div>
                    {drawerDeals.length === 0 ? (
                      <div style={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                        No active deals linked to this account yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {drawerDeals.map((d) => (
                          <div
                            key={d.id}
                            style={{
                              padding: '0.6rem 0.75rem',
                              background: '#f8fafc',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{d.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                Stage: <strong style={{ color: '#0f172a' }}>{d.stage || 'Qualified'}</strong>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#059669', fontSize: '0.9rem' }}>
                                ${Number(d.value || d.amount || 0).toLocaleString()}
                              </div>
                              {d.owner && (
                                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{d.owner}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-outline"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={() => {
                if (window.confirm(`Delete account "${selectedAccount.name}"?`)) {
                  deleteAccount(selectedAccount.id);
                  setSelectedAccount(null);
                }
              }}
              title="Delete Account"
            >
              <Trash2 size={15} />
              <span>Delete</span>
            </button>
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
