import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import { analyzeTranscript } from '../services/aiApi';
import {
  ChevronLeft,
  Phone,
  Mail,
  CheckCircle,
  Building2,
  Sparkles,
  FileText,
  Briefcase,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ClipboardList,
  Calendar,
  Clock,
  Plus,
  Tag,
  MessageSquare,
  User,
  ListTodo,
  StickyNote,
} from 'lucide-react';

export default function LeadDetailPage() {
  const { id } = useParams();
  const {
    leads = [],
    selectedLead,
    navigateTo,
    setLeadToConvert,
    setIsConvertModalOpen,
    addTranscriptAnalysis,
    currentUser,
    products = [],
    tasks = [],
    addTask,
    transcriptAnalyses = [],
  } = useCRM();

  const [activeTab, setActiveTab] = useState('Overview');
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Quick Activity Logging state
  const [showLogForm, setShowLogForm] = useState(false);
  const [newActivityType, setNewActivityType] = useState('call');
  const [newActivitySubject, setNewActivitySubject] = useState('');
  const [newActivityNotes, setNewActivityNotes] = useState('');
  const [newActivityPriority, setNewActivityPriority] = useState('Medium');
  const [isSavingActivity, setIsSavingActivity] = useState(false);

  const lead =
    (id && leads?.find((l) => String(l.id) === String(id))) ||
    selectedLead ||
    leads[0] || {
      id: 'lead-loading',
      name: 'Lead Record',
      company: 'Enterprise Corp',
      industry: 'Enterprise Technology',
      source: 'Website',
      status: 'New',
      score: 85,
      email: 'lead@enterprise.com',
      phone: '+91 98000 00000',
      owner: currentUser?.name || 'Sales Representative',
      interested_product: '',
      scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
      timeline: []
    };

  // Pre-fill Product Discussed automatically from the Lead's Interested Product in DB
  const [productName, setProductName] = useState(
    lead?.interested_product || lead?.interestedProduct || lead?.product || ''
  );

  useEffect(() => {
    setTranscript('');
    const dbProduct = lead?.interested_product || lead?.interestedProduct || lead?.product || '';
    setProductName(dbProduct);
    setAnalysis(null);
    setAnalysisError('');
    setIsAnalyzing(false);
    setShowLogForm(false);
    setNewActivitySubject(`Call with ${lead?.name || "Lead"}`);
  }, [id, lead?.id, lead?.interested_product, lead?.interestedProduct, lead?.product, lead?.name]);

  // Keep productName in sync if lead data finishes loading from Supabase DB asynchronously
  useEffect(() => {
    const dbProduct = lead?.interested_product || lead?.interestedProduct || lead?.product || '';
    if (dbProduct && !productName) {
      setProductName(dbProduct);
    }
  }, [lead?.interested_product, lead?.interestedProduct, lead?.product, productName]);

  // Role determination for RBAC
  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');

  // RBAC-scoped activities for this person
  const leadActivities = useMemo(() => {
    const list = [];
    const leadIdStr = String(lead?.id || '');
    const leadNameClean = (lead?.name || '').toLowerCase().trim();
    const leadCompanyClean = (lead?.company || '').toLowerCase().trim();
    const myName = (currentUser?.name || '').toLowerCase().trim();
    const myId = String(currentUser?.id || '');

    // 1. Call Transcripts & Analyses for this lead
    transcriptAnalyses.forEach((c) => {
      const matchLead =
        (c.leadId && String(c.leadId) === leadIdStr) ||
        (c.leadName && c.leadName.toLowerCase().trim() === leadNameClean);

      if (matchLead) {
        // RBAC check
        let isAllowed = isOwner;
        if (!isAllowed && isManager) {
          isAllowed = true; // In manager's team scope
        }
        if (!isAllowed) {
          // Salesperson check
          const analystMatch = c.analyzedBy && String(c.analyzedBy) === myId;
          const ownerMatch = c.owner && c.owner.toLowerCase().trim() === myName;
          const leadAssignedMatch = lead.assigned_to && String(lead.assigned_to) === myId;
          const leadOwnerMatch = lead.owner && lead.owner.toLowerCase().trim() === myName;
          isAllowed = analystMatch || ownerMatch || leadAssignedMatch || leadOwnerMatch;
        }

        if (isAllowed) {
          list.push({
            id: c.id,
            type: 'call',
            subject: `Call with ${c.leadName || lead.name}`,
            product: c.productName || lead.interested_product || 'General Inquiry',
            sentiment: c.sentiment || 'neutral',
            outcome: c.callOutcome || c.outputs?.call_outcome || 'Call Completed',
            summary: c.outputs?.summary?.call_summary || c.outputs?.call_summary || 'Call transcript analyzed.',
            timestamp: c.createdAt || new Date().toISOString(),
            rep: c.analystName || c.owner || lead.owner || 'Sales Rep',
          });
        }
      }
    });

    // 2. Tasks related to this lead
    tasks.forEach((t) => {
      const rec = (t.record || '').toLowerCase().trim();
      const title = (t.title || '').toLowerCase().trim();
      const matchLead =
        (rec && (rec === leadNameClean || rec === leadCompanyClean)) ||
        title.includes(leadNameClean);

      if (matchLead) {
        // RBAC check
        let isAllowed = isOwner;
        if (!isAllowed && isManager) isAllowed = true;
        if (!isAllowed) {
          const ownerMatch = t.owner && t.owner.toLowerCase().trim() === myName;
          const leadOwnerMatch = lead.owner && lead.owner.toLowerCase().trim() === myName;
          isAllowed = ownerMatch || leadOwnerMatch;
        }

        if (isAllowed) {
          list.push({
            id: t.id,
            type: 'task',
            subject: t.title,
            priority: t.priority || 'Medium',
            completed: t.completed,
            dueDate: t.dueDate || 'Upcoming',
            timestamp: t.dueDate || new Date().toISOString(),
            rep: t.owner || lead.owner || 'Sales Rep',
          });
        }
      }
    });

    // 3. Lead Timeline events
    if (Array.isArray(lead.timeline)) {
      lead.timeline.forEach((tl) => {
        list.push({
          id: tl.id || `tl-${Math.random()}`,
          type: tl.type || 'timeline',
          subject: tl.title || 'Timeline Event',
          summary: tl.description || '',
          timestamp: tl.time || 'Past',
          rep: lead.owner || 'System',
        });
      });
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transcriptAnalyses, tasks, lead, currentUser, isOwner, isManager]);

  const handleAnalyzeTranscript = async () => {
    if (!transcript.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysis(null);
    try {
      const outputs = await analyzeTranscript(transcript);
      setAnalysis(outputs);
      await addTranscriptAnalysis(
        lead,
        transcript.trim(),
        outputs,
        productName || lead.interested_product || ''
      );
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Transcript analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateQuickActivity = async (e) => {
    e.preventDefault();
    if (!newActivitySubject.trim() || isSavingActivity) return;
    setIsSavingActivity(true);
    try {
      if (newActivityType === 'call') {
        // Ingest call activity & analysis into database
        await addTranscriptAnalysis(
          lead,
          newActivityNotes || `Salesperson completed call regarding ${productName || lead.interested_product || 'product'}.`,
          {
            summary: {
              call_summary: newActivityNotes || `Completed outbound call on ${new Date().toLocaleDateString()}.`,
              positive_feedback: [],
              negative_feedback: [],
            },
            call_outcome: 'completed',
            sentiment: 'neutral',
          },
          productName || lead.interested_product || ''
        );
      } else {
        // Create task activity in DB
        await addTask(newActivitySubject, lead.company || lead.name, newActivityPriority);
      }
      setShowLogForm(false);
      setNewActivityNotes('');
    } catch (err) {
      console.warn('Failed to save activity:', err);
    } finally {
      setIsSavingActivity(false);
    }
  };

  const renderItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
      return <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No specific points identified from this transcript.</p>;
    }
    return (
      <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.45rem', color: '#334155', fontSize: '0.875rem' }}>
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    );
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
            {lead.name || 'Lead Record'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {lead.industry || 'Enterprise Technology'}, from a {(lead.source || 'Website').toLowerCase()}
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

      {/* 3-Column Layout */}
      <div className="lead-detail-columns">
        {/* COLUMN 1: Profile & Meta Card */}
        <div className="crm-card lead-profile-card">
          <div className="lead-profile-avatar">
            {(lead.name || 'Lead Record').split(' ').map((n) => n[0]).join('')}
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
            {lead.name || 'Lead Record'}
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
                {lead.company || lead.name || 'Enterprise Corp'}
              </span>
            </div>

            {lead.interested_product && (
              <div className="lead-meta-row">
                <span className="lead-meta-label">Interested Product</span>
                <span className="lead-meta-value" style={{ color: '#1d4ed8', fontWeight: 700 }}>
                  📦 {lead.interested_product}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: Tabs & Interactive Panel */}
        <div>
          {/* Sub Navigation Tabs */}
          <div className="tab-group" style={{ marginBottom: '1rem' }}>
            {['Overview', 'Activity', 'Signals', 'Notes', 'Documents'].map((t) => (
              <button
                key={t}
                className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t}
                {t === 'Activity' && leadActivities.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: '0.7rem', padding: '1px 6px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontWeight: 800 }}>
                    {leadActivities.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW (Call Transcript & AI Analysis) */}
          {activeTab === 'Overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <section className="crm-card transcript-card" style={{ padding: '1.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={21} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Call Transcript</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Paste the salesperson and customer conversation below.</p>
                    </div>
                  </div>
                </div>

                {/* Product Discussed for this lead */}
                <label style={{ display: 'grid', gap: '0.35rem', margin: '0.9rem 0 0.65rem', color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>Product discussed</span>
                  <input
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Enter product name (e.g. CRM Software)"
                    maxLength={120}
                    style={{ width: '100%', padding: '0.7rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#0f172a' }}
                  />
                </label>

                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder={"Salesperson: Hello, how can I help you?\nCustomer: I would like to know more about your product..."}
                  rows={8}
                  maxLength={80000}
                  aria-label="Call transcript"
                  style={{
                    width: '100%', resize: 'vertical', minHeight: 180, padding: '0.9rem',
                    border: '1px solid #cbd5e1', borderRadius: 10, background: '#fff',
                    color: '#0f172a', lineHeight: 1.6, outlineColor: '#2563eb'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{transcript.length.toLocaleString()} / 80,000 characters</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => { setTranscript(''); setAnalysis(null); setAnalysisError(''); }} disabled={isAnalyzing || (!transcript && !analysis)}>
                      Clear
                    </button>
                    <button className="btn btn-primary" onClick={handleAnalyzeTranscript} disabled={!transcript.trim() || isAnalyzing}>
                      {isAnalyzing ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {isAnalyzing ? 'Analyzing…' : 'Analyze with AI'}
                    </button>
                  </div>
                </div>

                {analysisError && (
                  <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginTop: '1rem', padding: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, color: '#991b1b', fontSize: '0.85rem' }}>
                    <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{analysisError}</span>
                  </div>
                )}
              </section>

              <section className="crm-card" style={{ padding: '1.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={21} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>AI Analysis Results</h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Summary and improvements for {lead.name || 'this lead'}.</p>
                    </div>
                  </div>
                  {analysis && <span className="badge badge-green"><CheckCircle2 size={13} style={{ marginRight: 4 }} /> Analysis complete</span>}
                </div>

                {!analysis && !isAnalyzing && (
                  <div style={{ textAlign: 'center', padding: '1.6rem 1rem', border: '1px dashed #cbd5e1', borderRadius: 10, color: '#64748b' }}>
                    <ClipboardList size={28} style={{ margin: '0 auto 0.55rem', color: '#94a3b8' }} />
                    <p style={{ fontWeight: 700, color: '#475569', marginBottom: 3 }}>Your call report will appear here</p>
                    <p style={{ fontSize: '0.82rem' }}>Paste a transcript and click Analyze with AI.</p>
                  </div>
                )}

                {isAnalyzing && (
                  <div style={{ textAlign: 'center', padding: '1.6rem', color: '#475569' }}>
                    <LoaderCircle size={25} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#2563eb' }} />
                    <p style={{ fontWeight: 700 }}>Analyzing conversation…</p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Layer 5 is preparing the summary and improvements.</p>
                  </div>
                )}

                {analysis && (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 10, padding: '1rem' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', color: '#1d4ed8', marginBottom: '0.55rem' }}>
                        <FileText size={17} /> Summary
                      </h3>
                      <p style={{ color: '#1e293b', lineHeight: 1.65, fontSize: '0.9rem' }}>{analysis.summary?.call_summary || 'No summary was returned.'}</p>
                      {[
                        ['Positive feedback', analysis.summary?.positive_feedback],
                        ['Negative feedback / concerns', analysis.summary?.negative_feedback],
                        ['Customer needs', analysis.summary?.customer_needs],
                        ['Buying signals', analysis.summary?.buying_signals],
                      ].map(([label, items]) => (
                        Array.isArray(items) && items.length > 0 ? (
                          <div key={label} style={{ marginTop: '0.8rem' }}>
                            <p style={{ fontWeight: 700, color: '#334155', fontSize: '0.82rem', marginBottom: '0.35rem' }}>{label}</p>
                            {renderItems(items)}
                          </div>
                        ) : null
                      ))}
                    </div>

                    <div style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: 10, padding: '1rem' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem', color: '#c2410c', marginBottom: '0.65rem' }}>
                        <Lightbulb size={18} /> Improvements
                      </h3>
                      {[
                        ['Conversion blockers', analysis.improvements?.conversion_blockers],
                        ['Sales recommendations', analysis.improvements?.sales_recommendations],
                        ['Product improvements', analysis.improvements?.product_improvements],
                        ['Next steps', analysis.improvements?.next_steps],
                      ].map(([label, items]) => (
                        <div key={label} style={{ marginTop: '0.75rem' }}>
                          <p style={{ fontWeight: 700, color: '#7c2d12', fontSize: '0.82rem', marginBottom: '0.35rem' }}>{label}</p>
                          {renderItems(items)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: ACTIVITY (All interactions with this person in RBAC scope) */}
          {activeTab === 'Activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <section className="crm-card" style={{ padding: '1.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                      Interactions & Activity
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      All recorded calls, tasks, and touchpoints with {lead.name} in your organization scope.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                      {isOwner ? 'Scope: Owner (All Reps)' : isManager ? 'Scope: Manager (Team)' : 'Scope: Salesperson (My Records)'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowLogForm((prev) => !prev)}
                    >
                      <Plus size={14} /> {showLogForm ? 'Cancel' : 'Log Activity'}
                    </button>
                  </div>
                </div>

                {/* Quick Activity Logging Form */}
                {showLogForm && (
                  <form onSubmit={handleCreateQuickActivity} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.75rem' }}>
                      Log New Activity with {lead.name}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                        Activity Type
                        <select
                          value={newActivityType}
                          onChange={(e) => setNewActivityType(e.target.value)}
                          style={{ padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}
                        >
                          <option value="call">📞 Phone Call</option>
                          <option value="task">✓ Task / Follow-up</option>
                          <option value="meeting">📅 Meeting</option>
                          <option value="note">📝 Note</option>
                        </select>
                      </label>

                      <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                        Subject
                        <input
                          type="text"
                          value={newActivitySubject}
                          onChange={(e) => setNewActivitySubject(e.target.value)}
                          placeholder="e.g. Discovery Call with Client"
                          required
                          style={{ padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}
                        />
                      </label>

                      {newActivityType === 'task' && (
                        <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                          Priority
                          <select
                            value={newActivityPriority}
                            onChange={(e) => setNewActivityPriority(e.target.value)}
                            style={{ padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </label>
                      )}
                    </div>

                    <label style={{ display: 'grid', gap: 4, fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>
                      Notes / Outcome
                      <textarea
                        value={newActivityNotes}
                        onChange={(e) => setNewActivityNotes(e.target.value)}
                        placeholder="Details of the discussion, next steps, or customer feedback..."
                        rows={3}
                        style={{ padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff' }}
                      />
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLogForm(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingActivity}>
                        {isSavingActivity ? 'Saving…' : 'Save to Timeline'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Activity Feed */}
                {leadActivities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', border: '1px dashed #cbd5e1', borderRadius: 10, color: '#64748b' }}>
                    <Calendar size={32} style={{ margin: '0 auto 0.6rem', color: '#94a3b8' }} />
                    <p style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>No activities recorded yet for {lead.name}</p>
                    <p style={{ fontSize: '0.82rem' }}>Log a phone call or use the Overview tab to analyze a transcript.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {leadActivities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.85rem',
                          padding: '0.9rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          background: act.type === 'call' ? '#f0fdf4' : '#fff',
                        }}
                      >
                        {/* Type Icon */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: act.type === 'call' ? '#dcfce7' : act.type === 'task' ? '#eff6ff' : '#f1f5f9',
                            color: act.type === 'call' ? '#15803d' : act.type === 'task' ? '#2563eb' : '#475569',
                          }}
                        >
                          {act.type === 'call' ? <Phone size={18} /> : act.type === 'task' ? <CheckCircle size={18} /> : <Clock size={18} />}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                                {act.subject}
                              </span>
                              {act.product && (
                                <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>
                                  📦 {act.product}
                                </span>
                              )}
                              {act.sentiment && (
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    background: act.sentiment === 'positive' ? '#dcfce7' : act.sentiment === 'negative' ? '#fee2e2' : '#f1f5f9',
                                    color: act.sentiment === 'positive' ? '#15803d' : act.sentiment === 'negative' ? '#b91c1c' : '#475569',
                                  }}
                                >
                                  {act.sentiment}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(act.timestamp).toLocaleDateString()}
                            </span>
                          </div>

                          {act.summary && (
                            <p style={{ color: '#334155', fontSize: '0.85rem', lineHeight: 1.5, marginTop: 4 }}>
                              {act.summary}
                            </p>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: '0.75rem', color: '#64748b' }}>
                            <span>Rep: <strong>{act.rep}</strong></span>
                            {act.outcome && <span>Outcome: <strong style={{ color: '#059669' }}>{act.outcome}</strong></span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: SIGNALS */}
          {activeTab === 'Signals' && (
            <div className="crm-card" style={{ padding: '1.35rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                Lead Scoring Breakdown
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
                Algorithmic purchase intent signals evaluated for {lead.name}.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {Object.entries(lead.scoreBreakdown || {}).map(([metric, val]) => (
                  <div key={metric} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {metric.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0' }}>
                      {val}%
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${val}%`, height: '100%', background: '#2563eb' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === 'Notes' && (
            <div className="crm-card" style={{ padding: '1.35rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                Notes on {lead.name}
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Internal notes visible to authorized sales reps and managers.
              </p>
              <textarea
                placeholder="Add a new private note about this prospect..."
                rows={4}
                style={{ width: '100%', padding: '0.8rem', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-primary btn-sm">Save Note</button>
              </div>
            </div>
          )}

          {/* TAB 5: DOCUMENTS */}
          {activeTab === 'Documents' && (
            <div className="crm-card" style={{ padding: '1.35rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                Attached Documents
              </h2>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
                Proposals, contracts, and decks for {lead.company || lead.name}.
              </p>
              <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed #cbd5e1', borderRadius: 10, color: '#64748b' }}>
                <FileText size={28} style={{ margin: '0 auto 0.5rem', color: '#94a3b8' }} />
                <p style={{ fontWeight: 700, color: '#334155' }}>No documents attached</p>
                <p style={{ fontSize: '0.8rem' }}>Upload proposals and contracts for this account.</p>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3: Related Associations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
        </div>
      </div>
    </div>
  );
}
