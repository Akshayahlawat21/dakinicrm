import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3,
  LoaderCircle, PhoneCall, PhoneForwarded, RefreshCw, Search,
  StopCircle, XCircle, Users, ExternalLink, Sparkles
} from 'lucide-react';
import {
  analyzeDakiniCall, getDakiniBatchCalls, listDakiniBatches, scheduleDakiniBatch, stopDakiniBatch
} from '../services/dakiniCallingApi';

const SCHEDULABLE_BATCH_STATUSES = new Set(['created', 'pending']);
const STOPPABLE_BATCH_STATUSES = new Set(['pending', 'scheduled', 'running']);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!value) return '—';
  const minutes = Math.floor(value / 60);
  const remaining = value % 60;
  return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

// datetime-local inputs do not carry a timezone. Treat the selected value as IST
// explicitly so the API receives the intended time even when the browser timezone differs.
function istDateTimeLocalMinimum() {
  const indiaNow = new Date(Date.now() + 60 * 1000 + 330 * 60 * 1000);
  const pad = (number) => String(number).padStart(2, '0');
  return `${indiaNow.getUTCFullYear()}-${pad(indiaNow.getUTCMonth() + 1)}-${pad(indiaNow.getUTCDate())}T${pad(indiaNow.getUTCHours())}:${pad(indiaNow.getUTCMinutes())}`;
}

function istDateTimeLocalToIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcMilliseconds = Date.UTC(year, month - 1, day, hour, minute) - (330 * 60 * 1000);
  return new Date(utcMilliseconds).toISOString();
}

function statusStyle(status) {
  const normalized = String(status || 'pending').toLowerCase();
  if (normalized === 'completed') return { color: 'var(--success-text)', background: 'var(--success-bg)' };
  if (normalized === 'running') return { color: 'var(--primary)', background: 'var(--primary-light)' };
  if (normalized === 'scheduled') return { color: 'var(--info-text, var(--primary))', background: 'var(--info-bg, var(--primary-light))' };
  if (normalized === 'failed') return { color: 'var(--danger-text)', background: 'var(--danger-bg)' };
  if (normalized === 'stopped') return { color: 'var(--text-muted)', background: 'var(--bg-hover)' };
  return { color: 'var(--warning-text)', background: 'var(--warning-bg)' };
}

