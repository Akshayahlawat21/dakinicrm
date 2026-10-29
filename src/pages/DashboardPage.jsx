import React, { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../services/analyticsApi';
import { useCRM } from '../context/CRMContext';
import {
  Sparkline,
  RadialProgressDonut,
  RevenueTrendChart,
  PipelineStageChart
} from '../components/common/Charts';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  Target,
  Trophy,
  CheckCircle,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  Clock,
  ChevronRight,
  Calendar,
  AlertCircle
} from 'lucide-react';


let _dashboardMemoryCache = null;

export default function DashboardPage() {
  const {
    navigateTo,
    tasks,
    toggleTask,
    approvals,
    approveItem,
    deals,
    setIsAgentDockOpen,
    sendAgentMessage,
    currentUser,
  } = useCRM();

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'owner').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const greetingName = currentUser?.name ? currentUser.name.split(' ')[0] : 'there';

  const [period, setPeriod] = useState('This month');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(() => _dashboardMemoryCache?.data || { overview: null, revenue: [], pipeline: [], team: [], targetPace: [] });
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsLoading, setAnalyticsLoading] = useState(() => !_dashboardMemoryCache?.data);
  const periodKey = ({ 'This week': 'week', 'This month': 'month', 'This quarter': 'quarter', 'Year to date': 'ytd' })[period] || 'month';

  const loadAnalytics = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && _dashboardMemoryCache?.periodKey === periodKey && (Date.now() - _dashboardMemoryCache.time < 60000)) {
      setAnalytics(_dashboardMemoryCache.data);
      setAnalyticsLoading(false);
      return;
    }
    setIsRefreshing(true);
    if (!_dashboardMemoryCache?.data) {
      setAnalyticsLoading(true);
    }
    setAnalyticsError('');
    try {
      const results = await Promise.allSettled([
        analyticsApi.getOverview(periodKey),
        analyticsApi.getRevenueTrend(6),
        analyticsApi.getPipelineByStage(),
        analyticsApi.getQuotaLeaderboard(periodKey),
        analyticsApi.getTargetPace(periodKey)
      ]);
      const [overviewRes, revenueRes, pipelineRes, teamRes, targetPaceRes] = results;
      const nextData = {
        overview: overviewRes.status === 'fulfilled' ? overviewRes.value : null,
        revenue: revenueRes.status === 'fulfilled' && Array.isArray(revenueRes.value?.data) ? revenueRes.value.data : [],
        pipeline: pipelineRes.status === 'fulfilled' && Array.isArray(pipelineRes.value?.data) ? pipelineRes.value.data : [],
        team: teamRes.status === 'fulfilled' && Array.isArray(teamRes.value?.data) ? teamRes.value.data : [],
        targetPace: targetPaceRes.status === 'fulfilled' && Array.isArray(targetPaceRes.value?.data) ? targetPaceRes.value.data : []
      };
      setAnalytics(nextData);
      _dashboardMemoryCache = { periodKey, time: Date.now(), data: nextData };
      if (overviewRes.status === 'rejected') {
        setAnalyticsError(overviewRes.reason instanceof Error ? overviewRes.reason.message : 'Unable to load analytics overview.');
      }
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Unable to load analytics.');
    } finally {
      setAnalyticsLoading(false);
      setIsRefreshing(false);
    }
  }, [periodKey]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  const overview = analytics.overview || {};
  const money = (value, currency = 'USD') => {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
    } catch {
      return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
    }
  };
  const wonCurrency = overviewCurrency => overviewCurrency || 'USD';
  const revenueLabel = overview.closed_won_revenue == null && Object.keys(overview.closed_won_revenue_by_currency || {}).length > 1
    ? 'Multiple currencies'
    : money(overview.closed_won_revenue, wonCurrency(overview.closed_won_currency));
  const handleRefresh = () => {
    analyticsApi.clearCache();
    loadAnalytics(true);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header Banner */}
      <div className="dashboard-header">
        <div>
          <div className="header-meta-date">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} • Live Sales telemetry
          </div>
          <h1 className="header-greeting-title">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {greetingName}
          </h1>
          <p className="header-subtitle">
            {isOwner
              ? 'Here is your overall company commercial snapshot and pipeline acceleration summary.'
              : isManager
              ? 'Here is your managed team pipeline performance and team target attainment.'
              : 'Here is your personal pipeline overview, assigned leads, and daily task focus.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="input-field"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 140, fontWeight: 600 }}
          >
            <option value="This week">This week</option>
            <option value="This month">This month</option>
            <option value="This quarter">This quarter</option>
            <option value="Year to date">Year to date</option>
          </select>

          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            title="Refresh Layer 9 analytics"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh metrics</span>
          </button>
        </div>
      </div>

      {analyticsError && <div role="alert" style={{ marginBottom: '1rem', padding: '0.85rem 1rem', border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: '0.875rem' }}>
        <strong>Analytics unavailable.</strong> {analyticsError} Check the Layer 9 service, tenant configuration, and gateway route, then refresh.
      </div>}
      {analyticsLoading && <div aria-live="polite" style={{ marginBottom: '0.75rem', color: '#64748b', fontSize: '0.8125rem' }}>Loading live Layer 9 analytics...</div>}

      {/* Row 1: Primary KPI Cards */}
      <div className="kpi-grid-top">
        {/* KPI 1: Total Revenue with Sparkline */}
        <div className="kpi-card" onClick={() => navigateTo('deals')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="kpi-title">Total revenue</div>
            <div className="kpi-value">{analyticsLoading ? '—' : revenueLabel}</div>
            <div className="kpi-subtext">
              <span className="badge badge-green"><ArrowUpRight size={12} />Database-backed</span>
              <span>{Number(overview.deals_won) || 0} deals won in period</span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Sparkline points={(analytics.revenue.length ? analytics.revenue : [{ revenue: 0 }]).map((item) => Number(item.revenue) || 0)} color="#2563eb" width={140} height={42} />
          </div>
        </div>

        {/* KPI 2: Active Pipeline with bar */}
        <div className="kpi-card" onClick={() => navigateTo('deals')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="kpi-title">Active pipeline</div>
            <div className="kpi-value">{analyticsLoading ? '—' : money(overview.open_pipeline_value)}</div>
            <div className="kpi-subtext">
              <span style={{ fontWeight: 600, color: '#2563eb' }}>{Number(overview.open_opportunities) || 0} open opportunities</span>
              <span>• Live Layer 9 data</span>
            </div>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
              <span>Weighted pipeline value</span>
              <span style={{ color: '#0f172a' }}>{money(overview.weighted_pipeline_value)}</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(100, Number(overview.open_pipeline_value) ? (Number(overview.weighted_pipeline_value || 0) / Number(overview.open_pipeline_value)) * 100 : 0))}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)', borderRadius: 4 }} />
            </div>
          </div>
        </div>

        {/* KPI 3: Sales Target with Radial Progress Gauge */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="kpi-title">Sales target</div>
              <div className="kpi-value" style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>{analyticsLoading ? '—' : (analytics.targetPace.length === 1 ? money(analytics.targetPace[0].target_amount, analytics.targetPace[0]?.currency || 'USD') : analytics.targetPace.length > 1 ? 'Multiple currencies' : '—')}</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Actual {analytics.targetPace.length === 1 ? money(analytics.targetPace[0]?.actual_revenue, analytics.targetPace[0]?.currency || 'USD') : '—'} · selected period
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge badge-blue">{analytics.targetPace.length === 1 && analytics.targetPace[0].attainment_percent != null ? `${analytics.targetPace[0].attainment_percent}% attained` : analytics.targetPace.length > 1 ? 'Multiple currencies' : 'No matching target'}</span>
              </div>
            </div>
            <div>
              <RadialProgressDonut percent={Math.max(0, Math.min(100, analytics.targetPace.length === 1 ? Number(analytics.targetPace[0]?.attainment_percent) || 0 : 0))} size={76} strokeWidth={9} color="#2563eb" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary KPI Cards */}
      <div className="kpi-grid-bottom">
        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total leads</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{Number(overview.total_leads) || 0}</div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Leads created in selected period</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={22} />
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Open opportunities</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{Number(overview.open_opportunities) || 0}</div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>In active pipeline</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={22} />
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Conversion rate</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>{overview.conversion_metric_available ? `${Number(overview.lead_conversion_rate_percent) || 0}%` : '—'}</div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Lead conversion rate</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Row 3: Charts Grid (Revenue Trend + Pipeline by Stage) */}
      <div className="dashboard-charts-grid">
        {/* Revenue Trend Chart */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Revenue trend</h3>
              <p className="chart-card-subtitle">Monthly revenue vs target quota</p>
            </div>
            <span className="badge badge-blue">Real-time sync</span>
          </div>
          <RevenueTrendChart data={analytics.revenue} />
        </div>

        {/* Pipeline by Stage Chart */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Pipeline by stage</h3>
              <p className="chart-card-subtitle">Opportunity value across stages</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigateTo('deals')}>
              View Kanban <ChevronRight size={14} />
            </button>
          </div>
          <PipelineStageChart data={analytics.pipeline} />
        </div>
      </div>

      {/* Row 4: Team Performance + Agent Activity */}
      <div className="dashboard-bottom-grid">
        {/* Team Performance Table */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Team performance</h3>
              <p className="chart-card-subtitle">Targets, won revenue and active pipeline</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigateTo('reports')}>
              Leaderboard
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Target</th>
                  <th>Won</th>
                  <th>Pipeline</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {analytics.team.length === 0 ? <tr><td colSpan="5" style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>No quota records found for this period.</td></tr> : analytics.team.map((rep) => (
                  <tr key={rep.user_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {String(rep.name || 'U').split(' ').map(n => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{rep.name}</span>
                      </div>
                    </td>
                    <td>{money(rep.target_amount, rep.currency || 'USD')}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>{money(rep.won_revenue, rep.currency || 'USD')}</td>
                    <td>{money(rep.open_pipeline_value, rep.currency || 'USD')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 100 }}>
                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, Number(rep.attainment_percent) || 0))}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{rep.attainment_percent == null ? "—" : `${rep.attainment_percent}%`}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Activity Approvals Widget */}
        <div className="crm-card">
          <div className="chart-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="chart-card-title">Agent activity</h3>
                <p className="chart-card-subtitle">Autonomous tasks waiting for your approval</p>
              </div>
            </div>
            {approvals.length > 0 && (
              <span className="badge badge-amber">{approvals.length} Pending</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {approvals.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontWeight: 600, color: '#0f172a' }}>All Autonomous Tasks Approved</p>
                <p style={{ fontSize: '0.75rem' }}>Dakini Copilot is monitoring leads and inbound triggers.</p>
              </div>
            ) : (
              approvals.map((appr) => (
                <div
                  key={appr.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '0.85rem',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                      {appr.title}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: 600 }}>{appr.agent}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                    {appr.entity}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.35rem 0 0.65rem 0' }}>
                    {appr.preview}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => approveItem(appr.id)}
                    >
                      <CheckCircle size={13} />
                      Approve
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setIsAgentDockOpen(true);
                        sendAgentMessage(`Review approval item for ${appr.entity}: ${appr.title}`);
                      }}
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Today's Tasks & Follow-ups */}
      <div className="crm-card" style={{ marginTop: '1.25rem' }}>
        <div className="chart-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="#2563eb" />
            <div>
              <h3 className="chart-card-title">Today's Priority Tasks</h3>
              <p className="chart-card-subtitle">Scheduled customer touchpoints & meetings</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigateTo('tasks')}>
            Open All Tasks
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tasks.filter((t) => !t.completed).length === 0 ? (
            <div style={{
              padding: '1.25rem',
              textAlign: 'center',
              color: '#059669',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: '#ecfdf5',
              borderRadius: 8,
              border: '1px solid #a7f3d0'
            }}>
              ✓ All priority tasks completed!
            </div>
          ) : (
            tasks.filter((t) => !t.completed).slice(0, 3).map((tsk) => (
            <div
              key={tsk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: tsk.completed ? '#f8fafc' : '#ffffff',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={tsk.completed}
                  onChange={() => toggleTask(tsk.id)}
                  style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: tsk.completed ? '#94a3b8' : '#0f172a',
                    textDecoration: tsk.completed ? 'line-through' : 'none'
                  }}>
                    {tsk.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Linked to: <strong>{tsk.record}</strong> • Assigned to {tsk.owner}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge ${tsk.priority === 'Urgent' ? 'badge-red' : tsk.priority === 'High' ? 'badge-amber' : 'badge-gray'}`}>
                  {tsk.time}
                </span>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}
