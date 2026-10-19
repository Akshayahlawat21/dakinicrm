import React, { useState, useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import {
  Search,
  UserCheck,
  Building2,
  Handshake,
  Users,
  CheckSquare,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';

export default function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    navigateTo,
    leads,
    accounts,
    contacts,
    deals,
    setIsAgentDockOpen,
    sendAgentMessage
  } = useCRM();

  const [query, setQuery] = useState('');

  if (!isCommandPaletteOpen) return null;

  const results = useMemo(() => {
    if (!query.trim()) {
      return [
        { type: 'action', title: 'Open Active Pipeline Kanban', icon: Handshake, action: () => navigateTo('deals') },
        { type: 'action', title: 'View All Leads (248)', icon: UserCheck, action: () => navigateTo('leads') },
        { type: 'action', title: 'Open Dakini AI Copilot', icon: Sparkles, action: () => setIsAgentDockOpen(true) },
        { type: 'action', title: 'Accounts Directory', icon: Building2, action: () => navigateTo('accounts') },
        { type: 'lead', title: 'Aarav Patel (Aarav Patel Enterprises)', sub: 'Lead Score 128', icon: UserCheck, action: () => navigateTo('lead-detail', leads[0]) }
      ];
    }

    const q = query.toLowerCase();
    const items = [];

    // Leads matches
    leads.forEach((l) => {
      if (l.name.toLowerCase().includes(q) || l.company.toLowerCase().includes(q)) {
        items.push({
          type: 'lead',
          title: l.name,
          sub: `${l.company} • Score ${l.score}`,
          icon: UserCheck,
          action: () => navigateTo('lead-detail', l)
        });
      }
    });

    // Deals matches
    deals.forEach((d) => {
      if (d.name.toLowerCase().includes(q) || d.company.toLowerCase().includes(q)) {
        items.push({
          type: 'deal',
          title: d.name,
          sub: `$${d.value.toLocaleString()} • ${d.stage}`,
          icon: Handshake,
          action: () => navigateTo('deals')
        });
      }
    });

    // Accounts matches
    accounts.forEach((a) => {
      if (a.name.toLowerCase().includes(q) || a.industry.toLowerCase().includes(q)) {
        items.push({
          type: 'account',
          title: a.name,
          sub: `${a.industry} • ${a.status}`,
          icon: Building2,
          action: () => navigateTo('accounts')
        });
      }
    });

    // AI Ask Prompt
    items.push({
      type: 'ai',
      title: `Ask Dakini: "${query}"`,
      sub: 'Ask Copilot to analyze or take action',
      icon: Sparkles,
      action: () => {
        setIsAgentDockOpen(true);
        sendAgentMessage(query);
      }
    });

    return items;
  }, [query, leads, deals, accounts]);

  return (
    <div className="modal-backdrop" onClick={() => setIsCommandPaletteOpen(false)}>
      <div
        className="modal-box"
        style={{ maxWidth: 620, padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          gap: '0.75rem'
        }}>
          <Search size={20} color="#2563eb" />
          <input
            type="text"
            placeholder="Type a command, search records or ask Dakini AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              color: '#0f172a',
              background: 'transparent'
            }}
          />
          <span className="search-kbd">ESC</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0.5rem' }}>
          {results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No records found matching "{query}"
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    item.action();
                    setIsCommandPaletteOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: item.type === 'ai' ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)' : '#eff6ff',
                      color: item.type === 'ai' ? '#ffffff' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                        {item.title}
                      </div>
                      {item.sub && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.sub}</div>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} color="#94a3b8" />
                </div>
              );
            })
          )}
        </div>

        <div style={{
          padding: '0.65rem 1.25rem',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: '#64748b'
        }}>
          <span>Navigate with mouse or keyboard</span>
          <span>Press <strong>ESC</strong> to exit</span>
        </div>
      </div>
    </div>
  );
}
