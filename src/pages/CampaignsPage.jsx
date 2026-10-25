import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
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
  Sparkles
} from 'lucide-react';

export default function CampaignsPage() {
  const { campaigns, addCampaign, deleteCampaign, isLoadingData } = useCRM();
  const [activeTab, setActiveTab] = useState('All');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [telemetryCampaign, setTelemetryCampaign] = useState(null);

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
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Campaigns
            </h1>
            <span className="badge badge-blue">{campaigns.length} total</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Roadshows, webinars, demand generation, and budget tracking
          </p>
        </div>

        <button
          className="btn btn-primary"
          id="btn-add-campaign"
          onClick={() => setIsCreateModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        >
          <Plus size={16} />
          <span>Add Campaign</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-group" style={{ marginBottom: '1.25rem' }}>
        {['All', 'Active', 'Completed'].map((tab) => (
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
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                          {camp.type}
                        </span>
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
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 2,
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
                      {camp.name}
                    </h3>

                    {/* Spend Progress Bar */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        <span>Budget Spent: ${(camp.spent || 0).toLocaleString()} / ${(camp.budget || 0).toLocaleString()}</span>
                        <span style={{ color: '#2563eb' }}>{spendPct}%</span>
                      </div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, spendPct)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)', borderRadius: 4 }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Leads</span>
                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{camp.leadsGenerated || 0}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Pipeline</span>
                        <strong style={{ fontSize: '1rem', color: '#2563eb' }}>${((camp.pipelineValue || 0) / 1000).toFixed(0)}k</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>ROI</span>
                        <strong style={{ fontSize: '1rem', color: '#10b981' }}>{camp.roi || '0%'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setTelemetryCampaign(camp)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                    >
                      <Activity size={14} color="#2563eb" />
                      <span>View Campaign Telemetry</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#ffffff', borderRadius: 12, border: '1px dashed #cbd5e1', marginTop: '1rem' }}>
              <Megaphone size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                No campaigns found in this view
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
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
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                    Create New Campaign
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Set budget, outreach channel, and target pipeline metrics
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Quick Templates */}
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.03em' }}>
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
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
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
      {/* CAMPAIGN TELEMETRY MODAL                                                  */}
      {/* ========================================================================= */}
      {telemetryCampaign && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1050 }}
          onClick={() => setTelemetryCampaign(null)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                  Campaign Telemetry & Signals
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {telemetryCampaign.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTelemetryCampaign(null)}
                style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Channel Architecture:</span>
                  <strong style={{ fontSize: '0.8125rem', color: '#0f172a' }}>{telemetryCampaign.type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Current Status:</span>
                  <span className={`badge ${telemetryCampaign.status === 'Active' ? 'badge-green' : 'badge-blue'}`}>
                    {telemetryCampaign.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Budget Utilization:</span>
                  <strong style={{ fontSize: '0.8125rem', color: '#2563eb' }}>
                    ${(telemetryCampaign.spent || 0).toLocaleString()} / ${(telemetryCampaign.budget || 0).toLocaleString()}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Estimated ROI:</span>
                  <strong style={{ fontSize: '0.8125rem', color: '#10b981' }}>{telemetryCampaign.roi || '320%'}</strong>
                </div>
              </div>

              <div style={{ padding: '0.85rem', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1d4ed8', fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  <Sparkles size={16} />
                  <span>Dakini AI Telemetry Insight</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#1e40af', margin: 0, lineHeight: 1.45 }}>
                  This campaign is outperforming peer benchmarks by 28%. Conversion velocity is highest with enterprise tier logistics and operations executives. Recommend reallocating unspent budget to inbound retargeting.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTelemetryCampaign(null)}
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
