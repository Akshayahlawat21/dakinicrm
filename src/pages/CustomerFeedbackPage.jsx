
import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  MessageSquareText,
  TrendingUp,
  AlertTriangle,
  ListChecks,
  Search,
  Lightbulb,
  Trash2,
  Trash,
} from 'lucide-react';

function countItems(records, selector) {
  const counts = new Map();
  records.forEach((record) => {
    const items = selector(record) || [];
    items.forEach((raw) => {
      const item = typeof raw === 'string' ? raw.trim() : '';

      if (item) {
        counts.set(item, (counts.get(item) || 0) + 1);
      }
    });
  });

  return [...counts.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

export default function CustomerFeedbackPage() {
  const {
    transcriptAnalyses = [],
    deleteTranscriptAnalysis,
    clearTranscriptAnalyses,
    fetchSupabaseData,
    currentUser,
    leads = [],
  } = useCRM();

  useEffect(() => {
    if (typeof fetchSupabaseData === 'function') {
      fetchSupabaseData();
    }
  }, []);

  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('All products');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const handleDeleteOne = async () => {
    if (!deleteTarget || typeof deleteTranscriptAnalysis !== 'function') return;
    const targetId = deleteTarget;
    setDeleteTarget(null);
    await deleteTranscriptAnalysis(targetId);
  };
  const handleClearAll = async () => {
    if (typeof clearTranscriptAnalyses !== 'function') return;
    const recordsToClear = [...rbacFilteredAnalyses];
    setShowClearConfirmation(false);
    await clearTranscriptAnalyses(recordsToClear);
  };
  // Role determination for RBAC
  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const canDelete = isOwner || isManager;

  // Enforce RBAC filtering:
  // - Owner: sees all organization records
  // - Salesperson: ONLY sees calls for leads assigned to them or analyzed by them
  // - Manager: sees calls for leads assigned to them or their team members
  const rbacFilteredAnalyses = useMemo(() => {
    if (!currentUser) return [];
    if (isOwner) return transcriptAnalyses;

    const myLeadIds = new Set(leads.map((l) => String(l.id)));
    const myLeadNames = new Set(leads.map((l) => (l.name || '').toLowerCase().trim()));
    const myName = (currentUser?.name || '').toLowerCase().trim();
    const myId = String(currentUser?.id || '');

    return transcriptAnalyses.filter((record) => {
      // 1. Direct match with caller's assigned leads (leads is already RBAC-scoped from DB)
      if (record.leadId && myLeadIds.has(String(record.leadId))) return true;
      if (record.leadName && myLeadNames.has((record.leadName || '').toLowerCase().trim())) return true;

      // 2. Direct match with analyst or activity owner
      if (record.analyzedBy && String(record.analyzedBy) === myId) return true;
      if (record.owner && record.owner.toLowerCase().trim() === myName) return true;
      if (record.assigned_to && String(record.assigned_to) === myId) return true;

      return false;
    });
  }, [transcriptAnalyses, currentUser, isOwner, leads]);

  const productOptions = useMemo(
    () => [
      'All products',
      ...Array.from(
        new Set(
          rbacFilteredAnalyses.map(
            (record) => record.productName || record.product || 'Unassigned'
          )
        )
      ).sort(),
    ],
    [rbacFilteredAnalyses]
  );

  const activeAnalyses =
    selectedProduct === 'All products'
      ? rbacFilteredAnalyses
      : rbacFilteredAnalyses.filter(
          (record) =>
            (record.productName || record.product || 'Unassigned') === selectedProduct
        );

  const positiveItems = useMemo(
    () =>
      countItems(
        activeAnalyses,
        (record) => record.outputs?.summary?.positive_feedback || []
      ),
    [activeAnalyses]
  );

  const concernItems = useMemo(
    () =>
      countItems(
        activeAnalyses,
        (record) => record.outputs?.summary?.negative_feedback || []
      ),
    [activeAnalyses]
  );

  const improvementItems = useMemo(
    () =>
      countItems(
        activeAnalyses,
        (record) =>
          record.outputs?.improvements?.sales_recommendations || []
      ),
    [activeAnalyses]
  );

  // Count the same sales recommendations shown in the card.
  // Duplicate recommendations are aggregated by countItems().
  const followUps = improvementItems.reduce(
    (total, item) => total + item.count,
    0
  );

  const filtered = activeAnalyses.filter((record) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      `${record.leadName || ''} ${record.company || ''} ${
        record.outputs?.summary?.call_summary || ''
      }`
        .toLowerCase()
        .includes(query)
    );
  });

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 14,
    padding: '1.1rem 1.2rem',
    boxShadow: '0 2px 8px -2px rgba(15,23,42,.06)',
    minWidth: 0,
  };

  const recommendationListStyle = {
    maxHeight: 280,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 6,
  };

  const recommendationRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '0.65rem 0',
    borderTop: '1px solid var(--border-default)',
  };

  const itemTextStyle = {
    fontSize: '0.83rem',
    color: 'var(--text-body)',
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  };

  return (
    <div
      style={{
        maxWidth: 1450,
        margin: '0 auto',
        display: 'grid',
        gap: '1.1rem',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--text-main)',
            }}
          >
            Customer Analysis
          </h1>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              marginTop: 5,
            }}
          >
            Overall insights from call transcripts analyzed during this
            browser session.
          </p>
        </div>

        {canDelete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowClearConfirmation(true)}
              disabled={rbacFilteredAnalyses.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                border: '1px solid var(--danger-border)',
                borderRadius: 9,
                padding: '0.55rem 0.8rem',
                background: rbacFilteredAnalyses.length ? 'var(--bg-card)' : 'var(--surface-soft)',
                color: rbacFilteredAnalyses.length ? 'var(--danger-text-dark)' : 'var(--text-subtle)',
                cursor: rbacFilteredAnalyses.length ? 'pointer' : 'not-allowed',
                fontWeight: 650,
              }}
            >
              <Trash size={15} /> Clear all
            </button>
          </div>
        )}
      </header>

      {/* Summary KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.9rem',
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            <span>Calls analyzed</span>
            <MessageSquareText size={18} color="var(--primary)" />
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>
            {activeAnalyses.length}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Successful analyses for selected filter
          </div>

        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            <span>Positive feedback points</span>
            <TrendingUp size={18} color="var(--success-text)" />
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>
            {positiveItems.reduce((sum, item) => sum + item.count, 0)}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Extracted from analyzed transcripts
          </div>

        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            <span>Customer concerns</span>
            <AlertTriangle size={18} color="var(--warning-text)" />
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>
            {concernItems.reduce((sum, item) => sum + item.count, 0)}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Negative feedback / concerns identified
          </div>

        </div>
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
            }}
          >
            <span>Suggested next steps</span>
            <ListChecks size={18} color="var(--purple-text)" />
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8 }}>
            {followUps}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Total sales recommendations
          </div>

        </div>
      </div>

      {activeAnalyses.length === 0 ? (
        <section
          style={{
            ...cardStyle,
            padding: '3rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <MessageSquareText
            size={38}
            color="var(--text-subtle)"
            style={{ margin: '0 auto 0.8rem' }}
          />

          <h2 style={{ fontSize: '1.1rem', marginBottom: 6 }}>
            No call analyses yet
          </h2>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Open a lead, paste its call transcript, and click Analyze with AI.
            The results will appear here automatically.
          </p>
        </section>
      ) : (
        <>
          {/* Feedback and recommendation cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            <section style={cardStyle}>
              <h2
                style={{
                  fontSize: '1rem',
                  marginBottom: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <TrendingUp size={18} color="var(--success-text)" />
                Repeated positive feedback
              </h2>

              {positiveItems.length ? (
                positiveItems.slice(0, 6).map((item) => (
                  <div key={item.text} style={recommendationRowStyle}>
                    <span style={itemTextStyle}>{item.text}</span>
                    <strong
                      style={{ color: 'var(--success-text-dark)', whiteSpace: 'nowrap' }}
                    >
                      {item.count}
                    </strong>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No positive feedback points found yet.
                </p>
              )}
            </section>

            <section style={cardStyle}>
              <h2
                style={{
                  fontSize: '1rem',
                  marginBottom: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertTriangle size={18} color="var(--warning-text)" />
                Repeated concerns
              </h2>

              {concernItems.length ? (
                concernItems.slice(0, 6).map((item) => (
                  <div key={item.text} style={recommendationRowStyle}>
                    <span style={itemTextStyle}>{item.text}</span>
                    <strong
                      style={{ color: 'var(--warning-text)', whiteSpace: 'nowrap' }}
                    >
                      {item.count}
                    </strong>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No concerns found yet.
                </p>
              )}
            </section>

            <section style={cardStyle}>
              <h2
                style={{
                  fontSize: '1rem',
                  marginBottom: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Lightbulb size={18} color="var(--purple-text)" />
                Common sales recommendations
                {improvementItems.length > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    {improvementItems.length} unique
                  </span>
                )}
              </h2>

              {improvementItems.length ? (
                <div style={recommendationListStyle}>
                  {improvementItems.map((item) => (
                    <div key={item.text} style={recommendationRowStyle}>
                      <span style={itemTextStyle}>{item.text}</span>

                      <strong
                        style={{
                          color: 'var(--purple-text)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                        title={`${item.count} occurrence(s)`}
                      >
                        {item.count}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No sales recommendations found yet.
                </p>
              )}
            </section>
          </div>

          {/* Analyzed calls table */}
          <section
            style={{
              ...cardStyle,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <h2 style={{ fontSize: '1rem' }}>Analyzed customer calls</h2>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                }}
              >
                <select
                  value={selectedProduct}
                  onChange={(event) => setSelectedProduct(event.target.value)}
                  style={{
                    padding: '0.55rem 0.65rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 9,
                    background: 'var(--bg-card)',
                    color: 'var(--text-body)',
                  }}
                  aria-label="Filter by product"
                >
                  {productOptions.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-card)',
                    borderRadius: 9,
                    padding: '0.45rem 0.65rem',
                    minWidth: 240,
                  }}
                >
                  <Search size={15} color="var(--text-muted)" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer or summary"
                    style={{
                      border: 0,
                      outline: 0,
                      width: '100%',
                      background: 'transparent',
                      color: 'var(--text-main)',
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.8rem',
                }}
              >
                <thead
                  style={{
                    background: 'var(--surface-soft)',
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                  }}
                >
                  <tr>
                    {[
                      'Customer',
                      'Product',
                      'Analyzed at',
                      'Summary',
                      'Improvements',
                      'Actions',
                    ].map((label) => (
                      <th
                        key={label}
                        style={{
                          padding: '0.75rem 1rem',
                          borderTop: '1px solid var(--border-default)',
                          borderBottom: '1px solid var(--border-default)',
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id}>
                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          minWidth: 145,
                        }}
                      >
                        <strong>{record.leadName || 'Unknown customer'}</strong>
                        <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                          {record.company || 'Company not provided'}
                        </div>
                      </td>

                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          minWidth: 140,
                        }}
                      >
                        {record.productName || record.product || 'Unassigned'}
                      </td>

                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleString()
                          : '—'}
                      </td>

                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          minWidth: 260,
                        }}
                      >
                        {record.outputs?.summary?.call_summary || '—'}
                      </td>

                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          minWidth: 260,
                        }}
                      >
                        {(
                          record.outputs?.improvements?.sales_recommendations ||
                          []
                        )
                          .slice(0, 2)
                          .join(' · ') ||
                          (
                            record.outputs?.improvements?.next_steps || []
                          )
                            .slice(0, 2)
                            .join(' · ') ||
                          '—'}
                      </td>
                      <td
                        style={{
                          padding: '0.9rem 1rem',
                          borderBottom: '1px solid var(--border-default)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(record.id)}
                            aria-label={`Delete analysis for ${record.leadName || 'customer'}`}
                            title="Delete this analysis"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              border: '1px solid var(--danger-border)',
                              borderRadius: 8,
                              padding: '0.45rem 0.6rem',
                              background: 'var(--bg-card)',
                              color: 'var(--danger-text-dark)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: '1.5rem',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No calls match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-analysis-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <section style={{ ...cardStyle, width: 'min(100%, 420px)', padding: '1.4rem' }}>
            <h2 id="delete-analysis-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>
              Are you sure you want to delete this record?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              This record will be completely deleted from the database. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ padding: '0.6rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-body)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteOne} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.9rem', border: '1px solid #b91c1c', borderRadius: 8, background: '#b91c1c', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </section>
        </div>
      )}

      {showClearConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-analyses-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <section style={{ ...cardStyle, width: 'min(100%, 440px)', padding: '1.4rem' }}>
            <h2 id="clear-analyses-title" style={{ fontSize: '1.1rem', marginBottom: 8 }}>
              Are you sure you want to delete all records?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              All {rbacFilteredAnalyses.length} records will be completely deleted from the database. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" onClick={() => setShowClearConfirmation(false)} style={{ padding: '0.6rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-body)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={handleClearAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.9rem', border: '1px solid #b91c1c', borderRadius: 8, background: '#b91c1c', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                <Trash size={14} /> Clear all
              </button>
            </div>
          </section>
        </div>
      )}

      
    </div>
  );
}
