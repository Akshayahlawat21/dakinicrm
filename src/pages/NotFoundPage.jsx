import React from 'react';
import { useCRM } from '../context/CRMContext';
import { Compass, ArrowRight, LayoutDashboard } from 'lucide-react';

export default function NotFoundPage() {
  const { navigateTo } = useCRM();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          marginBottom: '1.25rem',
        }}
      >
        <Compass size={32} />
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
        404 — Page Not Found
      </h1>

      <p style={{ fontSize: '0.9375rem', color: '#64748b', maxWidth: 440, marginBottom: '1.75rem', lineHeight: 1.5 }}>
        The page you are looking for does not exist, has been removed, or is temporarily unavailable.
      </p>

      <button
        className="btn btn-primary"
        onClick={() => navigateTo('dashboard')}
        style={{
          padding: '0.65rem 1.25rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <LayoutDashboard size={16} />
        <span>Return to Dashboard</span>
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
