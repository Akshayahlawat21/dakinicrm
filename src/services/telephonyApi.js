import { gatewayFetch } from './api';

/**
 * Dakini Telephony API Service
 * Handles outbound calling, WebRTC LiveKit token minting, hangup, and call status.
 */

function unwrapResponse(res, defaultErrMsg = 'Telephony request failed') {
  if (!res) throw new Error(defaultErrMsg);
  if (res.success === false) {
    const msg = res.error?.message || res.message || defaultErrMsg;
    throw new Error(msg);
  }
  // StandardResponse returns { status: 'success', data: { ... } }
  // gatewayFetch wraps it in { success: true, data: { status: 'success', data: { ... } } }
  if (res.data && res.data.data !== undefined) {
    return res.data.data;
  }
  if (res.data !== undefined) {
    return res.data;
  }
  return res;
}

export async function getTelephonyConfig() {
  const res = await gatewayFetch('/telephony/config');
  return unwrapResponse(res, 'Failed to retrieve telephony configuration');
}

export async function mintTelephonyToken({ room, identity, name } = {}) {
  const res = await gatewayFetch('/telephony/token', {
    method: 'POST',
    body: JSON.stringify({ room, identity, name }),
  });
  return unwrapResponse(res, 'Failed to generate softphone LiveKit token');
}

export async function initiateOutboundCall({
  toNumber,
  leadId = null,
  contactName = null,
  room = null,
  record = true,
}) {
  const res = await gatewayFetch('/telephony/call', {
    method: 'POST',
    body: JSON.stringify({
      to_number: toNumber,
      lead_id: leadId,
      contact_name: contactName,
      room,
      record,
    }),
  });
  return unwrapResponse(res, 'Call initiation failed on telephony backend');
}

export async function hangupCall({ room, callId = null, leadId = null }) {
  const res = await gatewayFetch('/telephony/hangup', {
    method: 'POST',
    body: JSON.stringify({
      room,
      call_id: callId,
      lead_id: leadId,
    }),
  });
  return unwrapResponse(res, 'Failed to hang up call');
}

export async function getRoomStatus(room) {
  const res = await gatewayFetch(`/telephony/room-status?room=${encodeURIComponent(room)}`);
  return unwrapResponse(res, 'Failed to check room status');
}

export async function getActiveCalls() {
  const res = await gatewayFetch('/telephony/active');
  return unwrapResponse(res, 'Failed to retrieve active calls');
}

export async function getCallHistory() {
  const res = await gatewayFetch('/telephony/history');
  return unwrapResponse(res, 'Failed to retrieve call history');
}

export async function sendDTMFTone({ room, digit }) {
  const res = await gatewayFetch('/telephony/dtmf', {
    method: 'POST',
    body: JSON.stringify({ room, digit }),
  });
  return unwrapResponse(res, 'Failed to send DTMF tone');
}

export async function controlCall({ callId, action, transferTo = null }) {
  const res = await gatewayFetch('/telephony/control', {
    method: 'POST',
    body: JSON.stringify({
      call_id: callId,
      action,
      transfer_to: transferTo,
    }),
  });
  return unwrapResponse(res, `Failed to execute ${action} on call`);
}

export async function mergeCallApi({ room, toNumber, contactName = null, leadId = null }) {
  const res = await gatewayFetch('/telephony/merge', {
    method: 'POST',
    body: JSON.stringify({
      room,
      to_number: toNumber,
      contact_name: contactName,
      lead_id: leadId,
    }),
  });
  return unwrapResponse(res, 'Failed to merge call into room conference');
}
