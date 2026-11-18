import React, { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Search,
  RefreshCw,
  User,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Radio,
  Calendar,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { getCallHistory } from '../services/telephonyApi';
import { useDialer } from '../context/CallContext';

export default function CallHistoryPage() {
  const { startCall, openDialer, callState } = useDialer();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCallHistory();
      // Handle array or wrapped object
      const list = Array.isArray(data) ? data : data?.calls || [];
      setCalls(list);
    } catch (err) {
      console.error('Failed to load call history:', err);
      setError(err.message || 'Could not load telephony call records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const stats = useMemo(() => {
    const total = calls.length;
    const completed = calls.filter((c) => c.status === 'completed').length;
    const active = calls.filter((c) => ['dialing', 'ringing', 'connected', 'in-progress'].includes(c.status)).length;
    const totalSecs = calls.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
    const mins = Math.floor(totalSecs / 60);
    const remainingSecs = totalSecs % 60;
    const totalDurationStr = `${mins}m ${remainingSecs}s`;

    return { total, completed, active, totalDurationStr };
  }, [calls]);

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.to_number && c.to_number.toLowerCase().includes(q)) ||
        (c.from_did && c.from_did.toLowerCase().includes(q)) ||
        (c.call_id && c.call_id.toLowerCase().includes(q)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
        (c.room && c.room.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && c.status === 'completed') ||
        (statusFilter === 'ACTIVE' && ['dialing', 'ringing', 'connected'].includes(c.status));

      return matchSearch && matchStatus;
    });
  }, [calls, searchQuery, statusFilter]);

  const formatDuration = (secs) => {
    if (!secs || secs <= 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  const handleCallBack = (item) => {
    const numberToCall = item.to_number || item.phone;
    if (!numberToCall) return;
    startCall({
      phoneNumber: numberToCall,
      contactName: item.contact_name || 'Contact',
      leadId: item.lead_id || null,
    });
  };

  return (
    <div className="crm-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PhoneCall size={20} />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>Call History & Telephony</h1>
              <p className="page-subtitle" style={{ margin: 0, marginTop: 2 }}>
                Live WebRTC outbound call records, durations, timestamps and CRM lead associations
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchHistory}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openDialer()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Phone size={15} />
            <span>Open Dialer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          margin: '1.25rem 0',
        }}
      >
        <div className="crm-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Calls Logged
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {stats.total}
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Completed Calls
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.35rem' }}>
            {stats.completed}
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active / In Progress
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.35rem' }}>
            {stats.active}
          </div>
        </div>

        <div className="crm-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Telephony Time
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.35rem' }}>
            {stats.totalDurationStr}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="crm-card"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 260 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by phone number, lead name, room or call ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.875rem',
              color: 'var(--text-main)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
          {['ALL', 'COMPLETED', 'ACTIVE'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              style={{
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: statusFilter === f ? 'var(--primary-light)' : 'var(--surface-soft)',
                color: statusFilter === f ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Call History Table */}
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        {error && (
          <div
            style={{
              padding: '1rem',
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="crm-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recipient / Lead</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Caller ID</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mode</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duration</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Started At</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Call / Room ID</th>
                <th style={{ padding: '0.85rem 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && calls.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    <div>Loading telephony call records...</div>
                  </td>
                </tr>
              ) : filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <PhoneOff size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700 }}>No call history records found</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                      Outbound calls placed via the Leads table or the softphone dialer will appear here.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCalls.map((item) => {
                  const isCompleted = item.status === 'completed';
                  const isActive = ['dialing', 'ringing', 'connected'].includes(item.status);

                  return (
                    <tr
                      key={item.call_id || item.room || Math.random()}
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      {/* Recipient */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--surface-soft)',
                              color: 'var(--text-main)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              border: '1px solid var(--border-default)',
                            }}
                          >
                            {item.contact_name ? item.contact_name[0].toUpperCase() : <User size={15} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                              {item.contact_name || 'External Recipient'}
                            </div>
                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {item.to_number || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Caller ID */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-body)', fontFamily: 'monospace' }}>
                        {item.from_did || '+917971443119'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: 12,
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            background: isCompleted ? 'var(--success-bg)' : isActive ? 'var(--primary-light)' : 'var(--surface-soft)',
                            color: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--text-muted)',
                            border: `1px solid ${isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--border-default)'}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--text-muted)',
                            }}
                          />
                          {item.status || 'unknown'}
                        </span>
                      </td>

                      {/* Mode */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.775rem', color: 'var(--text-body)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>HUMAN_ONLY</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.mode_used || 'carrier_simulated'}
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={13} color="var(--text-muted)" />
                          <span>{formatDuration(item.duration_seconds)}</span>
                        </div>
                      </td>

                      {/* Started At */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        {formatDate(item.started_at)}
                      </td>

                      {/* Room & Call ID */}
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        <div>ID: {item.call_id || '—'}</div>
                        <div style={{ color: 'var(--text-subtle)' }}>Rm: {item.room || '—'}</div>
                      </td>

                      {/* Call Back Button */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleCallBack(item)}
                          disabled={callState !== 'idle' && callState !== 'completed' && callState !== 'failed'}
                          title={`Call back ${item.to_number}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.35rem 0.65rem',
                            borderRadius: 6,
                            border: '1px solid var(--primary)',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          <Phone size={13} />
                          <span>Call</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

