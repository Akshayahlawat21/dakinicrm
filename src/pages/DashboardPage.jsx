import React, { useState } from 'react';
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
import { teamPerformance } from '../data/mockData';

export default function DashboardPage() {
  const {
    navigateTo,
    tasks,
    toggleTask,
    approvals,
    approveItem,
    deals,
    setIsAgentDockOpen,
    sendAgentMessage
  } = useCRM();

  const [period, setPeriod] = useState('This week');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header Banner */}
      <div className="dashboard-header">
        <div>
          <div className="header-meta-date">
            Saturday, 10 October • Live Sales telemetry
          </div>
          <h1 className="header-greeting-title">
            Good evening, Elena
          </h1>
          <p className="header-subtitle">
            Here is your commercial snapshot and AI pipeline acceleration summary.
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
            title="Sync live Salesforce CRM metrics"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh metrics</span>
          </button>
        </div>
      </div>

      {/* Row 1: Primary KPI Cards */}
      <div className="kpi-grid-top">
        {/* KPI 1: Total Revenue with Sparkline */}
        <div className="kpi-card" onClick={() => navigateTo('deals')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="kpi-title">Total revenue</div>
            <div className="kpi-value">$25,500.00</div>
            <div className="kpi-subtext">
              <span className="badge badge-green">
                <ArrowUpRight size={12} />
                +12% vs target
              </span>
              <span>1 closed contract</span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Sparkline points={[10, 12, 14, 13, 19, 21, 25.5]} color="#2563eb" width={140} height={42} />
          </div>
        </div>

        {/* KPI 2: Active Pipeline with bar */}
        <div className="kpi-card" onClick={() => navigateTo('deals')} style={{ cursor: 'pointer' }}>
          <div>
            <div className="kpi-title">Active pipeline</div>
            <div className="kpi-value">$123,000.00</div>
            <div className="kpi-subtext">
              <span style={{ fontWeight: 600, color: '#2563eb' }}>4 open opportunities</span>
              <span>• Avg cycle 18 days</span>
            </div>
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
              <span>Weighted probability</span>
              <span style={{ color: '#0f172a' }}>68% ($83,640)</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)', borderRadius: 4 }} />
            </div>
          </div>
        </div>

        {/* KPI 3: Sales Target with Radial Progress Gauge */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="kpi-title">Sales target</div>
              <div className="kpi-value" style={{ fontSize: '1.5rem', margin: '0.2rem 0' }}>$25,500</div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                of <strong style={{ color: '#0f172a' }}>$130,000</strong> quarterly quota
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge badge-blue">On track for pacing</span>
              </div>
            </div>
            <div>
              <RadialProgressDonut percent={20} size={76} strokeWidth={9} color="#2563eb" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary KPI Cards */}
      <div className="kpi-grid-bottom">
        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Deals won</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>1</div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>1 closed this month</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trophy size={22} />
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Open opportunities</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>4</div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>4 in active pipeline</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={22} />
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Conversion rate</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>100%</div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>1 won vs pipeline</span>
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
          <RevenueTrendChart />
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
          <PipelineStageChart />
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
                {teamPerformance.map((rep) => (
                  <tr key={rep.id}>
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
                          {rep.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>{rep.name}</span>
                      </div>
                    </td>
                    <td>${rep.target.toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>{rep.won}</td>
                    <td>${rep.pipeline.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 100 }}>
                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${rep.progress}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{rep.progress}%</span>
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
          {tasks.slice(0, 3).map((tsk) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
