import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Bot,
  Sparkles,
  Plus,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  ShieldCheck,
  RotateCcw,
  Clock,
  ChevronRight
} from 'lucide-react';

export default function AgentsPage() {
  const { agents, approvals, approveItem, currentUser } = useCRM();
  const [activeTab, setActiveTab] = useState('Agents');
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Dakini AI Autonomous Agents
            </h1>
            <span className="badge badge-blue">Sales Intelligence Suite</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Configure autonomous worker agents, approval modes, and action guardrails
          </p>
        </div>

        <button className="btn btn-sparkle">
          <Plus size={16} />
          <span>Deploy New Agent</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-group">
        {['Agents', 'Approvals', 'Activity Log', 'Templates'].map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
            {t === 'Approvals' && approvals.length > 0 && (
              <span className="tab-count-pill" style={{ background: '#fef3c7', color: '#d97706' }}>
                {approvals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'Agents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
          {/* Agents List Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="crm-card"
                style={{
                  border: selectedAgent.id === ag.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  boxShadow: selectedAgent.id === ag.id ? '0 4px 14px rgba(37,99,235,0.15)' : undefined,
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedAgent(ag)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {ag.name}
                      </h3>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {ag.tasksThisWeek} tasks completed this week
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${ag.status === 'Active' ? 'badge-green' : 'badge-amber'}`}>
                    <span className="badge-dot" />
                    {ag.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                  {ag.role}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b' }}>
                    <strong>Last action:</strong> {ag.lastAction}
                  </span>
                  <span className="badge badge-blue">{ag.approvalMode}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Selected Agent Inspector & Guardrails */}
          <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedAgent.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Agent Guardrails & Permissions</span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Primary Directive & Goal
              </label>
              <textarea
                rows={3}
                className="input-field"
                defaultValue={selectedAgent.role}
                style={{ fontSize: '0.8125rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                Allowed Autonomous Actions
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.8125rem' }}>
                {['Read Salesforce Leads & CRM Telemetry', 'Calculate & Update ICP Fit Scores', 'Draft Outbound Customer Emails', 'Advance Deal Stages in Active Pipeline'].map((act, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={i < 3} style={{ accentColor: '#2563eb' }} />
                    <span style={{ color: '#334155' }}>{act}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Human-in-the-Loop Mode
              </label>
              <select className="input-field" defaultValue={selectedAgent.approvalMode}>
                <option value="Autonomous">Autonomous Execution (Auto-pilot)</option>
                <option value="Requires Approval">Requires Approval for External Emails</option>
                <option value="Always Ask">Always Ask Before Any Modification</option>
              </select>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }}>
                <RotateCcw size={14} /> One-Click Undo
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}>
                Update Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 800 }}>
          {approvals.length === 0 ? (
            <div className="crm-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Approval Queue Clean</h3>
              <p>No actions require manual review right now.</p>
            </div>
          ) : (
            approvals.map((appr) => (
              <div key={appr.id} className="crm-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{appr.title}</h3>
                  <span className="badge badge-amber">Waiting for {currentUser?.name ? currentUser.name.split(' ')[0] : 'Review'}</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Target: {appr.entity}
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#475569', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  {appr.preview}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => approveItem(appr.id)}>
                    Dismiss
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => approveItem(appr.id)}>
                    <CheckCircle size={14} />
                    Approve & Dispatch
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'Activity Log' && (
        <div className="crm-table-container">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Action Performed</th>
                <th>Target Record</th>
                <th>Confidence</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Lead Qualifier</strong></td>
                <td>Calculated Lead ICP Score: 128</td>
                <td>Aarav Patel (Aarav Patel Enterprises)</td>
                <td><span className="badge badge-green">99%</span></td>
                <td>10 mins ago</td>
              </tr>
              <tr>
                <td><strong>Follow-up Outreach</strong></td>
                <td>Drafted Executive Follow-up Email</td>
                <td>Zomato HyperPure Ltd</td>
                <td><span className="badge badge-blue">94%</span></td>
                <td>3 hours ago</td>
              </tr>
              <tr>
                <td><strong>Data Enricher</strong></td>
                <td>Enriched Company Technology Stack</td>
                <td>TVS Mobility Solutions</td>
                <td><span className="badge badge-green">98%</span></td>
                <td>Yesterday</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
