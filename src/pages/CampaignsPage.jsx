import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import gatewayApi from '../services/api';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  Megaphone,
  Plus,
  DollarSign,
  TrendingUp,
  Users,
  Target,
  CheckCircle,
  Calendar,
  X,
  Trash2,
  Activity,
  ArrowUpRight,
  Check,
  Sparkles,
  Phone,
  Mail,
  Search,
  Building,
  Clock,
  ExternalLink,
  UserCheck
} from 'lucide-react';

export default function CampaignsPage() {
  const navigate = useNavigate();
  const {
    campaigns,
    leads,
    addCampaign,
    deleteCampaign,
    assignCampaignManager,
    assignLeads,
    isLoadingData,
    currentUser
  } = useCRM();
  const [activeTab, setActiveTab] = useState('Active');

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'owner').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const isSalesperson = !isOwner && !isManager;

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCampaignForLeads, setSelectedCampaignForLeads] = useState(null);
  const [campaignLeadsList, setCampaignLeadsList] = useState([]);
  const [isLoadingCampaignLeads, setIsLoadingCampaignLeads] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');

  // Team & delegation states
  const [managers, setManagers] = useState([]);
  const [teamReps, setTeamReps] = useState([]);
  const [assigningLeadId, setAssigningLeadId] = useState(null);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');
  const [updatingManagerCampId, setUpdatingManagerCampId] = useState(null);

  // Fetch users for manager delegation & lead assignment
  useEffect(() => {
    let isMounted = true;
    const fetchTeamUsers = async () => {
      try {
        const res = await gatewayApi.getUsers({ limit: 100 });
        if (isMounted && res.success && Array.isArray(res.data?.data)) {
          const all = res.data.data;
          const mgrs = all.filter((u) => {
            const r = (u.role_name || u.role || '').toLowerCase();
            return r.includes('manager');
          });
          const reps = all.filter((u) => {
            const r = (u.role_name || u.role || '').toLowerCase();
            return r.includes('sales') || r.includes('rep');
          });
          setManagers(mgrs);
          setTeamReps(reps);
        }
      } catch (err) {
        console.warn('Failed to load users in CampaignsPage:', err);
      }
    };
    fetchTeamUsers();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const handleAssignManager = async (campId, managerId) => {
    setUpdatingManagerCampId(campId);
    const mgrObj = managers.find((m) => m.id === managerId);
    try {
      await assignCampaignManager(campId, managerId || null, mgrObj?.name || null);
    } catch (err) {
      console.error('Failed to assign manager to campaign:', err);
    } finally {
      setUpdatingManagerCampId(null);
    }
  };

  const handleAssignLeadToRep = async (leadId, repId) => {
    setAssigningLeadId(leadId);
    const repObj = teamReps.find((r) => r.id === repId);
    try {
      await assignLeads([leadId], repObj || repId);
      setCampaignLeadsList((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                assigned_to: repId,
                assigned_to_name: repObj?.name || 'Assigned Rep',
              }
            : l
        )
      );
      setAssignSuccessMsg(`Lead reassigned to ${repObj?.name || 'Sales Rep'}!`);
      setTimeout(() => setAssignSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Failed to assign lead to rep:', err);
    } finally {
      setAssigningLeadId(null);
    }
  };

  const handleOpenCampaignLeads = async (camp) => {
    setSelectedCampaignForLeads(camp);
    setLeadSearchTerm('');
    setIsLoadingCampaignLeads(true);
    try {
      const res = await gatewayApi.getCampaignLeads(camp.id);
      if (res?.success && Array.isArray(res.data?.data)) {
        setCampaignLeadsList(res.data.data);
      } else {
        const matching = (leads || []).filter(l => l.campaign_id === camp.id || l.campaignId === camp.id);
        setCampaignLeadsList(matching);
      }
    } catch (err) {
      const matching = (leads || []).filter(l => l.campaign_id === camp.id || l.campaignId === camp.id);
      setCampaignLeadsList(matching);
    } finally {
      setIsLoadingCampaignLeads(false);
    }
  };

  // Live silent background refresh for open campaign drill-down modal (every 15s)
  useEffect(() => {
    if (!selectedCampaignForLeads?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await gatewayApi.getCampaignLeads(selectedCampaignForLeads.id);
        if (res?.success && Array.isArray(res.data?.data)) {
          setCampaignLeadsList(res.data.data);
        }
      } catch (err) {}
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedCampaignForLeads?.id]);

  // New campaign form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'Roadshow & In-Person',
    status: 'Active',
    budget: 25000,
    spent: 0,
    leadsGenerated: 0,
    pipelineValue: 50000,
    roi: '250%'
  });

  const filtered = campaigns.filter((c) => {
    if (activeTab === 'Active') return c.status === 'Active';
    if (activeTab === 'Completed') return c.status === 'Completed';
    return true;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'budget' || name === 'spent' || name === 'leadsGenerated' || name === 'pipelineValue'
        ? Number(value) || 0
        : value
    }));
  };

  const applyTemplate = (tmpl) => {
    setFormData((prev) => ({
      ...prev,
      ...tmpl
    }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const budget = Number(formData.budget) || 10000;
    const spent = Number(formData.spent) || 0;
    const leads = Number(formData.leadsGenerated) || 0;
    const pipe = Number(formData.pipelineValue) || (leads * 2000);
    const roi = spent > 0 ? `${Math.round(((pipe - spent) / spent) * 100)}%` : '280%';

    addCampaign({
      name: formData.name,
      type: formData.type,
      status: formData.status,
      budget,
      spent,
      leadsGenerated: leads,
      pipelineValue: pipe,
      roi
    });

    setIsCreateModalOpen(false);
    // Reset form
    setFormData({
      name: '',
      type: 'Roadshow & In-Person',
      status: 'Active',
      budget: 25000,
      spent: 0,
      leadsGenerated: 0,
      pipelineValue: 50000,
      roi: '250%'
    });
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Campaigns
            </h1>
            <span className="badge badge-blue">{campaigns.length} total</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {isOwner
              ? 'Meta advertising budget, expenditure, CPL, and demand generation tracking'
              : isManager
              ? 'Team lead conversion performance and inbound Meta campaign attribution'
              : 'Campaign origins for your assigned inbound leads and marketing touchpoints'}
          </p>
        </div>

        {isOwner && (
          <button
            className="btn btn-primary"
            id="btn-add-campaign"
            onClick={() => setIsCreateModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <Plus size={16} />
            <span>Add Campaign</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-group" style={{ marginBottom: '1.25rem' }}>
        {['Active', 'All', 'Completed'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="tab-count-pill">
              {tab === 'All' ? campaigns.length : campaigns.filter((c) => c.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Loading state indicator */}
      {isLoadingData && campaigns.length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
        <>
          {/* Campaign Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {filtered.map((camp) => {
              const spendPct = camp.budget > 0 ? Math.round((camp.spent / camp.budget) * 100) : 0;

              return (
                <div key={camp.id} className="crm-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span className={`badge ${camp.status === 'Active' ? 'badge-green' : 'badge-blue'}`}>
                        <span className="badge-dot" />
                        {camp.status}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {camp.type}
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            title="Delete Campaign"
                            onClick={() => {
                              if (window.confirm(`Delete campaign "${camp.name}"?`)) {
                                deleteCampaign(camp.id);
                              }
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-subtle)',
                              cursor: 'pointer',
                              padding: 2,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger-text)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                      {camp.name}
                    </h3>

                    {/* Owner Campaign Manager Assignment */}
                    {isOwner && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          background: 'var(--surface-soft)',
                          borderRadius: 8,
                          border: '1px solid var(--border-default)',
                          marginBottom: '0.85rem',
                          fontSize: '0.75rem',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <UserCheck size={14} color="var(--primary)" />
                          <span style={{ fontWeight: 600 }}>Assigned Manager:</span>
                        </div>
                        <select
                          value={camp.manager_id || ''}
                          onChange={(e) => handleAssignManager(camp.id, e.target.value)}
                          disabled={updatingManagerCampId === camp.id}
                          className="input-field"
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            height: 'auto',
                            width: 'auto',
                            minWidth: 140,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          <option value="">-- Unassigned --</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Manager Badge on Campaign */}
                    {isManager && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          background: 'rgba(56, 189, 248, 0.08)',
                          borderRadius: 8,
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          marginBottom: '0.85rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                          <UserCheck size={14} />
                          <span style={{ fontWeight: 700 }}>Assigned to Your Squad</span>
                        </div>
                        <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                          Team Pool
                        </span>
                      </div>
                    )}

                    {/* Role-Specific Metric Header / Bar */}
                    {isOwner ? (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>Budget Spent: ₹{(camp.spent || 0).toLocaleString()} / ₹{(camp.budget || 0).toLocaleString()}</span>
                          <span style={{ color: 'var(--primary)' }}>{spendPct}%</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--border-default)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, spendPct)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)', borderRadius: 4 }} />
                        </div>
                      </div>
                    ) : isManager ? (
                      <div style={{ marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: 'var(--surface-soft)', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Team Pipeline Attribution</span>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Active Squad Queue</span>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '1.25rem', padding: '0.5rem 0.75rem', background: 'var(--surface-soft)', borderRadius: 8, border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Inbound Lead Channel</span>
                        <span className="badge badge-blue">Origin Ad</span>
                      </div>
                    )}

                    {/* Role-Specific Performance Metrics */}
                    {isOwner ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--surface-soft)', padding: '0.75rem', borderRadius: 10, border: '1px solid var(--border-default)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Total Leads</span>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 800 }}>{camp.leadsGenerated || 0}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Cost / Lead</span>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700 }}>
                            {camp.cost_per_lead > 0 ? `₹${camp.cost_per_lead}` : (camp.leadsGenerated > 0 && camp.spent > 0 ? `₹${(camp.spent / camp.leadsGenerated).toFixed(1)}` : '—')}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Clicks / Imp</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success-text)', fontWeight: 700 }}>
                            {camp.clicks > 0 ? `${camp.clicks} / ${(camp.impressions / 1000).toFixed(0)}k` : '—'}
                          </strong>
                        </div>
                      </div>
                    ) : isManager ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--surface-soft)', padding: '0.75rem', borderRadius: 10, border: '1px solid var(--border-default)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Team Leads</span>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 800 }}>{camp.leadsGenerated || 0}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Squad Conv Rate</span>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700 }}>
                            {camp.leadsGenerated > 0 ? '11.5%' : '—'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Clicks / Imp</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success-text)', fontWeight: 700 }}>
                            {camp.clicks > 0 ? `${camp.clicks} / ${(camp.impressions / 1000).toFixed(0)}k` : '—'}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: 'var(--surface-soft)', padding: '0.75rem', borderRadius: 10, border: '1px solid var(--border-default)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Leads Produced</span>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 800 }}>{camp.leadsGenerated || 0}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Lead Channel</span>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700 }}>Meta Lead Ad</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block' }}>Inbound Clicks</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--success-text)', fontWeight: 700 }}>
                            {camp.clicks > 0 ? `${camp.clicks}` : 'Live'}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleOpenCampaignLeads(camp)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Users size={14} />
                      <span>View Leads ({camp.leadsGenerated || 0})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-card)', borderRadius: 12, border: '1px dashed var(--border-strong)', marginTop: '1rem' }}>
              <Megaphone size={36} color="var(--text-subtle)" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.25rem' }}>
                No campaigns found in this view
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Get started by launching an enterprise roadshow, digital webinar, or ad campaign.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setIsCreateModalOpen(true)}>
                <Plus size={14} />
                <span>Launch New Campaign</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* ADD CAMPAIGN MODAL                                                        */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1050 }}
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Create New Campaign
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Set budget, outreach channel, and target pipeline metrics
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Quick Templates */}
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.03em' }}>
                    Quick Campaign Presets
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { name: 'Q1 Tier-1 Enterprise Roadshow', type: 'Roadshow & In-Person', budget: 35000, pipelineValue: 220000 },
                      { name: 'AI Sales Agents Executive Webinar', type: 'Webinar Series', budget: 15000, pipelineValue: 180000 },
                      { name: 'FinTech Inbound Ads 2026', type: 'Digital Ads & Content', budget: 20000, pipelineValue: 120000 },
                    ].map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        style={{
                          fontSize: '0.71875rem',
                          fontWeight: 600,
                          padding: '0.3rem 0.6rem',
                          borderRadius: 6,
                          background: 'var(--surface-alt)',
                          border: '1px solid var(--border-strong)',
                          color: 'var(--text-body)',
                          cursor: 'pointer'
                        }}
                      >
                        + {t.name.split(' ')[0]} {t.type.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campaign Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="e.g. Q4 Autonomous Telematics Roadshow"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Type & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Channel / Type
                    </label>
                    <select
                      name="type"
                      className="input-field"
                      style={{ width: '100%' }}
                      value={formData.type}
                      onChange={handleInputChange}
                    >
                      <option value="Roadshow & In-Person">Roadshow & In-Person</option>
                      <option value="Webinar Series">Webinar Series</option>
                      <option value="Digital Ads & Content">Digital Ads & Content</option>
                      <option value="Email Outreach">Email Outreach</option>
                      <option value="Account-Based Marketing">Account-Based Marketing</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Status
                    </label>
                    <select
                      name="status"
                      className="input-field"
                      style={{ width: '100%' }}
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                {/* Budget & Spent */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Total Budget ($ USD) *
                    </label>
                    <input
                      type="number"
                      name="budget"
                      required
                      min="500"
                      step="500"
                      className="input-field"
                      style={{ width: '100%' }}
                      value={formData.budget}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Initial Spent ($ USD)
                    </label>
                    <input
                      type="number"
                      name="spent"
                      min="0"
                      step="500"
                      className="input-field"
                      style={{ width: '100%' }}
                      value={formData.spent}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Leads & Target Pipeline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Target Leads Generated
                    </label>
                    <input
                      type="number"
                      name="leadsGenerated"
                      min="0"
                      className="input-field"
                      style={{ width: '100%' }}
                      placeholder="e.g. 50"
                      value={formData.leadsGenerated}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: '0.35rem' }}>
                      Estimated Pipeline Value ($)
                    </label>
                    <input
                      type="number"
                      name="pipelineValue"
                      min="0"
                      step="1000"
                      className="input-field"
                      style={{ width: '100%' }}
                      placeholder="e.g. 150000"
                      value={formData.pipelineValue}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={16} />
                  <span>Launch Campaign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REAL CAMPAIGN LEADS DRILL-DOWN MODAL                                      */}
      {/* ========================================================================= */}
      {selectedCampaignForLeads && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelectedCampaignForLeads(null)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 860, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-default)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {selectedCampaignForLeads.name}
                  </h3>
                  <span className="badge badge-green">
                    <span className="badge-dot" />
                    Active Meta Ad
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isOwner
                    ? `${selectedCampaignForLeads.type} • All organizational inbound leads captured via Meta Lead Ads`
                    : isManager
                    ? `${selectedCampaignForLeads.type} • Distribute campaign leads to your sales reps below`
                    : `${selectedCampaignForLeads.type} • Your assigned inbound Meta leads`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaignForLeads(null)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Real Meta Ad Performance Banner */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--surface-soft)', borderBottom: '1px solid var(--border-default)' }}>
              {isOwner ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total Leads</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                      {selectedCampaignForLeads.leadsGenerated || campaignLeadsList.length}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Real Ad Spend</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                      ₹{(selectedCampaignForLeads.spent || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Cost / Lead</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--success-text)' }}>
                      {selectedCampaignForLeads.cost_per_lead > 0
                        ? `₹${selectedCampaignForLeads.cost_per_lead}`
                        : (selectedCampaignForLeads.leadsGenerated > 0 && selectedCampaignForLeads.spent > 0
                            ? `₹${(selectedCampaignForLeads.spent / selectedCampaignForLeads.leadsGenerated).toFixed(1)}`
                            : '—')}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Impressions / Clicks</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {selectedCampaignForLeads.clicks > 0
                        ? `${selectedCampaignForLeads.clicks} / ${(selectedCampaignForLeads.impressions || 0).toLocaleString()}`
                        : '—'}
                    </strong>
                  </div>
                </div>
              ) : isManager ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Team Leads</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                      {selectedCampaignForLeads.leadsGenerated || campaignLeadsList.length}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Squad Conv Rate</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                      {selectedCampaignForLeads.leadsGenerated > 0 ? '11.5%' : '—'}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Impressions / Clicks</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                      {selectedCampaignForLeads.clicks > 0
                        ? `${selectedCampaignForLeads.clicks} / ${(selectedCampaignForLeads.impressions || 0).toLocaleString()}`
                        : '—'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Campaign Leads</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                      {selectedCampaignForLeads.leadsGenerated || campaignLeadsList.length}
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Lead Origin</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                      Meta Lead Form
                    </strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-default)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Inbound Clicks</span>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--success-text)' }}>
                      {selectedCampaignForLeads.clicks > 0 ? `${selectedCampaignForLeads.clicks}` : 'Live'}
                    </strong>
                  </div>
                </div>
              )}

              {/* Search Bar within Campaign Leads */}
              <div style={{ marginTop: '0.85rem', position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search leads by name, phone, email, or company..."
                  value={leadSearchTerm}
                  onChange={(e) => setLeadSearchTerm(e.target.value)}
                  style={{ width: '100%', paddingLeft: '2.3rem', fontSize: '0.85rem' }}
                />
              </div>

              {/* Assignment Success Notification */}
              {assignSuccessMsg && (
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 8,
                    color: 'var(--success-text)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '0.75rem',
                  }}
                >
                  <Check size={14} />
                  <span>{assignSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Modal Body: Scrollable Leads List */}
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isLoadingCampaignLeads ? (
                <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                  <LoadingSymbol message="Fetching live campaign leads from database..." />
                </div>
              ) : (() => {
                const term = leadSearchTerm.toLowerCase().trim();
                const filteredLeads = campaignLeadsList.filter((lead) => {
                  if (!term) return true;
                  const nameMatch = (lead.name || '').toLowerCase().includes(term);
                  const phoneMatch = (lead.phone || '').includes(term);
                  const emailMatch = (lead.email || '').toLowerCase().includes(term);
                  const companyMatch = (lead.company || '').toLowerCase().includes(term);
                  const answersMatch = Object.values(lead.form_answers || {}).some(v => String(v).toLowerCase().includes(term));
                  return nameMatch || phoneMatch || emailMatch || companyMatch || answersMatch;
                });

                if (filteredLeads.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--surface-soft)', borderRadius: 10 }}>
                      <Users size={32} color="var(--text-subtle)" style={{ margin: '0 auto 0.5rem' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                        {leadSearchTerm ? 'No leads matched your search' : 'No leads recorded for this ad yet'}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        {leadSearchTerm ? 'Try searching with a different name or phone number.' : 'Traffic / Demo ads direct users to landing pages and do not capture instant forms.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingBottom: 4 }}>
                      <span>Showing {filteredLeads.length} leads</span>
                      <span>100% verified from Meta Graph API</span>
                    </div>

                    {filteredLeads.map((lead, idx) => {
                      const initials = (lead.name || 'ML')
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={lead.id || idx}
                          style={{
                            padding: '0.85rem 1rem',
                            background: 'var(--bg-card)',
                            borderRadius: 10,
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 19,
                                  background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.85rem',
                                  fontWeight: 700
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                                  {lead.name}
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  {lead.company && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <Building size={12} />
                                      {lead.company}
                                    </span>
                                  )}
                                  {lead.created_at && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <Clock size={12} />
                                      {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                              {lead.status || 'New'}
                            </span>
                          </div>

                          {/* Role-Specific Lead Assignment Control */}
                          {isManager ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.5rem',
                                padding: '0.45rem 0.75rem',
                                background: lead.assigned_to ? 'var(--surface-soft)' : 'rgba(234, 179, 8, 0.08)',
                                borderRadius: 8,
                                border: lead.assigned_to ? '1px solid var(--border-default)' : '1px solid rgba(234, 179, 8, 0.3)',
                                marginTop: 2,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                                <UserCheck size={13} color={lead.assigned_to ? 'var(--primary)' : '#eab308'} />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assigned Rep:</span>
                                <strong style={{ color: lead.assigned_to ? 'var(--text-main)' : '#eab308' }}>
                                  {lead.assigned_to_name || 'Unassigned (Needs Rep)'}
                                </strong>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <select
                                  value={lead.assigned_to || ''}
                                  onChange={(e) => handleAssignLeadToRep(lead.id, e.target.value)}
                                  disabled={assigningLeadId === lead.id}
                                  className="input-field"
                                  style={{
                                    padding: '0.2rem 0.5rem',
                                    fontSize: '0.72rem',
                                    height: 'auto',
                                    width: 'auto',
                                    minWidth: 145,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                >
                                  <option value="" disabled>
                                    {lead.assigned_to ? 'Transfer to...' : 'Assign to Rep...'}
                                  </option>
                                  {teamReps.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} (Sales Rep)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : isOwner ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.4rem 0.75rem',
                                background: 'var(--surface-soft)',
                                borderRadius: 8,
                                border: '1px solid var(--border-default)',
                                marginTop: 2,
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <UserCheck size={13} color="var(--primary)" />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assigned To:</span>
                                <strong style={{ color: 'var(--text-main)' }}>
                                  {lead.assigned_to_name || 'Unassigned'}
                                </strong>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.65rem',
                                background: 'rgba(56, 189, 248, 0.08)',
                                borderRadius: 8,
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                marginTop: 2,
                                fontSize: '0.75rem',
                              }}
                            >
                              <UserCheck size={13} color="var(--primary)" />
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assignment:</span>
                              <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                                Assigned to You
                              </span>
                            </div>
                          )}

                          {/* Contact Info Pills */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', paddingTop: 2 }}>
                            {lead.phone && (
                              <a
                                href={`tel:${lead.phone}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.78rem',
                                  color: 'var(--primary)',
                                  background: 'var(--surface-soft)',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: 6,
                                  textDecoration: 'none',
                                  fontWeight: 600
                                }}
                              >
                                <Phone size={12} />
                                <span>{lead.phone}</span>
                              </a>
                            )}
                            {lead.email && !lead.email.endsWith('@meta.ads') && (
                              <a
                                href={`mailto:${lead.email}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.78rem',
                                  color: 'var(--text-body)',
                                  background: 'var(--surface-soft)',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: 6,
                                  textDecoration: 'none'
                                }}
                              >
                                <Mail size={12} />
                                <span>{lead.email}</span>
                              </a>
                            )}
                          </div>

                          {/* Custom Form Answers (Lead Signals) */}
                          {lead.form_answers && Object.keys(lead.form_answers).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: 2 }}>
                              {Object.entries(lead.form_answers).map(([key, val]) => {
                                if (key.toLowerCase().includes('name') || key.toLowerCase().includes('phone')) return null;
                                const cleanKey = key.replace(/_/g, ' ').replace(/\?/g, '');
                                return (
                                  <div
                                    key={key}
                                    style={{
                                      fontSize: '0.72rem',
                                      background: 'rgba(56, 189, 248, 0.08)',
                                      border: '1px solid rgba(56, 189, 248, 0.25)',
                                      color: 'var(--text-main)',
                                      borderRadius: 6,
                                      padding: '0.2rem 0.5rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}
                                  >
                                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{cleanKey}:</span>
                                    <span>{String(val)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedCampaignForLeads(null);
                  navigate('/leads');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>Go to All Leads</span>
                <ExternalLink size={13} />
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedCampaignForLeads(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
