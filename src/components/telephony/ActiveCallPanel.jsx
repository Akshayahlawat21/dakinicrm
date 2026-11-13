import React, { useState } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  Radio,
  Hash,
  ChevronDown,
  ChevronUp,
  Volume2,
  AlertCircle,
  PhoneCall,
  User,
  GitMerge,
  Users,
  Pause,
  Play,
  PhoneForwarded,
} from 'lucide-react';
import { useDialer } from '../../context/CallContext';

export default function ActiveCallPanel() {
  const {
    callState,
    activeCall,
    callDuration,
    isMuted,
    toggleMute,
    sendDTMF,
    clearDTMFHistory,
    dtmfHistory,
    isOnHold,
    toggleHold,
    mergeCall,
    endCall,
    dismissCall,
    liveKitConnected,
    pstnConnected,
    errorMessage,
    clearError,
  } = useDialer();

  const [isKeypadVisible, setIsKeypadVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeDigits, setMergeDigits] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState(null);

  const handleMergeSubmit = async (e) => {
    e?.preventDefault();
    const digits = mergeDigits.replace(/[^\d+]/g, '').trim();
    if (!digits || isMerging) return;
    setIsMerging(true);
    setMergeMessage(null);
    try {
      await mergeCall({
        phoneNumber: digits,
        contactName: 'Conference Participant',
      });
      setMergeMessage('✓ Call merged into conference');
      setMergeDigits('');
      setTimeout(() => setMergeMessage(null), 4000);
    } catch (err) {
      setMergeMessage(`Merge failed: ${err.message || 'Error merging call'}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Only display when a call is active, ending, or failed
  if (callState === 'idle') return null;

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = () => {
    if (isOnHold) return 'Call On Hold';
    if (activeCall?.mergedParticipants?.length > 0) {
      return `Conference (${activeCall.mergedParticipants.length + 1} participants)`;
    }
    switch (callState) {
      case 'connecting':
        return 'Connecting LiveKit softphone...';
      case 'dialing':
        return 'Dialing carrier PSTN...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return 'Call Connected';
      case 'completed':
        return 'Call Ended';
      case 'failed':
        return 'Call Failed';
      default:
        return 'In Progress';
    }
  };

  const statusBg =
    callState === 'connected'
      ? 'var(--success-bg)'
      : callState === 'failed'
      ? 'var(--danger-bg)'
      : 'var(--primary-light)';

  const statusColor =
    callState === 'connected'
      ? 'var(--success)'
      : callState === 'failed'
      ? 'var(--danger-text)'
      : 'var(--primary)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9998,
        width: isMinimized ? 280 : 340,
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: statusBg,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: statusColor,
            }}
            className={callState === 'connected' || callState === 'dialing' ? 'animate-pulse' : ''}
          />
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {getStatusLabel()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {callState === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
              <Clock size={13} />
              <span>{formatTimer(callDuration)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 2,
            }}
            title={isMinimized ? 'Expand call window' : 'Minimize call window'}
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {(callState === 'failed' || callState === 'completed') && (
            <button
              type="button"
              onClick={dismissCall}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontWeight: 800,
                fontSize: '0.9rem',
              }}
              title="Close panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Body (if not minimized) */}
      {!isMinimized && (
        <div style={{ padding: '0.85rem 1rem' }}>
          {/* Contact Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--surface-soft)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.9rem',
                border: '1px solid var(--border-default)',
              }}
            >
              {activeCall?.contactName ? activeCall.contactName[0].toUpperCase() : <User size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeCall?.contactName || 'External Recipient'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {activeCall?.toNumber || '—'}
              </div>
            </div>
          </div>

          {/* Connection telemetry pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-soft)',
              borderRadius: 8,
              padding: '0.4rem 0.65rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              marginBottom: '0.85rem',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Radio size={12} color={liveKitConnected ? 'var(--success)' : 'var(--text-muted)'} />
              <span>WebRTC: {liveKitConnected ? 'Connected' : 'Connecting'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: pstnConnected ? 'var(--success)' : 'var(--warning)',
                }}
              />
              <span>PSTN: {pstnConnected ? 'Active' : 'Dialing'}</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                borderRadius: 8,
                fontSize: '0.75rem',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{errorMessage}</span>
              <button
                type="button"
                onClick={clearError}
                style={{ border: 0, background: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* In-Call DTMF Pad (Collapsible) */}
          {isKeypadVisible && (
            <div
              style={{
                marginBottom: '0.75rem',
                background: 'var(--surface-soft)',
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                padding: '0.5rem',
              }}
            >
              {/* Dialed Digits Output Screen */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.5rem',
                  marginBottom: '0.45rem',
                  background: 'var(--bg-card)',
                  borderRadius: 6,
                  border: '1px solid var(--border-default)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  minHeight: 28,
                }}
              >
                <span>{dtmfHistory ? `DTMF: ${dtmfHistory}` : 'Dialpad ready (click digits)'}</span>
                {dtmfHistory && (
                  <button
                    type="button"
                    onClick={clearDTMFHistory}
                    style={{
                      border: 0,
                      background: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.35rem',
                }}
              >
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => sendDTMF(d)}
                    className="keypad-btn"
                    style={{
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      outline: 'none',
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.92)';
                      e.currentTarget.style.background = 'var(--primary-light)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = 'var(--bg-card)';
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Call Merge Drawer */}
          {isMergeOpen && (
            <div
              style={{
                padding: '0.65rem 0.75rem',
                background: 'var(--surface-soft)',
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                marginBottom: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  <GitMerge size={14} color="var(--primary)" />
                  <span>Merge Call (Add Participant)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMergeOpen(false)}
                  style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <input
                  type="tel"
                  placeholder="Enter number (+91...)"
                  value={mergeDigits}
                  onChange={(e) => setMergeDigits(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)',
                    borderRadius: 6,
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleMergeSubmit}
                  disabled={isMerging || !mergeDigits.trim()}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: isMerging || !mergeDigits.trim() ? 'not-allowed' : 'pointer',
                    opacity: isMerging || !mergeDigits.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <PhoneForwarded size={12} />
                  <span>{isMerging ? 'Merging...' : 'Merge'}</span>
                </button>
              </div>

              {mergeMessage && (
                <div
                  style={{
                    marginTop: '0.4rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: mergeMessage.startsWith('✓') ? 'var(--success)' : 'var(--danger-text)',
                  }}
                >
                  {mergeMessage}
                </div>
              )}
            </div>
          )}

          {/* Call Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Mute */}
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                background: isMuted ? 'var(--danger-bg)' : 'var(--surface-soft)',
                color: isMuted ? 'var(--danger-text)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isMuted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            {/* Hold / Resume */}
            <button
              type="button"
              onClick={toggleHold}
              title={isOnHold ? 'Resume call' : 'Hold call'}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                background: isOnHold ? 'var(--warning-bg, #fef3c7)' : 'var(--surface-soft)',
                color: isOnHold ? 'var(--warning-text, #d97706)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isOnHold ? <Play size={17} /> : <Pause size={17} />}
            </button>

            {/* Merge Call Button */}
            <button
              type="button"
              onClick={() => setIsMergeOpen(!isMergeOpen)}
              title="Merge call / Add conference participant"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                background: isMergeOpen ? 'var(--primary-light)' : 'var(--surface-soft)',
                color: isMergeOpen ? 'var(--primary)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <GitMerge size={17} />
            </button>

            {/* DTMF Keypad Toggle */}
            <button
              type="button"
              onClick={() => setIsKeypadVisible(!isKeypadVisible)}
              title="Show DTMF keypad"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: '1px solid var(--border-default)',
                background: isKeypadVisible ? 'var(--primary-light)' : 'var(--surface-soft)',
                color: isKeypadVisible ? 'var(--primary)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Hash size={17} />
            </button>

            {/* Hangup */}
            <button
              type="button"
              onClick={callState === 'failed' ? dismissCall : endCall}
              title={callState === 'failed' ? 'Dismiss error' : 'Hang up call'}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: 'var(--danger)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(239, 68, 68, 0.25)',
              }}
            >
              <PhoneOff size={15} />
              <span>{callState === 'failed' ? 'Dismiss' : 'Hang Up'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

