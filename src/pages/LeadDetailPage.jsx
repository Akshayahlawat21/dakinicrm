import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { initialLeads } from '../data/mockData';
import {
  ChevronLeft,
  Phone,
  Mail,
  Edit3,
  CheckCircle,
  Building2,
  Calendar,
  Sparkles,
  Send,
  Plus,
  Clock,
  FileText,
  Briefcase,
  Share2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function LeadDetailPage() {
  const { id } = useParams();
  const {
    leads,
    selectedLead,
    navigateTo,
    setLeadToConvert,
    setIsConvertModalOpen,
    addTask,
    sendAgentMessage
  } = useCRM();

  const [activeTab, setActiveTab] = useState('Overview');
  const [quickNote, setQuickNote] = useState('');
  const [timelineNotes, setTimelineNotes] = useState([]);
  const [copilotInput, setCopilotInput] = useState('');

  const lead = (id && leads?.find((l) => l.id === id)) || selectedLead || initialLeads[0];

  const handleAddNote = () => {
    if (!quickNote.trim()) return;
    setTimelineNotes([
      {
        id: `note-${Date.now()}`,
        type: "note",
        title: "Note logged by Elena",
        description: quickNote,
        time: "Just now"
      },
      ...timelineNotes
    ]);
    setQuickNote('');
  };

  const handleCopilotSend = () => {
    if (!copilotInput.trim()) return;
    sendAgentMessage(`Regarding lead ${lead.name}: ${copilotInput}`);
    setCopilotInput('');
  };

  return (
    <div className="lead-detail-page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Bar */}
      <div className="lead-detail-header">
        <div>
          <button className="lead-breadcrumb" onClick={() => navigateTo('leads')}>
            <ChevronLeft size={16} />
            <span>Leads</span>
          </button>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            {lead.name}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {lead.industry}, from a {lead.source.toLowerCase()}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lead.status !== 'Converted' ? (
            <button
              className="btn btn-primary"
              onClick={() => {
                setLeadToConvert(lead);
                setIsConvertModalOpen(true);
              }}
            >
              <CheckCircle size={16} />
              <span>+ Convert</span>
            </button>
          ) : (
            <span className="badge badge-blue" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              ✓ Converted to Account & Deal
            </span>
          )}
        </div>
      </div>

      {/* 3-Column Salesforce Architecture (Exact layout from Screenshot 1) */}
      <div className="lead-detail-columns">
        {/* =========================================================================
            COLUMN 1: Profile & Meta Card
            ========================================================================= */}
        <div className="crm-card lead-profile-card">
          <div className="lead-profile-avatar">
            {lead.name.split(' ').map((n) => n[0]).join('')}
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            {lead.name}
          </h2>

          <div style={{ margin: '0.45rem 0' }}>
            <span className="badge badge-blue">
              <span className="badge-dot" />
              {lead.status}
            </span>
          </div>

          {/* Huge Score Badge */}
          <div className="lead-score-badge-huge">
            <div className="score-badge-label">Lead score</div>
            <div className="score-badge-number">{lead.score}</div>
          </div>

          {/* Quick Contact Action Icons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <a href={`tel:${lead.phone}`} className="btn btn-secondary btn-sm" title="Call">
              <Phone size={14} color="#2563eb" />
              <span>Call</span>
            </a>
            <a href={`mailto:${lead.email}`} className="btn btn-secondary btn-sm" title="Email">
              <Mail size={14} color="#2563eb" />
              <span>Email</span>
            </a>
          </div>

          {/* Record Attributes List */}
          <div className="lead-meta-list">
            <div className="lead-meta-row">
              <span className="lead-meta-label">Owner</span>
              <span className="lead-meta-value">{lead.owner}</span>
            </div>

            <div className="lead-meta-row">
              <span className="lead-meta-label">Email</span>
              <span className="lead-meta-value" style={{ color: '#2563eb' }}>{lead.email}</span>
            </div>

            <div className="lead-meta-row">
              <span className="lead-meta-label">Phone</span>
              <span className="lead-meta-value">{lead.phone}</span>
            </div>

            <div className="lead-meta-row">
              <span className="lead-meta-label">Source</span>
              <span className="lead-meta-value">{lead.source}</span>
            </div>

            <div className="lead-meta-row">
              <span className="lead-meta-label">Account</span>
              <span className="lead-meta-value" style={{ color: '#2563eb', cursor: 'pointer' }} onClick={() => navigateTo('accounts')}>
                {lead.company}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUMN 2: Score Breakdown, Tabs & Interactive Timeline
            ========================================================================= */}
        <div>
          {/* Sub Navigation Tabs */}
          <div className="tab-group" style={{ marginBottom: '1rem' }}>
            {['Overview', 'Signals', 'Activity', 'Notes', 'Documents'].map((t) => (
              <button
                key={t}
                className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Score breakdown card */}
          <div className="crm-card score-breakdown-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.15rem' }}>
              Score breakdown
            </h3>

            <div className="score-bar-row">
              <span className="score-bar-label">Website demo</span>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${lead.scoreBreakdown?.websiteDemo || 95}%` }} />
              </div>
            </div>

            <div className="score-bar-row">
              <span className="score-bar-label">Email engagement</span>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${lead.scoreBreakdown?.emailEngagement || 80}%` }} />
              </div>
            </div>

            <div className="score-bar-row">
              <span className="score-bar-label">Company fit</span>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${lead.scoreBreakdown?.companyFit || 90}%` }} />
              </div>
            </div>

            <div className="score-bar-row">
              <span className="score-bar-label">Source quality</span>
              <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${lead.scoreBreakdown?.sourceQuality || 85}%` }} />
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="crm-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem' }}>
              Timeline
            </h3>

            {/* Custom Notes added by user */}
            {timelineNotes.map((note) => (
              <div key={note.id} className="timeline-item">
                <div className="timeline-icon-node" style={{ background: '#2563eb', color: '#fff' }}>
                  <FileText size={16} />
                </div>
                <div className="timeline-content-card highlight-blue">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: '#1e3a8a' }}>{note.title}</span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{note.time}</span>
                  </div>
                  <p style={{ color: '#334155' }}>{note.description}</p>
                </div>
              </div>
            ))}

            {/* Default Mock Timeline from Spec */}
            {lead.timeline?.map((item) => (
              <div key={item.id} className="timeline-item">
                <div className={`timeline-icon-node ${item.type === 'ai' ? 'ai-node' : ''}`}>
                  {item.type === 'ai' ? <Sparkles size={16} /> : <Clock size={16} />}
                </div>
                <div className={`timeline-content-card ${item.type === 'ai' ? 'highlight-blue' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: item.type === 'ai' ? '#1e3a8a' : '#0f172a' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{item.time}</span>
                  </div>
                  <p style={{ color: '#334155', lineHeight: 1.45 }}>{item.description}</p>
                </div>
              </div>
            ))}

            {/* Quick Action Input Bar at bottom */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Type a quick note or meeting update..."
                  className="input-field"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddNote}>
                  Post
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleAddNote}>
                  <Plus size={13} /> Add note
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addTask(`Follow-up call with ${lead.name}`, lead.company, 'High')}
                >
                  <Phone size={13} /> Log call
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addTask(`Prepare proposal for ${lead.company}`, lead.company, 'High')}
                >
                  <Calendar size={13} /> Create task
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            COLUMN 3: Related Associations & Contextual AI Panel
            ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Linked Records Card */}
          <div className="crm-card">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem' }}>
              Associations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8125rem' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: '#f8fafc', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => navigateTo('accounts')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} color="#2563eb" />
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{lead.company}</span>
                </div>
                <ArrowRight size={14} color="#94a3b8" />
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: '#f8fafc', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => navigateTo('deals')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Briefcase size={16} color="#2563eb" />
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Deals: 1 Active</span>
                </div>
                <span className="badge badge-green">$35,000</span>
              </div>
            </div>
          </div>

          {/* Contextual Dakini Copilot Card */}
          <div className="crm-card" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%)', border: '1.5px solid #bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} />
                </div>
                <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0f172a' }}>Dakini</span>
              </div>
              <span className="badge badge-blue">Lead Copilot</span>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 10, padding: '0.85rem', border: '1px solid #dbeafe', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.45, marginBottom: '0.85rem' }}>
              <p>
                <strong>{lead.name}</strong> is already converted. His score of <strong>{lead.score}</strong> comes mostly from the website demo request.
              </p>
              <p style={{ marginTop: '0.35rem', color: '#1e40af', fontWeight: 600 }}>
                Next step: book a discovery call with {lead.owner}.
              </p>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
              Suggested
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.85rem' }}>
              {[
                "Draft a follow-up email",
                "Call with the voice agent",
                "Why this score?"
              ].map((sugg) => (
                <button
                  key={sugg}
                  className="suggested-prompt-btn"
                  style={{ background: '#ffffff', fontSize: '0.75rem' }}
                  onClick={() => sendAgentMessage(`For ${lead.name}: ${sugg}`)}
                >
                  <span>{sugg}</span>
                  <ArrowRight size={13} color="#2563eb" />
                </button>
              ))}
            </div>

            {/* Copilot Mini Input */}
            <div className="agent-input-container" style={{ background: '#ffffff' }}>
              <input
                type="text"
                placeholder="Ask anything..."
                className="agent-chat-input"
                style={{ fontSize: '0.75rem' }}
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCopilotSend()}
              />
              <button
                className="btn btn-primary btn-icon-only"
                style={{ width: 28, height: 28 }}
                onClick={handleCopilotSend}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
