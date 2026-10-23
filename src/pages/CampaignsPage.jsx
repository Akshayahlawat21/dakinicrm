import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Megaphone,
  Plus,
  DollarSign,
  TrendingUp,
  Users,
  Target,
  CheckCircle,
  Calendar
} from 'lucide-react';

export default function CampaignsPage() {
  const { campaigns } = useCRM();
  const [activeTab, setActiveTab] = useState('All');

  const filtered = campaigns.filter((c) => {
    if (activeTab === 'Active') return c.status === 'Active';
    if (activeTab === 'Completed') return c.status === 'Completed';
    return true;
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
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
            Roadshows, webinars, and budget tracking
          </p>
        </div>

        <button className="btn btn-primary">
          <Plus size={16} />
          <span>Add Campaign</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-group">
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

      {/* Campaign Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {filtered.map((camp) => {
          const spendPct = Math.round((camp.spent / camp.budget) * 100);

          return (
            <div key={camp.id} className="crm-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className={`badge ${camp.status === 'Active' ? 'badge-green' : 'badge-blue'}`}>
                    <span className="badge-dot" />
                    {camp.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                    {camp.type}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem' }}>
                  {camp.name}
                </h3>

                {/* Spend Progress Bar */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                    <span>Budget Spent: ${camp.spent.toLocaleString()} / ${camp.budget.toLocaleString()}</span>
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
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{camp.leadsGenerated}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>Pipeline</span>
                    <strong style={{ fontSize: '1rem', color: '#2563eb' }}>${(camp.pipelineValue / 1000).toFixed(0)}k</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', display: 'block' }}>ROI</span>
                    <strong style={{ fontSize: '1rem', color: '#10b981' }}>{camp.roi}</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm">
                  View Campaign Telemetry
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
