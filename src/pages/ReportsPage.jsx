import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  LeadSourceDonutChart,
  ConversionFunnelChart,
  RevenueTrendChart
} from '../components/common/Charts';
import {
  BarChart3,
  Download,
  Calendar,
  Share2,
  Mail,
  Trophy,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { teamPerformance } from '../data/mockData';

export default function ReportsPage() {
  const [activeReportTab, setActiveReportTab] = useState('Sales');
  const [dateRange, setDateRange] = useState('Last 30 Days');

  const handleExportCSV = () => {
    alert("Exporting analytics dataset to CSV / Salesforce Data Loader format...");
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Reports & Pipeline Intelligence
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Comprehensive analytics, lead conversion funnels and rep quota attainment
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="input-field"
            style={{ width: 150 }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="This Quarter">This Quarter</option>
            <option value="Year to Date">Year to Date</option>
          </select>

          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group">
        {['Sales', 'Leads', 'Activity', 'Team'].map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeReportTab === t ? 'active' : ''}`}
            onClick={() => setActiveReportTab(t)}
          >
            {t} Performance
          </button>
        ))}
      </div>

      {/* Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Lead Source Donut Chart */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Lead Source Distribution</h3>
              <p className="chart-card-subtitle">Channel attribution across 248 prospective accounts</p>
            </div>
            <span className="badge badge-blue">Donut View</span>
          </div>
          <LeadSourceDonutChart />
        </div>

        {/* Conversion Funnel */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Commercial Conversion Funnel</h3>
              <p className="chart-card-subtitle">From inbound inquiries to closed won enterprise contracts</p>
            </div>
            <span className="badge badge-green">Funnel Velocity</span>
          </div>
          <ConversionFunnelChart />
        </div>
      </div>

      {/* Bottom Grid: Revenue Trend + Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem' }}>
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Revenue Trajectory vs Pace</h3>
              <p className="chart-card-subtitle">Actual closed revenue vs required quarterly pacing</p>
            </div>
          </div>
          <RevenueTrendChart />
        </div>

        {/* Leaderboard */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={18} color="#2563eb" />
              <h3 className="chart-card-title">Quota Leaderboard</h3>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {teamPerformance.map((rep, idx) => (
              <div
                key={rep.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  borderRadius: 8,
                  background: idx === 1 ? '#eff6ff' : '#f8fafc',
                  border: idx === 1 ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: idx === 1 ? '#2563eb' : '#64748b',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{rep.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Quota: ${rep.target.toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#2563eb' }}>
                    {rep.progress}%
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600 }}>
                    {rep.won} deals won
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
