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
  X,
  BadgeCheck
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

  // Keyboard shortcut listener for ESC to close palette
  React.useEffect(() => {
    if (!isCommandPaletteOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  const results = useMemo(() => {
    if (!isCommandPaletteOpen) return [];

    const safeLeads = Array.isArray(leads) ? leads : [];
    const safeDeals = Array.isArray(deals) ? deals : [];
    const safeAccounts = Array.isArray(accounts) ? accounts : [];

    if (!query.trim()) {
      return [
        { type: 'action', title: 'Won Customers Directory', icon: BadgeCheck, action: () => navigateTo('customers') },
        { type: 'action', title: 'Open Active Pipeline Kanban', icon: Handshake, action: () => navigateTo('deals') },
        { type: 'action', title: `View All Leads (${safeLeads.length})`, icon: UserCheck, action: () => navigateTo('leads') },
        { type: 'action', title: 'Open Dakini AI Copilot', icon: Sparkles, action: () => setIsAgentDockOpen(true) },
        { type: 'action', title: 'Accounts Directory', icon: Building2, action: () => navigateTo('accounts') },
        ...(safeLeads[0]
          ? [{
              type: 'lead',
              title: `${safeLeads[0].name} (${safeLeads[0].company || 'Lead'})`,
              sub: `Lead Score ${safeLeads[0].score || 75}`,
              icon: UserCheck,
              action: () => navigateTo('lead-detail', safeLeads[0])
            }]
          : [])
      ];
    }

    const q = query.toLowerCase();
    const items = [];

    // Leads matches
    safeLeads.forEach((l) => {
      const name = l?.name || '';
      const company = l?.company || '';
      if (name.toLowerCase().includes(q) || company.toLowerCase().includes(q)) {
        items.push({
          type: 'lead',
          title: name,
          sub: `${company} • Score ${l?.score || 0}`,
          icon: UserCheck,
          action: () => navigateTo('lead-detail', l)
        });
      }
    });

    // Deals matches
    safeDeals.forEach((d) => {
      const name = d?.name || '';
      const company = d?.company || '';
      if (name.toLowerCase().includes(q) || company.toLowerCase().includes(q)) {
        const valStr = d?.value != null ? Number(d.value).toLocaleString() : '0';
        items.push({
          type: 'deal',
          title: name,
          sub: `$${valStr} • ${d?.stage || 'Pipeline'}`,
          icon: Handshake,
          action: () => navigateTo('deals')
        });
      }
    });

    // Accounts matches
    safeAccounts.forEach((a) => {
      const name = a?.name || '';
      const industry = a?.industry || '';
      if (name.toLowerCase().includes(q) || industry.toLowerCase().includes(q)) {
        items.push({
          type: 'account',
          title: name,
          sub: `${industry} • ${a?.status || 'Active'}`,
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
  }, [isCommandPaletteOpen, query, leads, deals, accounts, navigateTo, setIsAgentDockOpen, sendAgentMessage]);

  if (!isCommandPaletteOpen) return null;

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
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-card)',
          gap: '0.75rem'
        }}>
          <Search size={20} color="var(--primary)" />
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
              color: 'var(--text-main)',
              background: 'transparent'
            }}
          />
          <span className="search-kbd">ESC</span>
        </div>

        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0.5rem' }}>
          {results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
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
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: item.type === 'ai' ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)' : 'var(--primary-light)',
                      color: item.type === 'ai' ? '#ffffff' : 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.title}
                      </div>
                      {item.sub && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                      )}
                    </div>
                  </div>
                  <ArrowRight size={14} color="var(--text-subtle)" />
                </div>
              );
            })
          )}
        </div>

        <div style={{
          padding: '0.65rem 1.25rem',
          background: 'var(--surface-soft)',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)'
        }}>
          <span>Navigate with mouse or keyboard</span>
          <span>Press <strong>ESC</strong> to exit</span>
        </div>
      </div>
    </div>
  );
}