function StatusPill({ status }) {
  return (
    <span style={{ ...statusStyle(status), display: 'inline-flex', alignItems: 'center', padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 750, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {String(status || 'pending').replaceAll('_', ' ')}
    </span>
  );
}

function MetricCard({ label, value, icon: Icon, accent }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 14, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 10, background: accent || 'var(--primary-light)', color: 'var(--primary)' }}><Icon size={17} /></span>
      </div>
      <div style={{ marginTop: 9, fontSize: 27, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-.04em', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

export default function AICallingPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBatchId, setExpandedBatchId] = useState('');
  const [batchCalls, setBatchCalls] = useState({});
  const [batchCallTotals, setBatchCallTotals] = useState({});
  const [callsLoading, setCallsLoading] = useState({});
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [analyzingCallIds, setAnalyzingCallIds] = useState({});
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const rows = await listDakiniBatches(100);
      setBatches(Array.isArray(rows) ? rows : []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err?.message || 'Unable to load Dakini batch records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load batches once when the page opens. Further updates happen only
  // when the user clicks the manual Refresh button.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = useMemo(() => batches.reduce((sum, batch) => ({
    batches: sum.batches + 1,
    contacts: sum.contacts + Number(batch.total_contacts || 0),
    triggered: sum.triggered + Number(batch.triggered_count ?? batch.calls_tracked ?? 0),
    completed: sum.completed + Number(batch.completed_count || 0),
    ongoing: sum.ongoing + Number(batch.ongoing_count || 0),
    failed: sum.failed + Number(batch.failed_count || 0),
    notTriggered: sum.notTriggered + Number(batch.not_triggered_count || 0),
    running: sum.running + (String(batch.status).toLowerCase() === 'running' ? 1 : 0),
    scheduled: sum.scheduled + (String(batch.status).toLowerCase() === 'scheduled' ? 1 : 0),
  }), { batches: 0, contacts: 0, triggered: 0, completed: 0, ongoing: 0, failed: 0, notTriggered: 0, running: 0, scheduled: 0 }), [batches]);

  const filteredBatches = useMemo(() => batches.filter((batch) => {
    const matchesText = !search || [batch.batch_id, batch.file_name, batch.status].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || String(batch.status || '').toLowerCase() === statusFilter;
    return matchesText && matchesStatus;
  }), [batches, search, statusFilter]);

  const showBatchCalls = (batchId) => {
    setExpandedBatchId((current) => current === batchId ? '' : batchId);
  };

  useEffect(() => {
    if (!expandedBatchId) return undefined;
    let cancelled = false;
    let inFlight = false;
    const batchId = expandedBatchId;
    const refreshExpandedCalls = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      setCallsLoading((current) => ({ ...current, [batchId]: true }));
      try {
        const result = await getDakiniBatchCalls(batchId, 0, 500);
        if (cancelled) return;
        setBatchCalls((current) => ({ ...current, [batchId]: Array.isArray(result?.items) ? result.items : [] }));
        setBatchCallTotals((current) => ({ ...current, [batchId]: Number(result?.total || 0) }));
      } catch (err) {
        if (!cancelled) setNotice({ type: 'error', message: err?.message || 'Could not refresh individual call details.' });
      } finally {
        inFlight = false;
        if (!cancelled) setCallsLoading((current) => ({ ...current, [batchId]: false }));
      }
    };
    refreshExpandedCalls();
    // Fetch expanded call records once when a batch is opened.
    // No background polling; the user can use the page Refresh action.
    return () => { cancelled = true; };
  }, [expandedBatchId]);

  const handleAnalyzeCall = async (call) => {
    const callId = String(call?.call_id || '');
    if (!callId || !call.transcript_saved || analyzingCallIds[callId]) return;
    setAnalyzingCallIds((current) => ({ ...current, [callId]: true }));
    setNotice(null);
    try {
      await analyzeDakiniCall(callId);
      const result = await getDakiniBatchCalls(expandedBatchId, 0, 500);
      setBatchCalls((current) => ({ ...current, [expandedBatchId]: Array.isArray(result?.items) ? result.items : [] }));
      setBatchCallTotals((current) => ({ ...current, [expandedBatchId]: Number(result?.total || 0) }));
      setNotice({ type: 'success', message: `AI analysis completed for ${call.lead_name || call.phone_number || 'this call'}.` });
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'AI analysis failed. The transcript remains saved.' });
    } finally {
      setAnalyzingCallIds((current) => ({ ...current, [callId]: false }));
    }
  };

  const loadMoreBatchCalls = async (batchId) => {
    const existing = batchCalls[batchId] || [];
    if (callsLoading[batchId] || existing.length >= Number(batchCallTotals[batchId] || 0)) return;
    setCallsLoading((current) => ({ ...current, [batchId]: true }));
    try {
      const result = await getDakiniBatchCalls(batchId, existing.length, 100);
      setBatchCalls((current) => ({ ...current, [batchId]: [...(current[batchId] || []), ...(Array.isArray(result?.items) ? result.items : [])] }));
      setBatchCallTotals((current) => ({ ...current, [batchId]: Number(result?.total || 0) }));
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'Could not load more individual calls.' });
    } finally {
      setCallsLoading((current) => ({ ...current, [batchId]: false }));
    }
  };

  const submitSchedule = async (event) => {
    event.preventDefault();
    if (!scheduleTarget || !scheduleValue || actionLoading) return;
    const scheduledAtIso = istDateTimeLocalToIso(scheduleValue);
    const scheduledAtDate = scheduledAtIso ? new Date(scheduledAtIso) : null;
    if (!scheduledAtDate || Number.isNaN(scheduledAtDate.getTime()) || scheduledAtDate <= new Date()) {
      setNotice({ type: 'error', message: 'Choose a future date and time in IST.' });
      return;
    }
    setActionLoading(scheduleTarget.batch_id);
    try {
      await scheduleDakiniBatch(scheduleTarget.batch_id, scheduledAtIso);
      setNotice({ type: 'success', message: `Batch ${scheduleTarget.batch_id} scheduled successfully.` });
      setScheduleTarget(null);
      setScheduleValue('');
      await refresh(true);
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'Could not schedule this batch.' });
    } finally {
      setActionLoading('');
    }
  };

  const handleStop = async (batch) => {
    if (actionLoading) return;
    const confirmed = window.confirm(`Stop batch ${batch.batch_id}? Dakini will stop pending calls. Calls already active may finish naturally. This batch cannot be restarted.`);
    if (!confirmed) return;
    setActionLoading(batch.batch_id);
    try {
      await stopDakiniBatch(batch.batch_id);
      setNotice({ type: 'success', message: `Stop request submitted for batch ${batch.batch_id}.` });
      await refresh(true);
    } catch (err) {
      setNotice({ type: 'error', message: err?.message || 'Could not stop this batch.' });
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--primary)', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}><Sparkles size={15}/> Dakini AI Calling</div>
          <h1 style={{ margin: '7px 0 4px', color: 'var(--text-main)', fontSize: 26, fontWeight: 800 }}>Batch Management</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Schedule and monitor calls. Transcripts sync automatically; AI analysis runs only when you click AI Analyse.</p>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => refresh()} disabled={refreshing} style={secondaryButtonStyle}><RefreshCw size={15} className={refreshing ? 'spin' : ''}/> Refresh</button>
          <button type="button" onClick={() => navigate('/leads')} style={primaryButtonStyle}><PhoneForwarded size={16}/> Create batch from Leads</button>
        </div>
      </div>

      {notice && (
        <div role="status" style={{ padding: '11px 14px', borderRadius: 10, border: `1px solid ${notice.type === 'error' ? 'var(--danger-border, #ef4444)' : 'var(--success-border, #16a34a)'}`, color: notice.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)', background: notice.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
          {notice.message}<button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)} style={iconButtonStyle}><XCircle size={16}/></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12 }}>
        <MetricCard label="Total batches" value={totals.batches} icon={Activity}/>
        <MetricCard label="Contacts submitted" value={totals.contacts} icon={Users}/>
        <MetricCard label="Calls triggered" value={totals.triggered} icon={PhoneCall}/>
        <MetricCard label="Calls completed" value={totals.completed} icon={CheckCircle2} accent="var(--success-bg)"/>
        <MetricCard label="Calls ongoing" value={totals.ongoing} icon={LoaderCircle} accent="var(--primary-light)"/>
        <MetricCard label="Calls failed" value={totals.failed} icon={XCircle} accent="var(--danger-bg)"/>
        <MetricCard label="Not yet triggered" value={totals.notTriggered} icon={Clock3} accent="var(--warning-bg)"/>
      </div>

      <section style={{ border: '1px solid var(--border-default)', background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: 'var(--text-main)' }}>Calling batches</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>Batch and call records load when you open the page or click Refresh. Transcripts are saved automatically; AI analysis runs only when you click AI Analyse.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search batch ID" style={{ ...inputStyle, paddingLeft: 31, width: 190 }}/></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle}>
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="running">Running</option><option value="completed">Completed</option><option value="stopped">Stopped</option><option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {error && <div style={{ padding: 14, color: 'var(--danger-text)', background: 'var(--danger-bg)', fontSize: 13 }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 42, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}><LoaderCircle className="animate-spin" size={22}/><span style={{ marginTop: 8, fontSize: 13 }}>Loading batch details…</span></div>
        ) : filteredBatches.length === 0 ? (
          <div style={{ padding: '46px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'grid', placeItems: 'center', borderRadius: 14, background: 'var(--primary-light)', color: 'var(--primary)' }}><PhoneCall size={22}/></div>
            <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)' }}>{batches.length ? 'No batches match your filters' : 'No Dakini batches yet'}</h3>
            <p style={{ margin: '6px auto 15px', maxWidth: 390, color: 'var(--text-muted)', fontSize: 13 }}>{batches.length ? 'Try another search or status filter.' : 'Select multiple leads on the Leads page and choose Dakini AI Call to create your first batch.'}</p>
            {!batches.length && <button type="button" onClick={() => navigate('/leads')} style={primaryButtonStyle}>Go to Leads</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
              <thead><tr style={{ background: 'var(--bg-subtle, var(--bg-hover))', textAlign: 'left' }}>
                {['Batch / ID', 'Status', 'Contacts', 'Triggered', 'Completed', 'Ongoing', 'Failed', 'Progress', 'Scheduled at', 'Actions'].map((label) => <th key={label} style={tableHeadStyle}>{label}</th>)}
              </tr></thead>
              <tbody>
                {filteredBatches.map((batch) => {
                  const id = batch.batch_id;
                  const expanded = expandedBatchId === id;
                  const progress = Math.max(0, Math.min(100, Number(batch.progress_percent || 0)));
                  const status = String(batch.status || 'pending').toLowerCase();
                  const isBusy = actionLoading === id;
                  return <React.Fragment key={id}>
                    <tr style={{ borderTop: '1px solid var(--border-default)' }}>
                      <td style={tableCellStyle}>
                        <button type="button" onClick={() => showBatchCalls(id)} style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--primary)', fontWeight: 750, cursor: 'pointer', textAlign: 'left' }}>{id || 'Unknown batch'}</button>
                        <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>{batch.file_name || 'Dakini contact list'} · {formatDate(batch.created_at)}</div>
                      </td>
                      <td style={tableCellStyle}><StatusPill status={status}/></td>
                      <td style={numericCellStyle}>{Number(batch.total_contacts || 0).toLocaleString()}</td>
                      <td style={numericCellStyle}><strong>{Number(batch.triggered_count ?? batch.calls_tracked ?? 0).toLocaleString()}</strong><div style={{ color: 'var(--text-muted)', fontSize: 10 }}>call IDs received</div></td>
                      <td style={numericCellStyle}>{Number(batch.completed_count || 0).toLocaleString()}</td>
                      <td style={numericCellStyle}>{Number(batch.ongoing_count || 0).toLocaleString()}</td>
                      <td style={numericCellStyle}>{Number(batch.failed_count || 0).toLocaleString()}</td>
                      <td style={{ ...tableCellStyle, minWidth: 120 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ height: 7, flex: 1, background: 'var(--bg-hover)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${progress}%`, background: 'var(--success-text)', borderRadius: 99 }}/></div><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-main)' }}>{progress}%</span></div><div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>{Number(batch.not_triggered_count || 0)} not triggered</div></td>
                      <td style={{ ...tableCellStyle, fontSize: 11, whiteSpace: 'nowrap' }}>{formatDate(batch.scheduled_at)}</td>
                      <td style={tableCellStyle}><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {SCHEDULABLE_BATCH_STATUSES.has(status) && !batch.scheduled_at && <button type="button" disabled={isBusy} onClick={() => { setScheduleTarget(batch); setScheduleValue(''); }} title="Schedule batch" style={smallActionButtonStyle}><CalendarClock size={14}/> Schedule</button>}
                        {STOPPABLE_BATCH_STATUSES.has(status) && <button type="button" disabled={isBusy} onClick={() => handleStop(batch)} title="Stop batch" style={dangerActionButtonStyle}>{isBusy ? <LoaderCircle size={14} className="animate-spin"/> : <StopCircle size={14}/>} Stop</button>}
                        <button type="button" onClick={() => showBatchCalls(id)} title="View individual calls" style={iconButtonStyle}>{expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</button>
                      </div></td>
                    </tr>
                    {expanded && <tr><td colSpan={10} style={{ padding: 0, background: 'var(--bg-subtle, var(--bg-hover))' }}>
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div><strong style={{ fontSize: 13, color: 'var(--text-main)' }}>Individual call records</strong><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Calls are matched using Dakini batch ID and recipient phone number.</div></div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Manual refresh only</span>
                        </div>
                        {callsLoading[id] ? <div style={{ padding: 22, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}><LoaderCircle className="animate-spin" size={17}/> Loading calls…</div> : !batchCalls[id]?.length ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No individual call records found.</div> : <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', background: 'var(--bg-card)', borderRadius: 8 }}>
                            <thead><tr>{['Lead', 'Phone', 'Attempt', 'Call ID', 'Call status', 'Duration', 'Transcript', 'AI analysis', 'Recording'].map((label) => <th key={label} style={tableHeadStyle}>{label}</th>)}</tr></thead>
                            <tbody>{batchCalls[id].map((call) => <tr key={call.call_id || `${call.lead_id}-${call.phone_number}`} style={{ borderTop: '1px solid var(--border-default)' }}>
                              <td style={tableCellStyle}><div style={{ fontWeight: 650, color: 'var(--text-main)' }}>{call.lead_name || 'Lead'}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{call.company || ''}</div></td>
                              <td style={{ ...tableCellStyle, whiteSpace: 'nowrap' }}>{call.phone_number}</td>
                              <td style={{ ...tableCellStyle, whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 650 }}>#{call.attempt_number || 1}</td>
                              <td style={{ ...tableCellStyle, fontSize: 11 }}>{call.call_id || 'Not triggered yet'}</td>
                              <td style={tableCellStyle}><StatusPill status={call.status}/></td>
                              <td style={tableCellStyle}>{formatDuration(call.duration_seconds)}</td>
                              <td style={{ ...tableCellStyle, minWidth: 170 }}>
                                {call.transcript_saved && call.transcript_text ? (
                                  <details>
                                    <summary style={{ color: 'var(--success-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>View transcript</summary>
                                    <div style={{ marginTop: 8, maxWidth: 360, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, lineHeight: 1.5, color: 'var(--text-main)', padding: 10, borderRadius: 8, background: 'var(--bg-subtle, var(--bg-hover))' }}>{call.transcript_text}</div>
                                  </details>
                                ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{call.transcript_saved ? 'Saved' : 'Waiting'}</span>}
                              </td>
                              <td style={{ ...tableCellStyle, minWidth: 150 }}>
                                {call.analysis_saved ? (
                                  <details>
                                    <summary style={{ color: 'var(--success-text)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>View AI result</summary>
                                    <div style={{ marginTop: 8, minWidth: 220, maxWidth: 340, whiteSpace: 'normal', fontSize: 11, lineHeight: 1.45, color: 'var(--text-main)' }}>
                                      <strong>Summary</strong><div>{call.analysis_result?.summary?.call_summary || call.analysis_result?.summary?.summary || 'Analysis saved.'}</div>
                                      {call.analysis_result?.summary?.product_interest && <div style={{ marginTop: 6 }}><strong>Product interest:</strong> {call.analysis_result.summary.product_interest}</div>}
                                      {call.analysis_result?.improvements && <div style={{ marginTop: 6 }}><strong>Improvements:</strong> {Array.isArray(call.analysis_result.improvements) ? call.analysis_result.improvements.join('; ') : JSON.stringify(call.analysis_result.improvements)}</div>}
                                    </div>
                                  </details>
                                ) : (
                                  <button type="button" disabled={!call.call_id || !call.transcript_saved || !!analyzingCallIds[call.call_id]} onClick={() => handleAnalyzeCall(call)} style={{ ...smallActionButtonStyle, opacity: !call.call_id || !call.transcript_saved ? 0.5 : 1 }}>
                                    {analyzingCallIds[call.call_id] ? <LoaderCircle size={13} className="animate-spin"/> : <Sparkles size={13}/>} AI Analyse
                                  </button>
                                )}
                              </td>
                              <td style={tableCellStyle}>{call.recording_url ? <a href={call.recording_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: 11, display: 'inline-flex', gap: 4, alignItems: 'center' }}>Open <ExternalLink size={12}/></a> : '—'}</td>
                            </tr>)}</tbody>
                          </table>
                          {(batchCalls[id]?.length || 0) < Number(batchCallTotals[id] || 0) && <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}><button type="button" onClick={() => loadMoreBatchCalls(id)} disabled={callsLoading[id]} style={secondaryButtonStyle}>{callsLoading[id] ? <LoaderCircle size={13} className="animate-spin"/> : <ChevronDown size={13}/>} Load more ({batchCalls[id]?.length || 0} of {batchCallTotals[id]})</button></div>}
                        </div>}
                      </div>
                    </td></tr>}
                  </React.Fragment>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '11px 18px', borderTop: '1px solid var(--border-default)', color: 'var(--text-muted)', fontSize: 11 }}>
          <span>Auto-refresh disabled · Last refreshed: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span>
          <span>{filteredBatches.length} of {batches.length} batches</span>
        </div>
      </section>

      {scheduleTarget && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleTarget(null); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.48)', padding: 16 }}>
        <form onSubmit={submitSchedule} style={{ width: 'min(440px, 100%)', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 22, boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,.2))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><h3 style={{ margin: 0, fontSize: 17, color: 'var(--text-main)' }}>Schedule batch</h3><button type="button" onClick={() => setScheduleTarget(null)} style={iconButtonStyle}><XCircle size={18}/></button></div>
          <p style={{ margin: '7px 0 16px', color: 'var(--text-muted)', fontSize: 12 }}>Choose when Dakini should start processing <strong>{scheduleTarget.batch_id}</strong>. The date and time below are interpreted as India Standard Time (IST, Asia/Kolkata).</p>
          <label htmlFor="dakini-scheduled-at" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>Start date and time (IST)</label>
          <input id="dakini-scheduled-at" type="datetime-local" required min={istDateTimeLocalMinimum()} value={scheduleValue} onChange={(event) => setScheduleValue(event.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 18 }}/>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setScheduleTarget(null)} style={secondaryButtonStyle}>Cancel</button><button type="submit" disabled={!scheduleValue || !!actionLoading} style={primaryButtonStyle}>{actionLoading ? <LoaderCircle size={14} className="animate-spin"/> : <CalendarClock size={14}/>} Schedule batch</button></div>
        </form>
      </div>}
    </div>
  );
}

const primaryButtonStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 9, padding: '10px 13px', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 750, cursor: 'pointer' };
const secondaryButtonStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid var(--border-default)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: 12, fontWeight: 650, cursor: 'pointer' };
const inputStyle = { border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text-main)', padding: '8px 10px', fontSize: 12, outline: 'none' };
const iconButtonStyle = { border: 0, background: 'transparent', color: 'var(--text-muted)', padding: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const smallActionButtonStyle = { ...secondaryButtonStyle, padding: '7px 9px', whiteSpace: 'nowrap' };
const dangerActionButtonStyle = { ...smallActionButtonStyle, color: 'var(--danger-text)', borderColor: 'var(--danger-border, var(--border-default))' };
const tableHeadStyle = { padding: '11px 12px', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' };
const tableCellStyle = { padding: '12px', fontSize: 12, color: 'var(--text-main)', verticalAlign: 'middle' };
const numericCellStyle = { ...tableCellStyle, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
