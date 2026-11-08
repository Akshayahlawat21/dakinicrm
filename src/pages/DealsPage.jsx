import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  Handshake,
  Plus,
  DollarSign,
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  XCircle,
  Filter,
  ArrowRight,
  Trash2
} from 'lucide-react';

export default function DealsPage() {
  const {
    deals,
    updateDealStage,
    deleteDeal,
    setIsQuickCreateOpen,
    setQuickCreateType,
    accounts,
    navigateTo,
    isLoadingData,
    currentUser,
  } = useCRM();

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const canDeleteDeals = isOwner || isManager;

  const [selectedDeal, setSelectedDeal] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const stages = ["Qualified", "Proposal", "Negotiation", "Won", "Lost"];

  const handleDeleteDeal = async (deal) => {
    if (!deal || isDeleting) return;

    if (!canDeleteDeals) {
      setPermissionError("You don't have permission to delete deals. Only Owners and Managers are authorized to delete deals from the active pipeline.");
      return;
    }

    if (window.confirm(`Delete opportunity "${deal.name}"?`)) {
      setIsDeleting(true);
      setPermissionError(null);
      const res = await deleteDeal(deal.id);
      setIsDeleting(false);

      if (res && res.success === false) {
        setPermissionError(res.error?.message || "You don't have permission to delete this deal.");
      } else {
        setSelectedDeal(null);
      }
    }
  };

  const normalizeStage = (stg) => {
    if (!stg) return 'Qualified';
    const s = String(stg).toLowerCase().trim();
    if (s === 'discovery' || s === 'qualification' || s === 'qualified') return 'Qualified';
    if (s === 'proposal') return 'Proposal';
    if (s === 'negotiation') return 'Negotiation';
    if (s === 'won' || s.includes('won')) return 'Won';
    if (s === 'lost' || s.includes('lost')) return 'Lost';
    return stg;
  };

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const stageFromUrl = searchParams.get('stage') || location.state?.stage;

  const [activeStageFilter, setActiveStageFilter] = useState(() => {
    return stageFromUrl ? normalizeStage(stageFromUrl) : 'All';
  });

  useEffect(() => {
    const currentParam = searchParams.get('stage') || location.state?.stage;
    if (currentParam) {
      setActiveStageFilter(normalizeStage(currentParam));
    }
  }, [searchParams, location.state]);

  const handleSelectStage = (stg) => {
    setActiveStageFilter(stg);
    if (stg === 'All') {
      setSearchParams({});
    } else {
      setSearchParams({ stage: stg });
    }
  };

  const activePipeline = deals
    .filter((d) => !['Lost', 'Won'].includes(normalizeStage(d.stage)))
    .reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

  const wonTotal = deals
    .filter((d) => normalizeStage(d.stage) === 'Won')
    .reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

  const totalPipeline = activePipeline + wonTotal;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Deals Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Deals & Active Pipeline
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              Active Pipeline: ${activePipeline.toLocaleString()}
            </span>
            <span className="badge badge-gray" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              Total: ${totalPipeline.toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Salesforce-inspired Kanban pipeline with stage velocity & probability tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
            <TrendingUp size={16} color="#2563eb" />
            <span style={{ fontWeight: 600, color: '#1e40af' }}>Won this month:</span>
            <strong style={{ color: '#2563eb' }}>${wonTotal.toLocaleString()}</strong>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setQuickCreateType('deal');
              setIsQuickCreateOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Add Deal</span>
          </button>
        </div>
      </div>

      {/* Stage Navigation & Filter Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
        borderBottom: '1px solid var(--border-default)',
        paddingBottom: '0.75rem'
      }}>
        <div className="crm-tabs" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', margin: 0 }}>
          <button
            type="button"
            className={`tab-btn ${activeStageFilter === 'All' ? 'active' : ''}`}
            onClick={() => handleSelectStage('All')}
          >
            All Stages
            <span className="tab-count-pill">{deals.length}</span>
          </button>

          {stages.map((stg) => {
            const count = deals.filter((d) => normalizeStage(d.stage) === stg).length;
            const val = deals.filter((d) => normalizeStage(d.stage) === stg).reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);
            const isActive = activeStageFilter === stg;
            return (
              <button
                key={stg}
                type="button"
                className={`tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectStage(stg)}
                title={`Open ${stg} section (${count} deals • $${val.toLocaleString()})`}
              >
                {stg}
                <span className="tab-count-pill">{count}</span>
                {val > 0 && (
                  <span style={{ fontSize: '0.6875rem', color: isActive ? 'var(--primary)' : 'var(--text-muted)', marginLeft: 4, fontWeight: 700 }}>
                    ${(val / 1000).toFixed(0)}k
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeStageFilter !== 'All' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectStage('All')}
              style={{ fontSize: '0.75rem' }}
            >
              ← Back to All Stages
            </button>
          </div>
        )}
      </div>

      {/* User Friendly Permission Alert */}
      {permissionError && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.15rem',
            borderRadius: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>Permission Denied:</strong>{' '}
              <span style={{ fontSize: '0.85rem' }}>{permissionError}</span>
            </div>
          </div>
          <button
            onClick={() => setPermissionError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#991b1b',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected Deal Stage Path Chevron (Salesforce Path Component) */}
      {selectedDeal && (
        <div className="crm-card" style={{ marginBottom: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Selected Opportunity</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {selectedDeal.name} (${selectedDeal.value.toLocaleString()})
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{
                  color: canDeleteDeals ? '#ef4444' : '#94a3b8',
                  borderColor: canDeleteDeals ? '#fca5a5' : '#cbd5e1',
                  cursor: canDeleteDeals ? 'pointer' : 'not-allowed',
                  opacity: canDeleteDeals ? 1 : 0.65,
                }}
                disabled={isDeleting}
                onClick={() => handleDeleteDeal(selectedDeal)}
                title={canDeleteDeals ? "Delete Opportunity" : "Permission Denied: Only Owners and Managers can delete deals"}
              >
                <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => updateDealStage(selectedDeal.id, 'Won')}
              >
                <CheckCircle size={14} /> Mark Won
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => updateDealStage(selectedDeal.id, 'Lost')}
              >
                <XCircle size={14} /> Mark Lost
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDeal(null)}>
                Close
              </button>
            </div>

          </div>

          {/* Salesforce Path Chevrons */}
          <div className="salesforce-path">
            {stages.map((stg, idx) => {
              const currentStage = normalizeStage(selectedDeal.stage);
              const currentIdx = stages.indexOf(currentStage);
              const isCurrent = currentStage === stg;
              const isPast = idx < currentIdx;

              return (
                <div
                  key={stg}
                  className={`path-step ${isCurrent ? 'current' : isPast ? 'completed' : ''}`}
                  onClick={() => {
                    updateDealStage(selectedDeal.id, stg);
                    setSelectedDeal({ ...selectedDeal, stage: stg });
                  }}
                >
                  {isPast && <CheckCircle size={13} color="#2563eb" />}
                  <span>{stg}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoadingData && deals.length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
        <>
          {activeStageFilter !== 'All' ? (
            /* Dedicated Single Stage Section View */
            (() => {
              const currentStageDeals = deals.filter((d) => normalizeStage(d.stage) === activeStageFilter);
              const currentStageValue = currentStageDeals.reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

              return (
                <div className="crm-card" style={{ padding: '1.75rem', marginBottom: '1.5rem', background: 'var(--bg-card)' }}>
                  {/* Stage Section Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '1.25rem',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid var(--border-default)',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800
                      }}>
                        <Handshake size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            {activeStageFilter} Section
                          </h2>
                          <span className="badge badge-blue" style={{ fontSize: '0.8125rem', padding: '0.25rem 0.6rem' }}>
                            {currentStageDeals.length} {currentStageDeals.length === 1 ? 'Opportunity' : 'Opportunities'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                          Total pipeline value in stage: <strong style={{ color: 'var(--primary)' }}>${currentStageValue.toLocaleString()}</strong>
                          {currentStageDeals.length > 0 && ` • Avg deal size: $${Math.round(currentStageValue / currentStageDeals.length).toLocaleString()}`}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectStage('All')}
                      >
                        View All Stages (Kanban)
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setQuickCreateType('deal');
                          setIsQuickCreateOpen(true);
                        }}
                      >
                        <Plus size={15} /> Add Deal in {activeStageFilter}
                      </button>
                    </div>
                  </div>

                  {/* Deals Cards Grid */}
                  {currentStageDeals.length === 0 ? (
                    <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Handshake size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.35, color: 'var(--primary)' }} />
                      <h3 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                        No opportunities currently in {activeStageFilter} stage
                      </h3>
                      <p style={{ fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                        Click below to create a new deal directly in the {activeStageFilter} pipeline.
                      </p>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setQuickCreateType('deal');
                          setIsQuickCreateOpen(true);
                        }}
                      >
                        <Plus size={15} /> Add Opportunity
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '1.25rem'
                    }}>
                      {currentStageDeals.map((deal) => {
                        const isStuck = deal.daysInStage >= 5 && deal.stage !== 'Won' && deal.stage !== 'Lost';
                        const isCardSelected = selectedDeal?.id === deal.id;

                        return (
                          <div
                            key={deal.id}
                            className={`deal-card ${isStuck ? 'stuck-amber' : ''}`}
                            style={{
                              border: isCardSelected ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                              boxShadow: isCardSelected ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                              background: 'var(--bg-card)',
                              cursor: 'pointer'
                            }}
                            onClick={() => setSelectedDeal(deal)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {deal.company || deal.account || 'Account'}
                              </span>
                              {isStuck && (
                                <span className="badge badge-amber" title="Deal stuck for >5 days">
                                  <AlertTriangle size={11} />
                                  {deal.daysInStage}d stuck
                                </span>
                              )}
                            </div>

                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                              {deal.name}
                            </h4>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                ${(Number(deal.value || deal.amount) || 0).toLocaleString()}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {deal.probability != null ? `${deal.probability}% prob.` : normalizeStage(deal.stage) === 'Won' ? '100% prob.' : normalizeStage(deal.stage) === 'Lost' ? '0% prob.' : '50% prob.'}
                              </span>
                            </div>

                            {/* Card Footer */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              borderTop: '1px solid var(--border-default)',
                              paddingTop: '0.65rem',
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {(deal.owner || 'U').split(' ').map(n => n[0]).join('')}
                                </div>
                                <span>{deal.owner || 'Unassigned'}</span>
                              </div>

                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextIdx = (stages.indexOf(normalizeStage(deal.stage)) + 1) % stages.length;
                                  updateDealStage(deal.id, stages[nextIdx]);
                                }}
                                title={`Advance to next stage (${stages[(stages.indexOf(normalizeStage(deal.stage)) + 1) % stages.length]})`}
                              >
                                <span>Move</span>
                                <ArrowRight size={13} color="var(--primary)" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* Kanban Board: All Stages */
            <div className="deals-kanban-board">
              {stages.map((stg) => {
                const stageDeals = deals.filter((d) => normalizeStage(d.stage) === stg);
                const stageValue = stageDeals.reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

                return (
                  <div key={stg} id={`kanban-col-${stg}`} className="kanban-column">
                    <div
                      className="kanban-column-header"
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onClick={() => handleSelectStage(stg)}
                      title={`Click to open only ${stg} section`}
                    >
                      <div>
                        <span className="kanban-column-title">
                          {stg}
                          <span className="badge badge-gray">{stageDeals.length}</span>
                        </span>
                      </div>
                      <span className="kanban-column-total">
                        ${(stageValue / 1000).toFixed(0)}k
                      </span>
                    </div>

                    <div className="kanban-cards-stack">
                      {stageDeals.length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem' }}>
                          No deals in this stage
                        </div>
                      ) : (
                        stageDeals.map((deal) => {
                          const isStuck = deal.daysInStage >= 5 && deal.stage !== 'Won' && deal.stage !== 'Lost';
                          const isCardSelected = selectedDeal?.id === deal.id;

                          return (
                            <div
                              key={deal.id}
                              className={`deal-card ${isStuck ? 'stuck-amber' : ''}`}
                              style={{
                                border: isCardSelected ? '2px solid var(--primary)' : undefined,
                                boxShadow: isCardSelected ? '0 4px 14px var(--primary-glow)' : undefined
                              }}
                              onClick={() => setSelectedDeal(deal)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                                  {deal.company}
                                </span>
                                {isStuck && (
                                  <span className="badge badge-amber" title="Deal stuck for >5 days">
                                    <AlertTriangle size={11} />
                                    {deal.daysInStage}d stuck
                                  </span>
                                )}
                              </div>

                              <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                                {deal.name}
                              </h4>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                  ${deal.value.toLocaleString()}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {deal.probability != null ? `${deal.probability}% prob.` : normalizeStage(deal.stage) === 'Won' ? '100% prob.' : normalizeStage(deal.stage) === 'Lost' ? '0% prob.' : '50% prob.'}
                                </span>
                              </div>

                              {/* Card Footer */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderTop: '1px solid var(--border-default)',
                                paddingTop: '0.5rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {deal.owner.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <span>{deal.owner}</span>
                                </div>

                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '0.15rem 0.35rem' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextIdx = (stages.indexOf(deal.stage) + 1) % stages.length;
                                    updateDealStage(deal.id, stages[nextIdx]);
                                  }}
                                  title="Advance to next stage"
                                >
                                  <ArrowRight size={13} color="var(--primary)" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </>
      )}
    </div>
  );
}
