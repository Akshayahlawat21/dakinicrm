import React, { useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import { MessageSquareText, TrendingUp, AlertTriangle, ListChecks, Search, FileText, Lightbulb } from 'lucide-react';

function countItems(records, selector) {
  const counts = new Map();
  records.forEach((record) => {
    const items = selector(record) || [];
    items.forEach((raw) => {
      const item = typeof raw === 'string' ? raw.trim() : '';
      if (item) counts.set(item, (counts.get(item) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

export default function CustomerFeedbackPage() {
  const { transcriptAnalyses = [] } = useCRM();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('All products');
  const productOptions = useMemo(
    () => ['All products', ...Array.from(new Set(transcriptAnalyses.map((record) => record.productName || 'Unassigned'))).sort()],
    [transcriptAnalyses]
  );
  const activeAnalyses = selectedProduct === 'All products'
    ? transcriptAnalyses
    : transcriptAnalyses.filter((record) => (record.productName || 'Unassigned') === selectedProduct);

  const positiveItems = useMemo(
    () => countItems(activeAnalyses, (record) => record.outputs?.summary?.positive_feedback || []),
    [activeAnalyses]
  );
  const concernItems = useMemo(
    () => countItems(activeAnalyses, (record) => record.outputs?.summary?.negative_feedback || []),
    [activeAnalyses]
  );
  const improvementItems = useMemo(
    () => countItems(activeAnalyses, (record) => record.outputs?.improvements?.sales_recommendations || []),
    [activeAnalyses]
  );
  const followUps = activeAnalyses.reduce(
    (total, record) => total + (record.outputs?.improvements?.next_steps?.length || 0),
    0
  );
  const filtered = activeAnalyses.filter((record) => {
    const query = search.trim().toLowerCase();
    return !query || `${record.leadName} ${record.company} ${record.outputs?.summary?.call_summary || ''}`.toLowerCase().includes(query);
  });

  const cardStyle = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: '1.1rem 1.2rem', boxShadow: '0 2px 8px -2px rgba(15,23,42,.06)'
  };

  return (
    <div style={{ maxWidth: 1450, margin: '0 auto', display: 'grid', gap: '1.1rem' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>Customer Feedback Analytics</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 5 }}>
            Overall insights from call transcripts analyzed during this browser session.
          </p>
        </div>
        <span style={{ borderRadius: 999, padding: '0.4rem 0.75rem', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 700 }}>
          V1 · Temporary session data
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
            <span>Calls analyzed</span><MessageSquareText size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{transcriptAnalyses.length}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Successful analyses in this session</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
            <span>Positive feedback points</span><TrendingUp size={18} color="#059669" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{positiveItems.reduce((sum, item) => sum + item.count, 0)}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Extracted from analyzed transcripts</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
            <span>Customer concerns</span><AlertTriangle size={18} color="#ea580c" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{concernItems.reduce((sum, item) => sum + item.count, 0)}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Negative feedback / concerns identified</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem' }}>
            <span>Suggested next steps</span><ListChecks size={18} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>{followUps}</div>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Across analyzed calls</div>
        </div>
      </div>

      {transcriptAnalyses.length === 0 ? (
        <section style={{ ...cardStyle, padding: '3rem 1.5rem', textAlign: 'center' }}>
          <MessageSquareText size={38} color="#94a3b8" style={{ margin: '0 auto 0.8rem' }} />
          <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>No call analyses yet</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Open a lead, paste its call transcript, and click Analyze with AI. The results will appear here automatically.</p>
        </section>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
            <section style={cardStyle}>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#059669" /> Repeated positive feedback
              </h2>
              {positiveItems.length ? positiveItems.slice(0, 6).map((item) => (
                <div key={item.text} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.65rem 0', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.83rem', color: '#334155' }}>{item.text}</span>
                  <strong style={{ color: '#047857', whiteSpace: 'nowrap' }}>{item.count}</strong>
                </div>
              )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No positive feedback points found yet.</p>}
            </section>
            <section style={cardStyle}>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#ea580c" /> Repeated concerns
              </h2>
              {concernItems.length ? concernItems.slice(0, 6).map((item) => (
                <div key={item.text} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.65rem 0', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.83rem', color: '#334155' }}>{item.text}</span>
                  <strong style={{ color: '#c2410c', whiteSpace: 'nowrap' }}>{item.count}</strong>
                </div>
              )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No concerns found yet.</p>}
            </section>
            <section style={cardStyle}>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={18} color="#7c3aed" /> Common sales recommendations
              </h2>
              {improvementItems.length ? improvementItems.slice(0, 6).map((item) => (
                <div key={item.text} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.65rem 0', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.83rem', color: '#334155' }}>{item.text}</span>
                  <strong style={{ color: '#6d28d9', whiteSpace: 'nowrap' }}>{item.count}</strong>
                </div>
              )) : <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No recommendations found yet.</p>}
            </section>
          </div>

          <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1rem' }}>Analyzed customer calls</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <select value={selectedProduct} onChange={(event) => setSelectedProduct(event.target.value)} style={{ padding: '0.55rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#334155' }} aria-label="Filter by product">
                  {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
                </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #cbd5e1', borderRadius: 9, padding: '0.45rem 0.65rem', minWidth: 240 }}>
                <Search size={15} color="#64748b" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or summary" style={{ border: 0, outline: 0, width: '100%' }} />
              </label>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                  <tr>{['Customer', 'Product', 'Analyzed at', 'Summary', 'Improvements'].map((label) => <th key={label} style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>{label}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id}>
                      <td style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f1f5f9', minWidth: 145 }}>
                        <strong>{record.leadName}</strong><div style={{ color: '#64748b', marginTop: 3 }}>{record.company || 'Company not provided'}</div>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f1f5f9', minWidth: 140 }}>{record.productName || 'Unassigned'}</td>
                      <td style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{new Date(record.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f1f5f9', minWidth: 260 }}>{record.outputs?.summary?.call_summary || '—'}</td>
                      <td style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #f1f5f9', minWidth: 260 }}>
                        {(record.outputs?.improvements?.sales_recommendations || []).slice(0, 2).join(' · ') || (record.outputs?.improvements?.next_steps || []).slice(0, 2).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No calls match this search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
        V1 note: this report aggregates only analyses held in the current app session. It is not saved to the database and clears when the app state resets or the browser is refreshed. Product filtering is session-only: the product name is entered with each transcript and is not saved to the database.
      </p>
    </div>
  );
}
