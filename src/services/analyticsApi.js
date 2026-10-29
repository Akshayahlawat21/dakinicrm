const ANALYTICS_BASE_URL = (import.meta.env.VITE_ANALYTICS_BASE_URL || '/analytics').replace(/\/$/, '');
const GATEWAY_MODE = ANALYTICS_BASE_URL.startsWith('/v1/analytics') || /^https?:.*\/v1\/analytics$/.test(ANALYTICS_BASE_URL);
const DIRECT_MODE = !GATEWAY_MODE;

const _analyticsCache = new Map();
const CACHE_TTL_MS = 60000; // 60 seconds

export function clearAnalyticsCache() {
  _analyticsCache.clear();
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('dakini_user_profile') || 'null');
  } catch {
    return null;
  }
}

function requestHeaders() {
  const headers = { Accept: 'application/json' };

  if (GATEWAY_MODE) {
    let token = null;
    try { token = localStorage.getItem('dakini_access_token'); } catch { /* private browsing */ }
    if (!token) {
      throw new Error('Please sign in again before opening analytics. The gateway requires a valid access token.');
    }
    headers.Authorization = `Bearer ${token}`;
    // Do not send a client-selected tenant in gateway mode. Layer 2 derives
    // the tenant from its verified JWT and forwards that trusted context.
    return headers;
  }

  const tenantId = import.meta.env.VITE_TENANT_ID || readStoredUser()?.tenant_id || readStoredUser()?.organization_id;
  if (!tenantId) {
    throw new Error('Analytics is not configured: set VITE_TENANT_ID to the existing organization UUID or slug, or sign in with a stored tenant profile.');
  }
  // Direct mode is intended for local development only. The Layer 9 service
  // must not be exposed directly to untrusted clients in deployed environments.
  headers['X-Tenant-Id'] = tenantId;
  const storedUser = readStoredUser();
  if (storedUser?.id) headers['X-User-Id'] = String(storedUser.id);
  if (storedUser?.role || storedUser?.roles) {
    const r = Array.isArray(storedUser.roles) ? storedUser.roles.join(',') : String(storedUser.role);
    headers['X-User-Roles'] = r;
  }
  try {
    const token = localStorage.getItem('dakini_access_token');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* local storage unavailable */ }
  return headers;
}

function reportPath(path) {
  return GATEWAY_MODE ? `/reports/${path}` : `/v1/reports/${path}`;
}

async function analyticsRequest(path, bypassCache = false) {
  const now = Date.now();
  if (!bypassCache && _analyticsCache.has(path)) {
    const entry = _analyticsCache.get(path);
    if (now - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const response = await fetch(`${ANALYTICS_BASE_URL}${path}`, {
    method: 'GET',
    headers: requestHeaders(),
    credentials: 'same-origin'
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '');
  if (!response.ok) {
    const detail = typeof payload?.detail === 'string'
      ? payload.detail
      : payload?.error?.message || `Analytics request failed (${response.status})`;
    throw new Error(detail);
  }
  _analyticsCache.set(path, { timestamp: now, data: payload });
  return payload;
}

export const analyticsApi = {
  clearCache: clearAnalyticsCache,
  getOverview: (period = 'month', bypass = false) => analyticsRequest(`${reportPath('overview')}?period=${encodeURIComponent(period)}`, bypass),
  getRevenueTrend: (months = 6, bypass = false) => analyticsRequest(`${reportPath('revenue-trend')}?months=${months}`, bypass),
  getPipelineByStage: (bypass = false) => analyticsRequest(reportPath('pipeline-by-stage'), bypass),
  getLeadSources: (period = 'last_30_days', bypass = false) => analyticsRequest(`${reportPath('lead-sources')}?period=${encodeURIComponent(period)}`, bypass),
  getConversionFunnel: (period = 'last_30_days', bypass = false) => analyticsRequest(`${reportPath('conversion-funnel')}?period=${encodeURIComponent(period)}`, bypass),
  getActivityPerformance: (period = 'last_30_days', bypass = false) => analyticsRequest(`${reportPath('activity-performance')}?period=${encodeURIComponent(period)}`, bypass),
  getQuotaLeaderboard: (period = 'month', bypass = false) => analyticsRequest(`${reportPath('quota-leaderboard')}?period=${encodeURIComponent(period)}`, bypass),
  getTargetPace: (period = 'quarter', bypass = false) => analyticsRequest(`${reportPath('target-pace')}?period=${encodeURIComponent(period)}`, bypass),
  async downloadCsv(report, period = 'month', months = 6) {
    const response = await fetch(
      `${ANALYTICS_BASE_URL}${reportPath('export.csv')}?report=${encodeURIComponent(report)}&period=${encodeURIComponent(period)}&months=${months}`,
      { method: 'GET', headers: requestHeaders(), credentials: 'same-origin' }
    );
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
      throw new Error(typeof payload.detail === 'string' ? payload.detail : payload.error?.message || `CSV export failed (${response.status})`);
    }
    return response.blob();
  }
};
