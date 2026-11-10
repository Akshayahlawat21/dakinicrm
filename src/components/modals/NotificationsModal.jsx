import React from 'react';
import { useCRM } from '../../context/CRMContext';
import { Bell, CheckCircle, Sparkles, X, Mail, TrendingUp } from 'lucide-react';

export default function NotificationsModal() {
  const { isNotificationsOpen, setIsNotificationsOpen, approvals, approveItem, navigateTo } = useCRM();

  if (!isNotificationsOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 68,
        right: 80,
        width: 380,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-lg)',
        zIndex: 100,
        overflow: 'hidden',
        animation: 'scaleUp 0.15s ease'
      }}
    >
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface-soft)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} color="var(--primary)" />
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Action Center
          </h4>
        </div>
        <button onClick={() => setIsNotificationsOpen(false)} style={{ color: 'var(--text-muted)' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto', padding: '0.85rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', paddingLeft: 4 }}>
          Agent Approvals ({approvals.length})
        </div>

        {approvals.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            All approvals cleared! No pending tasks.
          </div>
        ) : (
          approvals.map((appr) => (
            <div
              key={appr.id}
              style={{
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-subtle)',
                borderRadius: 10,
                padding: '0.75rem',
                marginBottom: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {appr.title}
                </span>
                <span className="badge badge-blue">{appr.agent}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--primary-dark)', fontWeight: 600 }}>
                {appr.entity}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-body)', margin: '0.35rem 0 0.5rem 0' }}>
                {appr.preview}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => approveItem(appr.id)}
                >
                  <CheckCircle size={13} />
                  Approve Now
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => approveItem(appr.id)}
                >
                  Review
                </button>
              </div>
            </div>
          ))
        )}

        {/* System Activity Items */}
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0.75rem 0 0.5rem 0', paddingLeft: 4 }}>
          Recent Telemetry
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.65rem', padding: '0.5rem', borderRadius: 8, background: 'var(--surface-soft)', fontSize: '0.75rem' }}>
            <TrendingUp size={16} color="var(--success)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Opportunity Closed Won</div>
              <div style={{ color: 'var(--text-muted)' }}>Acme Cloud Migration closed at $25,500</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', padding: '0.5rem', borderRadius: 8, background: 'var(--surface-soft)', fontSize: '0.75rem' }}>
            <Sparkles size={16} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lead Scored Automatically</div>
              <div style={{ color: 'var(--text-muted)' }}>Aarav Patel scored 128 (High ICP fit)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
