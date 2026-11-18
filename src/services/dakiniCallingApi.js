import { gatewayFetch } from './api';

function unwrap(res, fallback = 'Dakini Calling request failed') {
  if (!res) throw new Error(fallback);
  if (res.success === false) throw new Error(res.error?.message || res.message || fallback);
  if (res.data?.data !== undefined) return res.data.data;
  if (res.data !== undefined) return res.data;
  return res;
}

export async function initiateDakiniLeadCall(leadId) {
  const res = await gatewayFetch(`/dakini-calling/leads/${encodeURIComponent(leadId)}/call`, { method: 'POST' });
  return unwrap(res, 'Could not start Dakini AI call');
}

export async function createDakiniCallBatch(leadIds) {
  const res = await gatewayFetch('/dakini-calling/batches', {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds }),
  });
  return unwrap(res, 'Could not create Dakini AI batch');
}

export async function getDakiniCallStatus(callId) {
  const res = await gatewayFetch(`/dakini-calling/calls/${encodeURIComponent(callId)}`, { method: 'GET' });
  return unwrap(res, 'Could not retrieve Dakini call status');
}

export async function getDakiniLeadsCallStatuses(leadIds) {
  const ids = Array.isArray(leadIds) ? leadIds.filter(Boolean).map(String) : [];
  if (!ids.length) return [];
  const res = await gatewayFetch('/dakini-calling/leads/call-statuses', {
    method: 'POST',
    body: JSON.stringify({ lead_ids: ids }),
  });
  return unwrap(res, 'Could not retrieve Dakini call statuses for leads');
}

export async function analyzeDakiniCall(callId) {
  const res = await gatewayFetch(`/dakini-calling/calls/${encodeURIComponent(callId)}/analyze`, { method: 'POST' });
  return unwrap(res, 'Could not analyse Dakini call transcript');
}

export async function getLatestDakiniLeadCall(leadId) {
  const res = await gatewayFetch(`/dakini-calling/leads/${encodeURIComponent(leadId)}/latest-call`, { method: 'GET' });
  return unwrap(res, 'Could not retrieve the latest Dakini call');
}

export async function getDakiniBatchStatus(batchId) {
  const res = await gatewayFetch(`/dakini-calling/batches/${encodeURIComponent(batchId)}`, { method: 'GET' });
  return unwrap(res, 'Could not retrieve Dakini batch status');
}

export async function listDakiniBatches(limit = 100) {
  const res = await gatewayFetch(`/dakini-calling/batches?limit=${encodeURIComponent(limit)}`, { method: 'GET' });
  return unwrap(res, 'Could not retrieve Dakini batches');
}

export async function getDakiniBatchCalls(batchId, skip = 0, limit = 100) {
  const query = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  const res = await gatewayFetch(`/dakini-calling/batches/${encodeURIComponent(batchId)}/calls?${query.toString()}`, { method: 'GET' });
  return unwrap(res, 'Could not retrieve calls for this Dakini batch');
}

export async function scheduleDakiniBatch(batchId, scheduledAt) {
  const res = await gatewayFetch(`/dakini-calling/batches/${encodeURIComponent(batchId)}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduled_at: scheduledAt }),
  });
  return unwrap(res, 'Could not schedule Dakini batch');
}

export async function stopDakiniBatch(batchId) {
  const res = await gatewayFetch(`/dakini-calling/batches/${encodeURIComponent(batchId)}/stop`, {
    method: 'POST',
  });
  return unwrap(res, 'Could not stop Dakini batch');
}
