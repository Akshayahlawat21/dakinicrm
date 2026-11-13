import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Delete,
  X,
  Mic,
  MicOff,
  Volume2,
  Clock,
  UserPlus,
  AlertCircle,
  Hash,
  Sparkles,
  Minus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useDialer, playDTMFSound } from '../../context/CallContext';
import { useCRM } from '../../context/CRMContext';

const KEYPAD_BUTTONS = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '' },
];

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: '+91 (India)' },
  { code: '+1', country: 'US', label: '+1 (US/Canada)' },
  { code: '+44', country: 'GB', label: '+44 (UK)' },
  { code: '+61', country: 'AU', label: '+61 (Australia)' },
  { code: '+65', country: 'SG', label: '+65 (Singapore)' },
  { code: '+971', country: 'AE', label: '+971 (UAE)' },
  { code: '+49', country: 'DE', label: '+49 (Germany)' },
];

export default function DialerModal() {
  const {
    isDialerOpen,
    closeDialer,
    dialerPrefill,
    callState,
    activeCall,
    callDuration,
    startCall,
    endCall,
    isMuted,
    toggleMute,
    sendDTMF,
    isMicActive,
    liveKitConnected,
    pstnConnected,
    errorMessage,
    clearError,
  } = useDialer();

  const { setIsQuickCreateOpen, setQuickCreateType } = useCRM();

  const [countryCode, setCountryCode] = useState('+91');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [contactName, setContactName] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  // Sync prefilled information when opened
  useEffect(() => {
    if (dialerPrefill) {
      if (dialerPrefill.phoneNumber) {
        let raw = dialerPrefill.phoneNumber.trim();
        // Extract country code if present
        const matched = COUNTRY_CODES.find((c) => raw.startsWith(c.code));
        if (matched) {
          setCountryCode(matched.code);
          setPhoneDigits(raw.slice(matched.code.length).replace(/[^\d]/g, ''));
        } else {
          setPhoneDigits(raw.replace(/[^\d+]/g, ''));
        }
      } else {
        setPhoneDigits('');
      }
      setContactName(dialerPrefill.contactName || '');
    }
  }, [dialerPrefill]);

  if (!isDialerOpen) return null;

  const fullNumber = phoneDigits.startsWith('+') ? phoneDigits : `${countryCode}${phoneDigits}`;
  const isCallActive = callState !== 'idle' && callState !== 'completed' && callState !== 'failed';

  const handleDigitClick = (digit) => {
    playDTMFSound(digit);
    if (isCallActive) {
      // In-call DTMF mode
      sendDTMF(digit);
    } else {
      setPhoneDigits((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPhoneDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneDigits('');
  };

  const handleInitiateCall = () => {
    const cleanedDigits = phoneDigits.replace(/[^\d+]/g, '').trim();
    if (!cleanedDigits) return;
    clearError();
    startCall({
      phoneNumber: fullNumber,
      leadId: dialerPrefill?.leadId || null,
      contactName: contactName || dialerPrefill?.contactName || null,
    });
  };

  const handleSaveAsLead = () => {
    if (setIsQuickCreateOpen) {
      setQuickCreateType('lead');
      setIsQuickCreateOpen(true);
      closeDialer();
    }
  };

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="floating-softphone-panel"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9991,
        width: isMinimized ? 280 : 340,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'auto',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        className="crm-card"
        style={{
          width: '100%',
          background: 'var(--bg-card)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1rem',
            borderBottom: isMinimized ? 'none' : '1px solid var(--border-default)',
            background: 'var(--surface-soft)',
            cursor: isMinimized ? 'pointer' : 'default',
          }}
          onClick={() => isMinimized && setIsMinimized(false)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone size={15} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2 }}>
                Phone Dialer
              </div>
              {!isMinimized && (
                <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                  Floating Softphone
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              title={isMinimized ? 'Expand dialer' : 'Minimize dialer'}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isMinimized ? <ChevronUp size={16} /> : <Minus size={16} />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeDialer();
              }}
              title="Close dialer"
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>

        {/* Call Banner if Active */}
        {isCallActive && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: callState === 'connected' ? 'var(--success-bg)' : 'var(--primary-light)',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: callState === 'connected' ? 'var(--success)' : 'var(--primary)',
                }}
                className="animate-ping"
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {callState === 'connecting'
                  ? 'Connecting softphone...'
                  : callState === 'dialing'
                  ? 'Dialing recipient...'
                  : 'Call Connected'}
              </span>
            </div>
            {callState === 'connected' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                <Clock size={13} />
                <span>{formatTimer(callDuration)}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              padding: '0.65rem 1rem',
              background: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              borderBottom: '1px solid var(--danger-border)',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
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

        {/* Number Input & Country Code */}
        <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
          {contactName && (
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
              Calling: {contactName}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--surface-soft)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '0.35rem 0.5rem',
              gap: '0.4rem',
            }}
          >
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              disabled={isCallActive}
              aria-label="Country Code"
              className="country-code-select"
              style={{
                background: 'var(--surface-soft, #1e293b)',
                border: '1px solid var(--border-default, #334155)',
                borderRadius: 8,
                padding: '0.25rem 0.35rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-main, #f8fafc)',
                cursor: 'pointer',
                outline: 'none',
                width: 82,
                flexShrink: 0,
                colorScheme: 'dark',
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <option
                  key={c.code}
                  value={c.code}
                  style={{
                    backgroundColor: '#111827',
                    color: '#f8fafc',
                  }}
                >
                  {c.code} ({c.country})
                </option>
              ))}
            </select>
            <input
              type="tel"
              placeholder="Enter number..."
              value={phoneDigits}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/[^\d+*#]/g, ''))}
              disabled={isCallActive}
              style={{
                flex: 1,
                border: 0,
                background: 'transparent',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                outline: 'none',
                letterSpacing: '0.04em',
                minWidth: 0,
              }}
            />
            {phoneDigits && !isCallActive && (
              <button
                type="button"
                onClick={handleBackspace}
                title="Backspace"
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <Delete size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Keypad Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.6rem',
            padding: '0.75rem 1.25rem',
          }}
        >
          {KEYPAD_BUTTONS.map((btn) => (
            <button
              key={btn.digit}
              type="button"
              onClick={() => handleDigitClick(btn.digit)}
              className="keypad-btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 52,
                borderRadius: 12,
                border: '1px solid var(--border-default)',
                background: 'var(--surface-soft)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.1 }}>{btn.digit}</span>
              {btn.sub && (
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>
                  {btn.sub}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '0.85rem 1.25rem 1.1rem',
          }}
        >
          {isCallActive ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '1px solid var(--border-default)',
                  background: isMuted ? 'var(--danger-bg)' : 'var(--surface-soft)',
                  color: isMuted ? 'var(--danger-text)' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="button"
                onClick={endCall}
                title="Hang up call"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: 'var(--danger)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
              >
                <PhoneOff size={18} />
                <span>Hang Up</span>
              </button>
            </>
          ) : (
            <>
              {phoneDigits && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn btn-secondary btn-sm"
                  style={{ height: 46, padding: '0 1rem' }}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={!phoneDigits.trim()}
                onClick={handleInitiateCall}
                title="Start outbound call"
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 12,
                  border: 'none',
                  background: phoneDigits.trim() ? 'var(--success)' : 'var(--border-default)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: phoneDigits.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: phoneDigits.trim() ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Phone size={18} />
                <span>Call {phoneDigits ? `${countryCode} ${phoneDigits}` : ''}</span>
              </button>
            </>
          )}
        </div>

        {/* Footer: Hardware Status & Save as Lead */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--surface-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isMicActive ? 'var(--success)' : 'var(--text-muted)',
              }}
            />
            <span>Mic: {isMicActive ? 'Ready' : 'Standby'}</span>
          </div>

          {phoneDigits && !dialerPrefill?.leadId && !isCallActive && (
            <button
              type="button"
              onClick={handleSaveAsLead}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                border: 0,
                background: 'transparent',
                color: 'var(--primary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '0.725rem',
              }}
            >
              <UserPlus size={12} />
              <span>Save as Lead</span>
            </button>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}

