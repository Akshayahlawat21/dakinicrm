import React, { useEffect, useState } from 'react';
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
  ClipboardList
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
  } = useCRM();

  const [activeTab, setActiveTab] = useState('Overview');
  const [transcript, setTranscript] = useState('');
  const [productName, setProductName] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const lead =
    (id && leads?.find((l) => l.id === id)) ||
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
      scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
      timeline: []
    };

  useEffect(() => {
    setTranscript('');
    setProductName('');
    setAnalysis(null);
    setAnalysisError('');
    setIsAnalyzing(false);
  }, [id]);

  const handleAnalyzeTranscript = async () => {
    if (!transcript.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError('');
    setAnalysis(null);
    try {
      const outputs = await analyzeTranscript(transcript);
      setAnalysis(outputs);
      addTranscriptAnalysis(lead, transcript.trim(), outputs, productName);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Transcript analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
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

      {/* 3-Column Salesforce Architecture (Exact layout from Screenshot 1) */}
      <div className="lead-detail-columns">
        {/* =========================================================================
            COLUMN 1: Profile & Meta Card
            ========================================================================= */}
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

          {activeTab === 'Overview' ? (
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
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>V1 · Session only</span>
                </div>

                <label style={{ display: 'grid', gap: '0.35rem', margin: '0.9rem 0 0.65rem', color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                  Product discussed <span style={{ color: '#64748b', fontWeight: 400 }}>(optional for V1 dashboard filtering)</span>
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
          ) : (
            <div className="crm-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>{activeTab}</h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>This section is outside the transcript-analysis V1 scope. Use Overview for the call transcript and AI report.</p>
            </div>
          )}
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

        </div>
      </div>
    </div>
  );
}
