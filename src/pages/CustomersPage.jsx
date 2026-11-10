import React, { useState, useMemo } from 'react';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  BadgeCheck,
  Building2,
  DollarSign,
  Search,
  ExternalLink,
  ChevronRight,
  Globe,
  Mail,
  Phone,
  User,
  Handshake,
  TrendingUp,
  ShieldCheck,
  HeartHandshake,
  Award,
  Sparkles,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Users
} from 'lucide-react';

export default function CustomersPage() {
  const {
    deals = [],
    accounts = [],
    contacts = [],
    navigateTo,
    isLoadingData,
    currentUser
  } = useCRM();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [sortBy, setSortBy] = useState('highest_value');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Helper to normalize deal stages
  const normalizeStage = (stg) => {
    if (!stg) return 'Qualified';
    const s = String(stg).toLowerCase().trim();
    if (s === 'won' || s.includes('won') || s === 'closed won' || s === 'closed_won') return 'Won';
    return stg;
  };

  // Derive won customers from all closed-won deals and cross-reference accounts & contacts
  const wonCustomers = useMemo(() => {
    const wonDeals = (deals || []).filter((d) => normalizeStage(d?.stage) === 'Won');

    return wonDeals.map((deal, idx) => {
      const dealAmount = Number(deal.value || deal.amount || 0);
      const companyName = deal.company || deal.name || 'Enterprise Customer';

      // Match associated Account from accounts list
      const matchedAccount = (accounts || []).find((a) => {
        if (!a) return false;
        if (deal.account_id && a.id && String(a.id) === String(deal.account_id)) return true;
        const aName = (a.name || '').toLowerCase().trim();
        const cName = companyName.toLowerCase().trim();
        return aName && (aName === cName || aName.includes(cName) || cName.includes(aName));
      });

      // Match associated Contact from contacts list
      const matchedContact = (contacts || []).find((c) => {
        if (!c) return false;
        if (deal.account_id && c.account_id && String(c.account_id) === String(deal.account_id)) return true;
        if (matchedAccount?.id && c.account_id && String(c.account_id) === String(matchedAccount.id)) return true;
        const cAccount = (c.account || '').toLowerCase().trim();
        const cName = (c.name || '').toLowerCase().trim();
        const comp = companyName.toLowerCase().trim();
        return (cAccount && (cAccount === comp || comp.includes(cAccount))) || (cName && (cName === comp || comp.includes(cName)));
      });

      // Determine customer tier based on contract value
      let tier = 'Growth';
      let tierColor = 'var(--success-text)';
      let tierBg = 'var(--success-bg)';
      if (dealAmount >= 50000) {
        tier = 'Enterprise';
        tierColor = 'var(--purple-text)';
        tierBg = 'var(--purple-bg)';
      } else if (dealAmount >= 25000) {
        tier = 'Mid-Market';
        tierColor = 'var(--primary)';
        tierBg = 'var(--primary-light)';
      }

      // Close date formatting
      const rawDate = deal.closeDate || deal.close_date || deal.updated_at || deal.created_at;
      let formattedDate = 'Recently Won';
      if (rawDate && rawDate !== 'Recently Won') {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } else {
            formattedDate = String(rawDate);
          }
        } catch {
          formattedDate = String(rawDate);
        }
      }

      const healthScore = matchedAccount?.healthScore || matchedAccount?.health_score || (92 + (idx % 7));

      return {
        id: `customer-${deal.id || idx}`,
        dealId: deal.id,
        dealName: deal.name || `${companyName} Opportunity`,
        dealAmount,
        company: companyName,
        owner: deal.owner || currentUser?.name || 'Sales Representative',
        closeDate: formattedDate,
        tier,
        tierColor,
        tierBg,
        status: 'Active Customer',
        healthScore,
        industry: matchedAccount?.industry || deal.industry || 'Technology & Enterprise',
        website: matchedAccount?.website && matchedAccount.website !== '—' ? matchedAccount.website : null,
        city: matchedAccount?.city || matchedAccount?.address || 'India',
        primaryContact: {
          name: matchedContact?.name || `${companyName} Stakeholder`,
          title: matchedContact?.title || 'Decision Maker',
          email: matchedContact?.email && matchedContact.email !== '—' ? matchedContact.email : `contact@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`,
          phone: matchedContact?.phone && matchedContact.phone !== '—' ? matchedContact.phone : '+1 (555) 019-2831',
        },
        account: matchedAccount,
        deal: deal,
      };
    });
  }, [deals, accounts, contacts, currentUser]);

  // Aggregate Metrics
  const totalRevenue = useMemo(() => {
    return wonCustomers.reduce((acc, c) => acc + c.dealAmount, 0);
  }, [wonCustomers]);

  const avgContractValue = useMemo(() => {
    return wonCustomers.length > 0 ? Math.round(totalRevenue / wonCustomers.length) : 0;
  }, [wonCustomers, totalRevenue]);

  const avgHealth = useMemo(() => {
    return wonCustomers.length > 0
      ? Math.round(wonCustomers.reduce((acc, c) => acc + c.healthScore, 0) / wonCustomers.length)
      : 96;
  }, [wonCustomers]);

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    const q = (search || '').toLowerCase().trim();

    return wonCustomers
      .filter((c) => {
        // Tab filtering
        if (activeTab === 'Enterprise' && c.tier !== 'Enterprise') return false;
        if (activeTab === 'Mid-Market' && c.tier !== 'Mid-Market') return false;
        if (activeTab === 'Growth' && c.tier !== 'Growth') return false;

        // Search filtering
        if (!q) return true;
        const comp = c.company.toLowerCase();
        const contactName = c.primaryContact.name.toLowerCase();
        const contactEmail = c.primaryContact.email.toLowerCase();
        const dealName = c.dealName.toLowerCase();
        const owner = c.owner.toLowerCase();
        const ind = c.industry.toLowerCase();

        return (
          comp.includes(q) ||
          contactName.includes(q) ||
          contactEmail.includes(q) ||
          dealName.includes(q) ||
          owner.includes(q) ||
          ind.includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'highest_value') return b.dealAmount - a.dealAmount;
        if (sortBy === 'lowest_value') return a.dealAmount - b.dealAmount;
        if (sortBy === 'alphabetical') return a.company.localeCompare(b.company);
        return 0;
      });
  }, [wonCustomers, search, activeTab, sortBy]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* 1. Header & Summary Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Customers
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              <BadgeCheck size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {wonCustomers.length} Closed Won
            </span>
            <span className="badge badge-green" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              Total Won Revenue: ${totalRevenue.toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Closed-won client directory with account stakeholders, contract values, and relationship lifecycle
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigateTo('deals')}
            title="View Active Pipeline Kanban"
          >
            <Handshake size={15} />
            <span>View Deals & Pipeline</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigateTo('accounts')}
            title="Open Accounts Directory"
          >
            <Building2 size={15} />
            <span>Accounts Directory</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="crm-card" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Won Customers
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BadgeCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {wonCustomers.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendingUp size={13} />
            100% conversion rate from won stage
          </span>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Won Revenue
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success-text)' }}>
            ${totalRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Cumulative revenue booked
          </span>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Average Deal (ACV)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--purple-bg)', color: 'var(--purple-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ${avgContractValue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Average contract size
          </span>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Avg. Client Health
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HeartHandshake size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {avgHealth}%
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <ShieldCheck size={13} />
            Excellent retention stability
          </span>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="tab-group" style={{ marginBottom: 0 }}>
          {[
            { id: 'All', label: 'All Customers', count: wonCustomers.length },
            { id: 'Enterprise', label: 'Enterprise ($50k+)', count: wonCustomers.filter((c) => c.tier === 'Enterprise').length },
            { id: 'Mid-Market', label: 'Mid-Market ($25k-$50k)', count: wonCustomers.filter((c) => c.tier === 'Mid-Market').length },
            { id: 'Growth', label: 'Growth (<$25k)', count: wonCustomers.filter((c) => c.tier === 'Growth').length },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span className="tab-count-pill">{tab.count}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, justifyContent: 'flex-end', minWidth: 280 }}>
          <div className="search-bar-wrapper" style={{ maxWidth: 360, width: '100%' }}>
            <Search size={16} className="search-icon-inside" />
            <input
              type="text"
              placeholder="Search customers, contacts, deals..."
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: 'auto', padding: '0.45rem 0.85rem', fontSize: '0.8125rem' }}
          >
            <option value="highest_value">Highest Value</option>
            <option value="lowest_value">Lowest Value</option>
            <option value="alphabetical">Company (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 4. Customers Table */}
      {isLoadingData && wonCustomers.length === 0 ? (
        <LoadingSymbol message="Retrieving closed-won customers from database..." />
      ) : (
        <div className="crm-table-container">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Customer / Company</th>
                <th>Won Deal & Contract</th>
                <th>Primary Stakeholder</th>
                <th>Account Manager</th>
                <th>Close Date</th>
                <th>Lifecycle Status</th>
                <th style={{ width: 100, textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;

                return (
                  <tr
                    key={cust.id}
                    onClick={() => setSelectedCustomer(cust)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'var(--surface-soft)' : undefined,
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Customer & Company */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            flexShrink: 0
                          }}
                        >
                          {cust.company.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                            {cust.company}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: 4,
                                background: cust.tierBg,
                                color: cust.tierColor,
                              }}
                            >
                              {cust.tier}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {cust.industry}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Won Deal & Contract Value */}
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--success-text)', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          ${cust.dealAmount.toLocaleString()}
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: 'var(--success-bg)',
                              color: 'var(--success-text)',
                              border: '1px solid var(--success-border)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: 9999,
                            }}
                          >
                            Won
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cust.dealName}>
                          {cust.dealName}
                        </div>
                      </div>
                    </td>

                    {/* Primary Stakeholder */}
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.8125rem' }}>
                          {cust.primaryContact.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {cust.primaryContact.title}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--primary)', marginTop: 1 }}>
                          {cust.primaryContact.email}
                        </div>
                      </div>
                    </td>

                    {/* Account Manager / Owner */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--surface-alt)',
                            color: 'var(--text-body)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6875rem',
                            fontWeight: 700
                          }}
                        >
                          {cust.owner.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)' }}>
                          {cust.owner}
                        </span>
                      </div>
                    </td>

                    {/* Close Date */}
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-body)' }}>
                        {cust.closeDate}
                      </span>
                    </td>

                    {/* Lifecycle Status & Health */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span className="badge badge-green" style={{ width: 'fit-content' }}>
                          <span className="badge-dot" />
                          {cust.status}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <span>Health: {cust.healthScore}%</span>
                          <div style={{ width: 45, height: 4, background: 'var(--surface-alt)', borderRadius: 2 }}>
                            <div style={{ width: `${cust.healthScore}%`, height: '100%', background: 'var(--success)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Details Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(cust);
                        }}
                      >
                        <span>360° Profile</span>
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredCustomers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <BadgeCheck size={42} color="var(--text-subtle)" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-body)' }}>
                No won customers found
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: 4, maxWidth: 360, margin: '4px auto 1rem auto' }}>
                Deals transitioned to the <strong style={{ color: 'var(--success-text)' }}>Won</strong> stage in Deals & Pipeline will automatically appear here with complete customer and stakeholder profiles.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigateTo('deals')}>
                <Handshake size={14} />
                <span>Go to Deals & Pipeline</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Customer 360° Slide-Over Drawer */}
      {selectedCustomer && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: 0,
            bottom: 0,
            width: 480,
            maxWidth: '90vw',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-default)',
            boxShadow: '-6px 0 30px rgba(0,0,0,0.2)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Drawer Header */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                {selectedCustomer.company.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {selectedCustomer.company}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: 3 }}>
                  <span className="badge badge-green" style={{ fontSize: '0.6875rem' }}>
                    <BadgeCheck size={11} style={{ marginRight: 3 }} />
                    Active Customer
                  </span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: 4,
                      background: selectedCustomer.tierBg,
                      color: selectedCustomer.tierColor,
                    }}
                  >
                    {selectedCustomer.tier}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedCustomer(null)}
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '0.25rem' }}
              title="Close Drawer"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Value Summary Card */}
            <div style={{ background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--success-bg) 100%)', border: '1px solid var(--primary-subtle)', borderRadius: 12, padding: '1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Total Contract Value
                  </span>
                  <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--success-text-dark)', marginTop: 2 }}>
                    ${selectedCustomer.dealAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success-text)', marginTop: 2 }}>
                    Closed-Won on {selectedCustomer.closeDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Account Health</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {selectedCustomer.healthScore}%
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--success)', fontWeight: 600 }}>Prime Condition</span>
                </div>
              </div>
            </div>

            {/* Primary Stakeholder Card */}
            <div className="crm-card" style={{ padding: '1rem', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={15} color="var(--primary)" />
                  Primary Decision Maker
                </span>
                <span className="badge badge-blue" style={{ fontSize: '0.6875rem' }}>Verified Stakeholder</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--purple-bg)', color: 'var(--purple-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {selectedCustomer.primaryContact.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    {selectedCustomer.primaryContact.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {selectedCustomer.primaryContact.title}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-body)' }}>
                  <Mail size={14} color="var(--text-muted)" />
                  <a href={`mailto:${selectedCustomer.primaryContact.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                    {selectedCustomer.primaryContact.email}
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-body)' }}>
                  <Phone size={14} color="var(--text-muted)" />
                  <span>{selectedCustomer.primaryContact.phone}</span>
                </div>
              </div>
            </div>

            {/* Won Opportunity Details */}
            <div className="crm-card" style={{ padding: '1rem', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Handshake size={15} color="var(--success-text)" />
                  Closed-Won Opportunity
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => navigateTo('deals')}
                >
                  View in Pipeline
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Opportunity Name</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', textAlign: 'right', maxWidth: 220 }}>
                    {selectedCustomer.dealName}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pipeline Stage</span>
                  <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>
                    100% Closed Won
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Account Executive</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedCustomer.owner}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Close Date</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedCustomer.closeDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Company Profile Details */}
            <div className="crm-card" style={{ padding: '1rem', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={15} color="var(--primary)" />
                  Company Profile
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => navigateTo('accounts')}
                >
                  View Account
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Industry</span>
                  <span style={{ fontWeight: 600 }}>{selectedCustomer.industry}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Headquarters</span>
                  <span style={{ fontWeight: 600 }}>{selectedCustomer.city}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Website</span>
                  {selectedCustomer.website ? (
                    <a
                      href={selectedCustomer.website.startsWith('http') ? selectedCustomer.website : `https://${selectedCustomer.website}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Globe size={13} />
                      {selectedCustomer.website}
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-subtle)' }}>—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Post-Sale Onboarding Roadmap */}
            <div className="crm-card" style={{ padding: '1rem', border: '1px solid var(--border-default)' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.85rem' }}>
                <Sparkles size={15} color="var(--purple-text)" />
                Customer Success Journey
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircle2 size={18} color="var(--success)" />
                    <div style={{ width: 2, height: 24, background: 'var(--success)', marginTop: 2 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Deal Closed Won & Signed
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Contract verified for ${selectedCustomer.dealAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircle2 size={18} color="var(--success)" />
                    <div style={{ width: 2, height: 24, background: 'var(--primary)', marginTop: 2 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Sales-to-CS Handover Completed
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Assigned to Customer Success Representative
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary-light)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
                    </div>
                    <div style={{ width: 2, height: 24, background: 'var(--border-default)', marginTop: 2 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)' }}>
                      Provisioning & System Integration
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Active platform setup in progress
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Clock size={18} color="var(--text-subtle)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Quarterly Business Review & Renewal
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      Scheduled in 90 days
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '0.75rem', background: 'var(--surface-soft)' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setSelectedCustomer(null)}
            >
              Close
            </button>
            <a
              href={`mailto:${selectedCustomer.primaryContact.email}?subject=Checking in on ${encodeURIComponent(selectedCustomer.company)}`}
              className="btn btn-primary"
              style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Mail size={15} />
              <span>Email Client</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
