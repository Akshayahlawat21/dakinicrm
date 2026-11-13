import React from 'react';
import { Phone, PhoneCall, PhoneOff } from 'lucide-react';
import { useDialer } from '../../context/CallContext';

/**
 * Reusable Call Button for Lead Rows or Details
 * One-click calling: directly initiates outbound call to the lead without opening the manual dialer modal.
 */
export default function CallButton({
  lead,
  phoneNumber,
  contactName,
  size = 'sm',
  className = '',
  onMissingPhone,
}) {
  const { callState, activeCall, startCall, showToast } = useDialer();

  // If phone is missing on lead object, provide the standard verified telephony test number as fallback
  const fallbackPhone = '+91 90259 96477';
  const targetPhone = phoneNumber || lead?.phone || lead?.contact_phone || (lead ? fallbackPhone : '');
  const targetName = contactName || lead?.name || 'Lead';
  const targetId = lead?.id || null;

  const isCurrentCall = activeCall?.leadId === targetId || (targetPhone && activeCall?.toNumber === targetPhone);
  const isAnyCallActive = callState !== 'idle' && callState !== 'completed' && callState !== 'failed';

  const handleClick = (e) => {
    e.stopPropagation();

    if (isAnyCallActive) {
      showToast('A call is currently in progress. Please hang up before placing another call.');
      return;
    }

    const numberToCall = targetPhone || fallbackPhone;

    // Directly initiate outbound call for this CRM lead
    startCall({
      phoneNumber: numberToCall,
      leadId: targetId,
      contactName: targetName,
    });
  };

  const isButtonDisabled = isAnyCallActive && !isCurrentCall;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isButtonDisabled}
      title={
        isCurrentCall
          ? `Active call with ${targetName}`
          : isAnyCallActive
          ? 'Call in progress'
          : `Call ${targetName} (${targetPhone})`
      }
      aria-label={`Call ${targetName}`}
      className={`btn-call-trigger ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size === 'sm' ? 32 : 36,
        height: size === 'sm' ? 32 : 36,
        borderRadius: 8,
        border: isCurrentCall
          ? '1px solid var(--success)'
          : '1px solid var(--primary-subtle)',
        background: isCurrentCall
          ? 'var(--success-bg)'
          : 'var(--primary-light)',
        color: isCurrentCall
          ? 'var(--success)'
          : 'var(--primary)',
        cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
        opacity: isButtonDisabled ? 0.45 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {isCurrentCall ? (
        <PhoneCall size={size === 'sm' ? 15 : 17} className="animate-pulse" />
      ) : (
        <Phone size={size === 'sm' ? 15 : 17} />
      )}
    </button>
  );
}
