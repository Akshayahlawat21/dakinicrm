/**
 * Dakini CRM — Layer 2 Gateway Client Service
 * Connects React frontend directly to the Layer 2 Python FastAPI Gateway.
 */

// Base URL configured via environment or default relative /v1 via Vite proxy / reverse proxy
export const GATEWAY_BASE_URL =
  import.meta.env.VITE_GATEWAY_URL || '/v1';

// Derived root URL for load balancer / gateway health check
export const GATEWAY_ROOT_URL =
  GATEWAY_BASE_URL.startsWith('http')
    ? GATEWAY_BASE_URL.replace(/\/v1\/?$/, '')
    : '';

const TOKEN_KEY = 'dakini_access_token';
const USER_KEY = 'dakini_user_profile';

/**
 * Helper to get or generate correlation ID for frontend tracing
 */
export function generateCorrelationId() {
  return `req_fe_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Token management helpers
 */
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token, user = null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.warn('LocalStorage access error:', err);
  }
}

/**
 * Universal fetch wrapper for Layer 2 API Gateway requests.
 * Automatically injects Correlation IDs, Bearer tokens, and handles E8 error envelopes.
 */
export async function gatewayFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${GATEWAY_BASE_URL}${cleanEndpoint}`;
  const correlationId = options.correlationId || generateCorrelationId();

  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    ...(options.headers || {}),
  };

  const token = getStoredToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const responseCorrelationId =
      response.headers.get('X-Correlation-ID') || correlationId;

    let responseData = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      // Handle E8 normalized error schema
      const errorPayload =
        typeof responseData === 'object' && responseData?.error
          ? responseData.error
          : {
              code: `HTTP_${response.status}`,
              message: response.statusText || 'Gateway request failed',
              correlation_id: responseCorrelationId,
            };

      // If token expired, clear invalid token
      if (response.status === 401) {
        setStoredToken(null);
      }

      return {
        success: false,
        status: response.status,
        error: errorPayload,
        correlationId: responseCorrelationId,
      };
    }

    return {
      success: true,
      status: response.status,
      data: responseData,
      correlationId: responseCorrelationId,
    };
  } catch (err) {
    return {
      success: false,
      status: 0,
      error: {
        code: 'GATEWAY_CONNECTION_ERROR',
        message: err.message || 'Could not connect to Layer 2 Gateway',
        correlation_id: correlationId,
      },
      correlationId,
    };
  }
}

/**
 * Gateway API methods
 */
export const gatewayApi = {
  /**
   * E2: Check health of Layer 2 Gateway and upstream backend
   */
  async checkHealth() {
    try {
      const cid = generateCorrelationId();
      let res = await fetch(`${GATEWAY_BASE_URL}/health`, {
        headers: { 'X-Correlation-ID': cid },
      });
      if (!res.ok) {
        res = await fetch(`${GATEWAY_ROOT_URL || ''}/health`, {
          headers: { 'X-Correlation-ID': cid },
        });
      }
      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      return { success: false, status: res.status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * E4: Authenticate and obtain JWT
   */
  async login(email = 'elena.rostova@dakini.ai', password = 'password123', tenantId = 'tenant_enterprise_01') {
    const res = await gatewayFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenant_id: tenantId }),
    });

    if (res.success && res.data?.access_token) {
      setStoredToken(res.data.access_token, res.data.user);
    }
    return res;
  },

  logout() {
    setStoredToken(null);
  },

  /**
   * E3: Leads resource
   */
  async getLeads() {
    return gatewayFetch('/leads', { method: 'GET' });
  },

  async createLead(leadData) {
    return gatewayFetch('/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  },

  async deleteLead(leadId) {
    return gatewayFetch(`/leads/${leadId}`, { method: 'DELETE' });
  },

  async convertLead(leadId, convertData = {}) {
    return gatewayFetch(`/leads/${leadId}/convert`, {
      method: 'POST',
      body: JSON.stringify(convertData),
    });
  },

  /**
   * E3: Deals resource
   */
  async getDeals() {
    return gatewayFetch('/deals', { method: 'GET' });
  },

  async createDeal(dealData) {
    return gatewayFetch('/deals', {
      method: 'POST',
      body: JSON.stringify(dealData),
    });
  },

  async updateDealStage(dealId, stage) {
    return gatewayFetch(`/deals/${dealId}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
  },

  async deleteDeal(dealId) {
    return gatewayFetch(`/deals/${dealId}`, { method: 'DELETE' });
  },

  async deleteTask(taskId) {
    return gatewayFetch(`/tasks/${taskId}`, { method: 'DELETE' });
  },

  /**
   * Accounts resource (Live Supabase DB)
   */
  async getAccounts() {
    return gatewayFetch('/accounts', { method: 'GET' });
  },

  async createAccount(accountData) {
    return gatewayFetch('/accounts', {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  },

  async deleteAccount(accountId) {
    return gatewayFetch(`/accounts/${accountId}`, { method: 'DELETE' });
  },

  /**
   * Contacts resource (Live Supabase DB)
   */
  async getContacts() {
    return gatewayFetch('/contacts', { method: 'GET' });
  },

  async createContact(contactData) {
    return gatewayFetch('/contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    });
  },

  async deleteContact(contactId) {
    return gatewayFetch(`/contacts/${contactId}`, { method: 'DELETE' });
  },


  /**
   * Campaigns resource (Live Supabase DB)
   */
  async getCampaigns() {
    return gatewayFetch('/campaigns', { method: 'GET' });
  },

  async createCampaign(campaignData) {
    return gatewayFetch('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaignData),
    });
  },

  async deleteCampaign(campaignId) {
    return gatewayFetch(`/campaigns/${campaignId}`, { method: 'DELETE' });
  },

  /**
   * Tasks resource (Live Supabase DB)
   */
  async getTasks() {
    return gatewayFetch('/tasks', { method: 'GET' });
  },

  async createTask(taskData) {
    return gatewayFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  /**
   * E3 & E5: Copilot AI Assistant
   */
  async sendAgentMessage(message) {
    return gatewayFetch('/agent', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
};

export default gatewayApi;
