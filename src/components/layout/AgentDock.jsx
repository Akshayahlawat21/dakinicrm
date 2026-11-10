import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import {
  Sparkles,
  X,
  ArrowUp,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Send,
  Loader2
} from 'lucide-react';

export default function AgentDock() {
  const {
    isAgentDockOpen,
    setIsAgentDockOpen,
    currentTab,
    selectedLead,
    agentMessages,
    agentThinking,
    sendAgentMessage,
    approvals,
    approveItem,
    currentUser,
  } = useCRM();

  const [inputVal, setInputVal] = useState('');

  if (!isAgentDockOpen) return null;

  const getContextName = () => {
    if (currentTab === 'lead-detail' && selectedLead) {
      return `Lead: ${selectedLead.name}`;
    }
    if (currentTab === 'leads') return 'Context: Leads Management';
    if (currentTab === 'deals') return 'Context: Active Pipeline';
    if (currentTab === 'accounts') return 'Context: Enterprise Accounts';
    const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Sales';
    return `Context: ${firstName}’s Sales Workspace`;
  };

  const handleSend = () => {
    if (!inputVal.trim()) return;
    sendAgentMessage(inputVal);
    setInputVal('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const promptSuggestions = [
    "Draft a follow-up email",
    "Call with the voice agent",
    "Why this score?",
    "Summarize pipeline by account"
  ];

  return (
    <aside className="crm-agent-dock">
      {/* Header */}
      <div className="agent-dock-header">
        <div className="agent-header-title">
          <div className="agent-badge-sparkle">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>Dakini AI</h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--primary)', fontWeight: 600 }}>Autonomous Sales Copilot</span>
          </div>
        </div>
        <button
          onClick={() => setIsAgentDockOpen(false)}
          style={{ color: 'var(--text-muted)', padding: '0.25rem', borderRadius: 6 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Context Chip */}
      <div className="agent-context-chip">
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}></span>
        <span>{getContextName()}</span>
      </div>

      {/* Body / Chat Stream */}
      <div className="agent-dock-body">
        {agentMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div
              style={{
                maxWidth: '92%',
                padding: '0.75rem 1rem',
                borderRadius: 14,
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                background: msg.sender === 'user' ? 'var(--primary)' : 'var(--surface-soft)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-main)',
                border: msg.sender === 'user' ? 'none' : '1px solid var(--border-default)',
                boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(37,99,235,0.25)' : 'none'
              }}
            >
              {msg.text}
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-subtle)', marginTop: 3, padding: '0 4px' }}>
              {msg.time}
            </span>
          </div>
        ))}

        {agentThinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Loader2 size={16} className="animate-spin" />
            <span>Dakini is synthesizing insights...</span>
          </div>
        )}

        {/* Suggested Prompts */}
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
            Suggested Actions
          </div>
          <div className="agent-suggested-prompts">
            {promptSuggestions.map((prompt) => (
              <button
                key={prompt}
                className="suggested-prompt-btn"
                onClick={() => sendAgentMessage(prompt)}
              >
                <span>{prompt}</span>
                <ChevronRight size={14} color="var(--primary)" />
              </button>
            ))}
          </div>
        </div>

        {/* Pending Approvals Widget */}
        {approvals.length > 0 && (
          <div className="agent-approvals-box" style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning-text-dark)' }}>
                Pending Approvals ({approvals.length})
              </span>
              <span className="badge badge-amber">{approvals.length} Action Needed</span>
            </div>
            {approvals.map((appr) => (
              <div
                key={appr.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 8,
                  padding: '0.65rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{appr.title}</div>
                <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.718rem' }}>{appr.entity}</div>
                <p style={{ color: 'var(--text-body)', margin: '0.25rem 0 0.5rem 0', lineHeight: 1.35 }}>
                  {appr.preview}
                </p>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, padding: '0.25rem 0.5rem' }}
                    onClick={() => approveItem(appr.id)}
                  >
                    <CheckCircle size={13} />
                    Approve
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.25rem 0.5rem' }}
                    onClick={() => approveItem(appr.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Chat Input */}
      <div className="agent-dock-footer">
        <div className="agent-input-container">
          <input
            type="text"
            className="agent-chat-input"
            placeholder="Ask anything or generate draft..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="btn btn-primary btn-icon-only"
            style={{ width: 32, height: 32 }}
            onClick={handleSend}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
