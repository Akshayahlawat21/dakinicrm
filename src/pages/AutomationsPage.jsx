import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Filter,
  CheckCircle,
  ArrowDown,
  Mail,
  UserCheck,
  Bell,
  Settings
} from 'lucide-react';

export default function AutomationsPage() {
  const { automations } = useCRM();
  const [selectedAuto, setSelectedAuto] = useState(automations[0]);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' | 'list'

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Automations & Workflows
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Deterministic rule-based triggers and automatic pipeline stage transitions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setViewMode('canvas')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: 6,
                background: viewMode === 'canvas' ? '#ffffff' : 'transparent',
                color: viewMode === 'canvas' ? '#2563eb' : '#64748b',
                boxShadow: viewMode === 'canvas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Visual Canvas
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: 6,
                background: viewMode === 'list' ? '#ffffff' : 'transparent',
                color: viewMode === 'list' ? '#2563eb' : '#64748b',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Workflow List
            </button>
          </div>

          <button className="btn btn-primary">
            <Plus size={16} />
            <span>New Automation</span>
          </button>
        </div>
      </div>

      {viewMode === 'canvas' ? (
        /* Vertical Flow Canvas Layout (as specified in PDF) */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
          {/* Canvas area */}
          <div className="automation-canvas">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 480, marginBottom: '0.5rem' }}>
              <span className="badge badge-blue">Visual Flow Builder</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Active Workflow</span>
            </div>

            {/* STEP 1: TRIGGER */}
            <div className="flow-step-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} />
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#2563eb' }}>
                    1. Trigger Event
                  </span>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    When a Lead Score is calculated &gt; 80
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: 38 }}>
                Fires in real-time immediately after web form submission or telemetry scoring.
              </p>
            </div>

            <div className="flow-connector-line" />

            {/* STEP 2: CONDITION */}
            <div className="flow-step-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Filter size={16} />
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#d97706' }}>
                    2. Qualification Condition
                  </span>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    Company Employees &gt; 50 OR Industry is Logistics
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: 38 }}>
                Ensures only enterprise-grade tier accounts advance to Senior Account Executives.
              </p>
            </div>

            <div className="flow-connector-line" />

            {/* STEP 3: ACTION */}
            <div className="flow-step-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} />
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669' }}>
                    3. Autonomous Execution Actions
                  </span>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    Assign Senior AE + Post to Slack #sales-war-room
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', paddingLeft: 38 }}>
                Auto-enrolls prospect in personalized Dakini AI email sequence.
              </p>
            </div>
          </div>

          {/* Right Editor Panel */}
          <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              Workflow Settings
            </h3>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Workflow Name
              </label>
              <input
                type="text"
                className="input-field"
                defaultValue={selectedAuto.name}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Execution Status
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-green">Active (428 runs)</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Last run 12m ago</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                Pre-built Templates
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="suggested-prompt-btn" style={{ fontSize: '0.75rem' }}>
                  Stale Deal 5-Day Escrow Alert
                </button>
                <button className="suggested-prompt-btn" style={{ fontSize: '0.75rem' }}>
                  Webinar Follow-Up Sequence
                </button>
                <button className="suggested-prompt-btn" style={{ fontSize: '0.75rem' }}>
                  New Inbound Account Enrichment
                </button>
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>
                Save Workflow Rule
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Table view */
        <div className="crm-table-container">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Workflow Name</th>
                <th>Trigger Event</th>
                <th>Target Condition</th>
                <th>Status</th>
                <th>Runs</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody>
              {automations.map((auto) => (
                <tr key={auto.id} onClick={() => { setSelectedAuto(auto); setViewMode('canvas'); }}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{auto.name}</div>
                  </td>
                  <td>
                    <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.8125rem' }}>{auto.trigger}</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{auto.condition}</span>
                  </td>
                  <td>
                    <span className={`badge ${auto.status ? 'badge-green' : 'badge-gray'}`}>
                      {auto.status ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>{auto.runsCount}</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{auto.lastRun}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
