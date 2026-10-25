import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Clean animated loading symbol shown while fetching records.
 */
export default function LoadingSymbol({
  message = 'Loading...',
  compact = false,
  minHeight = 240
}) {
  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          color: '#2563eb',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        <Loader2 size={16} className="animate-spin" />
        {message && <span>{message}</span>}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#2563eb',
          marginBottom: '0.85rem',
        }}
        className="animate-spin"
      />
      {message && (
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
          {message}
        </span>
      )}
    </div>
  );
}
