import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Trophy, RefreshCw, AlertCircle, Activity, Users, GitBranch, TrendingUp } from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { analyticsApi } from '../services/analyticsApi';
import { LeadSourceDonutChart, ConversionFunnelChart, RevenueTrendChart, PipelineStageChart } from '../components/common/Charts';

const PERIOD_BY_LABEL = {
  'Last 7 Days': 'last_7_days',
  'Last 30 Days': 'last_30_days',
  'This Quarter': 'quarter',
  'Year to Date': 'ytd'
};

const EMPTY = {
  overview: null, revenue: [], pipeline: [], sources: { data: [], total_leads: 0 },
  funnel: { data: [] }, activity: null, quota: { data: [] }, pace: { data: [] }
};

function money(value, currency = 'USD') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));
  } catch {
    return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
  }
}

function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="crm-card" style={{ padding: '1rem 1.25rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
        {Icon && <Icon size={18} color="var(--primary)" />}
      </div>
      <div style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 800, marginTop: '0.45rem', overflowWrap: 'anywhere' }}>{value}</div>
      {hint && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function EmptyState({ children = 'No records found for this organization and period.' }) {
  return <div style={{ padding: '1.5rem 1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>{children}</div>;
}

export default function ReportsPage() {
  const { currentUser, navigateTo } = useCRM();
  const [activeReportTab, setActiveReportTab] = useState('Sales');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [reports, setReports] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const period = useMemo(() => PERIOD_BY_LABEL[dateRange] || 'last_30_days', [dateRange]);

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'owner').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const isSalesperson = !isOwner && !isManager;

  const loadReports = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    setError('');
    const requests = await Promise.allSettled([
      analyticsApi.getOverview(period),
      analyticsApi.getRevenueTrend(6),
      analyticsApi.getPipelineByStage(),
      analyticsApi.getLeadSources(period),
      analyticsApi.getConversionFunnel(period),
      analyticsApi.getActivityPerformance(period),
      analyticsApi.getQuotaLeaderboard(period),
      analyticsApi.getTargetPace(period)
    ]);
    const names = ['overview', 'revenue', 'pipeline', 'sources', 'funnel', 'activity', 'quota', 'pace'];
    const next = { ...EMPTY };
    const failures = [];
    requests.forEach((result, index) => {
      const name = names[index];
      if (result.status === 'fulfilled') {
        const payload = result.value;
        if (name === 'revenue' || name === 'pipeline') next[name] = Array.isArray(payload.data) ? payload.data : [];
        else if (name === 'sources') next.sources = payload;
        else if (name === 'funnel') next.funnel = payload;
        else if (name === 'quota') next.quota = payload;
        else if (name === 'pace') next.pace = payload;
        else next[name] = payload;
      } else {
        failures.push(`${name}: ${result.reason instanceof Error ? result.reason.message : 'request failed'}`);
      }
    });
    setReports(next);
    if (failures.length === requests.length) setError(failures.join(' · '));
    else if (failures.length) setError(`Some reports could not load: ${failures.join(' · ')}`);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleExportCSV = async () => {
    const reportByTab = {
      Sales: 'overview',
      Leads: 'lead-sources',
      Activity: 'activity-performance',
      Team: 'quota-leaderboard'
    };
    setExporting(true);
    setExportError('');
    try {
      const blob = await analyticsApi.downloadCsv(reportByTab[activeReportTab], period, 6);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${activeReportTab.toLowerCase()}-performance-${period}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const overview = reports.overview || {};
  const firstPace = reports.pace?.data?.[0];
  const revenueLabel = overview.closed_won_revenue == null && Object.keys(overview.closed_won_revenue_by_currency || {}).length > 1
    ? 'Multiple currencies'
    : money(overview.closed_won_revenue, overview.closed_won_currency || 'USD');
  const tabStyle = (tab) => ({
    padding: '0.65rem 1rem',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    background: activeReportTab === tab ? 'var(--primary-light)' : 'var(--bg-card)',
    color: activeReportTab === tab ? 'var(--primary-dark)' : 'var(--text-body)',
    fontWeight: activeReportTab === tab ? 800 : 600,
    cursor: 'pointer'
  });

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Reports & Pipeline Intelligence</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6 }}>
            {isOwner
              ? 'Database-backed overall company reports from all leads, contacts, deals, activities, and pipelines.'
              : isManager
              ? 'Database-backed team reports from your managed team members and your own leads, contacts, and pipeline.'
              : 'Database-backed personal reports from your assigned leads, contacts, and pipeline deals.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select className="input-field" style={{ width: 155 }} value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="This Quarter">This Quarter</option>
            <option value="Year to Date">Year to Date</option>
          </select>
          <button className="btn btn-secondary" onClick={loadReports} disabled={refreshing} title="Refresh reports">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={exporting}>
            <Download size={15} /> <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Role-Based Scope Indicator Banner */}
      <div style={{
        background: isOwner ? 'linear-gradient(90deg, var(--primary-light) 0%, var(--bg-card) 100%)' : isManager ? 'linear-gradient(90deg, var(--success-bg) 0%, var(--bg-card) 100%)' : 'linear-gradient(90deg, var(--warning-bg) 0%, var(--bg-card) 100%)',
        border: `1px solid ${isOwner ? 'var(--primary-subtle)' : isManager ? 'var(--success-border)' : 'var(--warning-border)'}`,
        borderRadius: 12,
        padding: '0.85rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: isOwner ? '#2563eb' : isManager ? '#059669' : '#d97706',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem'
          }}>
            {isOwner ? '👑' : isManager ? '👥' : '👤'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text-main)' }}>
              {isOwner ? 'Overall Organization Records' : isManager ? 'Managed Team & Personal Records' : 'Personal Assigned Records'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginTop: 2 }}>
              {isOwner
                ? `Displaying overall company records from all leads, contacts, deals, activities, and pipelines across all teams (User: ${currentUser?.name || 'Owner'})`
                : isManager
                ? `Displaying records from your managed team members and your own leads, contacts, and pipeline (User: ${currentUser?.name || 'Manager'})`
                : `Displaying your personal records from your assigned leads, contacts, and pipeline deals (User: ${currentUser?.name || 'Salesperson'})`}
            </div>
          </div>
        </div>
        <span className={`badge ${isOwner ? 'badge-blue' : isManager ? 'badge-green' : 'badge-amber'}`} style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700 }}>
          {isOwner ? 'Scope: Overall Organization' : isManager ? 'Scope: Team Records' : 'Scope: Personal Records'}
        </span>
      </div>

      {error && <div role="alert" style={{ marginBottom: '1rem', padding: '0.85rem 1rem', border: '1px solid var(--danger-border)', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger-text-dark)', fontSize: '0.8125rem' }}><AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}</div>}
      {exportError && <div role="alert" style={{ marginBottom: '1rem', color: 'var(--danger-text-dark)', fontSize: '0.8125rem' }}>{exportError}</div>}
      {loading && <div aria-live="polite" style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.8125rem' }}>Loading analytics from Layer 9…</div>}

      <div className="tab-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {['Sales', 'Leads', 'Activity', 'Team'].map((tab) => <button key={tab} type="button" style={tabStyle(tab)} onClick={() => setActiveReportTab(tab)}>{tab} Performance</button>)}
      </div>

      {activeReportTab === 'Sales' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <StatCard label="Closed-won revenue" value={revenueLabel} hint={`Period: ${dateRange}`} icon={TrendingUp} />
          <StatCard label="Open pipeline" value={money(overview.open_pipeline_value)} hint={`${Number(overview.open_opportunities) || 0} open opportunities`} icon={GitBranch} />
          <StatCard label="Weighted pipeline" value={money(overview.weighted_pipeline_value)} hint="Amount × opportunity probability" icon={TrendingUp} />
          <StatCard label="Deals won" value={overview.deals_won ?? '—'} hint="Closed-won deals in period" icon={Trophy} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Revenue Trajectory</h3><p className="chart-card-subtitle">Monthly closed-won revenue, last six months</p></div></div><RevenueTrendChart data={reports.revenue} /></div>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Pipeline by Stage</h3><p className="chart-card-subtitle">Current open opportunity value</p></div></div><PipelineStageChart data={reports.pipeline} onStageClick={(stageName) => navigateTo(`deals?stage=${encodeURIComponent(stageName)}`, { stage: stageName })} /></div>
        </div>
      </>}

      {activeReportTab === 'Leads' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <StatCard label="Leads created" value={overview.total_leads ?? '—'} hint={`Created during ${dateRange}`} icon={Users} />
          <StatCard label="Converted leads" value={overview.converted_leads ?? '—'} hint={overview.conversion_metric_available ? `${overview.lead_conversion_rate_percent ?? 0}% conversion` : 'Conversion records unavailable'} icon={GitBranch} />
          <StatCard label="Lead sources" value={reports.sources.data?.length ?? 0} hint={`${reports.sources.total_leads ?? 0} leads across returned sources`} icon={TrendingUp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: '1.25rem' }}>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Lead Source Distribution</h3><p className="chart-card-subtitle">Counts and share by stored lead source</p></div></div><LeadSourceDonutChart data={reports.sources.data || []} totalLeads={reports.sources.total_leads} /></div>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Commercial Conversion Funnel</h3><p className="chart-card-subtitle">Counts based on stored lead states and conversion events</p></div></div><ConversionFunnelChart data={reports.funnel.data || []} /><p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{reports.funnel.definitions?.mql_sql || 'Funnel stage availability depends on lead status values configured in the CRM.'}</p></div>
        </div>
      </>}

      {activeReportTab === 'Activity' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <StatCard label="Activities" value={reports.activity?.total_activities ?? '—'} hint={`During ${dateRange}`} icon={Activity} />
          <StatCard label="Completed" value={reports.activity?.completed_activities ?? '—'} hint={`${reports.activity?.completion_rate_percent ?? 0}% completion rate`} icon={TrendingUp} />
          <StatCard label="Activity types" value={reports.activity?.by_type?.length ?? 0} hint="Distinct activity types" icon={GitBranch} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Activities by Type</h3><p className="chart-card-subtitle">Calls, meetings, tasks, emails and other records</p></div></div>
            {reports.activity?.by_type?.length ? reports.activity.by_type.map((item) => {
              const max = Math.max(1, ...reports.activity.by_type.map((v) => v.count));
              return <div key={item.type} style={{ marginBottom: '0.85rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}><span>{item.type}</span><strong>{item.count}</strong></div><div style={{ height: 8, borderRadius: 6, background: 'var(--surface-alt)' }}><div style={{ height: 8, width: `${item.count / max * 100}%`, background: 'var(--primary)', borderRadius: 6 }} /></div></div>;
            }) : <EmptyState>No activity records for this period.</EmptyState>}
          </div>
          <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Activity by Owner</h3><p className="chart-card-subtitle">Assigned and unassigned activity counts</p></div></div>
            {reports.activity?.by_owner?.length ? <div style={{ overflowX: 'auto' }}><table className="crm-table"><thead><tr><th>Owner</th><th>Activities</th><th>Completed</th></tr></thead><tbody>{reports.activity.by_owner.map((item) => <tr key={item.user_id || item.name}><td>{item.name}</td><td>{item.activity_count}</td><td>{item.completed_count}</td></tr>)}</tbody></table></div> : <EmptyState>No owner-level activity data available.</EmptyState>}
          </div>
        </div>
      </>}

      {activeReportTab === 'Team' && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <StatCard label="Quota records" value={reports.quota.data?.length ?? 0} hint={`Matching ${dateRange}`} icon={Users} />
          <StatCard label="Total target" value={reports.quota.data?.length ? (new Set(reports.quota.data.map((r) => r.currency)).size > 1 ? 'Multiple currencies' : money(reports.quota.data.reduce((sum, r) => sum + (Number(r.target_amount) || 0), 0), reports.quota.data[0].currency || 'USD')) : '—'} hint="Currency groups are kept separate" icon={Trophy} />
          <StatCard label="Target pace" value={(reports.pace.data?.length || 0) > 1 ? 'Multiple currencies' : firstPace?.attainment_percent == null ? '—' : `${firstPace.attainment_percent}%`} hint={(reports.pace.data?.length || 0) > 1 ? 'Currency groups are kept separate' : firstPace?.ahead_or_behind == null ? 'No target available' : `${money(firstPace.ahead_or_behind, firstPace.currency || 'USD')} vs linear pace`} icon={TrendingUp} />
        </div>
        <div className="crm-card"><div className="chart-card-header"><div><h3 className="chart-card-title">Quota Leaderboard</h3><p className="chart-card-subtitle">Won revenue, configured targets and open pipeline by owner</p></div></div>
          {reports.quota.data?.length ? <div style={{ overflowX: 'auto' }}><table className="crm-table"><thead><tr><th>Rank</th><th>Salesperson</th><th>Target</th><th>Won Revenue</th><th>Deals Won</th><th>Pipeline</th><th>Attainment</th></tr></thead><tbody>{reports.quota.data.map((rep, index) => <tr key={`${rep.user_id}-${rep.currency}`}><td>#{index + 1}</td><td>{rep.name}</td><td>{money(rep.target_amount, rep.currency)}</td><td>{money(rep.won_revenue, rep.currency)}</td><td>{rep.deals_won}</td><td>{money(rep.open_pipeline_value, rep.currency)}</td><td><strong>{rep.attainment_percent == null ? '—' : `${rep.attainment_percent}%`}</strong><div style={{ height: 5, background: 'var(--border-default)', borderRadius: 4, marginTop: 5, minWidth: 60 }}><div style={{ height: 5, width: `${Math.max(0, Math.min(100, Number(rep.attainment_percent) || 0))}%`, background: 'var(--primary)', borderRadius: 4 }} /></div></td></tr>)}</tbody></table></div> : <EmptyState>No matching sales targets found. Add active sales target records for this organization to populate the leaderboard.</EmptyState>}
          {reports.quota.note && <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{reports.quota.note}</p>}
        </div>
      </>}
    </div>
  );
}
