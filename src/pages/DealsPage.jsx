import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
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
  ArrowRight
} from 'lucide-react';

export default function DealsPage() {
  const {
    deals,
    updateDealStage,
    setIsQuickCreateOpen,
    setQuickCreateType,
    accounts,
    navigateTo
  } = useCRM();

  const [selectedDeal, setSelectedDeal] = useState(null);
  const stages = ["Qualified", "Proposal", "Negotiation", "Won", "Lost"];

  const totalPipeline = deals
    .filter((d) => d.stage !== 'Lost')
    .reduce((acc, d) => acc + d.value, 0);

  const wonTotal = deals
    .filter((d) => d.stage === 'Won')
    .reduce((acc, d) => acc + d.value, 0);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Deals Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Deals & Active Pipeline
            </h1>
            <span className="badge badge-blue">
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              const currentIdx = stages.indexOf(selectedDeal.stage);
              const isCurrent = selectedDeal.stage === stg;
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

      {/* Kanban Board */}
      <div className="deals-kanban-board">
        {stages.map((stg) => {
          const stageDeals = deals.filter((d) => d.stage === stg);
          const stageValue = stageDeals.reduce((acc, d) => acc + d.value, 0);

          return (
            <div key={stg} className="kanban-column">
              <div className="kanban-column-header">
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
                          border: isCardSelected ? '2px solid #2563eb' : undefined,
                          boxShadow: isCardSelected ? '0 4px 14px rgba(37,99,235,0.2)' : undefined
                        }}
                        onClick={() => setSelectedDeal(deal)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                            {deal.company}
                          </span>
                          {isStuck && (
                            <span className="badge badge-amber" title="Deal stuck for >5 days">
                              <AlertTriangle size={11} />
                              {deal.daysInStage}d stuck
                            </span>
                          )}
                        </div>

                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3, marginBottom: '0.5rem' }}>
                          {deal.name}
                        </h4>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            ${deal.value.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {deal.probability}% prob.
                          </span>
                        </div>

                        {/* Card Footer */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: '0.5rem',
                          fontSize: '0.75rem',
                          color: '#64748b'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            <ArrowRight size={13} color="#2563eb" />
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
    </div>
  );
}
