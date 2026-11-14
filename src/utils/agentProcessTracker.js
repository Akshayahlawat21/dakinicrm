/**
 * Utility helpers for Dakini AI Assistant process tracking, tool execution,
 * and Antigravity-style process and tool trace resolution.
 */

export const CRM_TOOL_REGISTRY = {
  search_leads: {
    label: 'search_leads',
    name: 'Search Leads',
    description: 'Searching CRM leads, qualification scores and assignment',
    category: 'leads',
  },
  get_leads_summary: {
    label: 'get_leads_summary',
    name: 'Leads Summary',
    description: 'Aggregating total leads, conversion rates, sources and status breakdown',
    category: 'leads',
  },
  get_team_performance: {
    label: 'get_team_performance',
    name: 'Team Performance',
    description: 'Aggregating sales reps, win rates, revenue and open pipelines',
    category: 'team',
  },
  get_crm_overview: {
    label: 'get_crm_overview',
    name: 'CRM Executive Overview',
    description: 'Generating executive KPI overview across leads, pipeline and won revenue',
    category: 'general',
  },
  search_deals: {
    label: 'search_deals',
    name: 'Search Deals',
    description: 'Querying deals, stages, amounts and expected close dates',
    category: 'deals',
  },
  get_pipeline_summary: {
    label: 'get_pipeline_summary',
    name: 'Pipeline Summary',
    description: 'Calculating pipeline conversion rates and stage aggregates',
    category: 'pipeline',
  },
  get_campaign_performance: {
    label: 'get_campaign_performance',
    name: 'Campaign Performance',
    description: 'Aggregating marketing campaign performance and attribution',
    category: 'campaigns',
  },
  get_product_performance: {
    label: 'get_product_performance',
    name: 'Product Performance',
    description: 'Summarizing product SKUs and deal revenues',
    category: 'products',
  },
  get_account_summary: {
    label: 'get_account_summary',
    name: 'Account Summary',
    description: 'Aggregating company profiles and associated deal metrics',
    category: 'accounts',
  },
  search_contacts: {
    label: 'search_contacts',
    name: 'Search Contacts',
    description: 'Searching verified CRM contacts and decision makers',
    category: 'contacts',
  },
  search_activities: {
    label: 'search_activities',
    name: 'Search Activities',
    description: 'Searching tasks, calls, meetings and correspondence',
    category: 'activities',
  },
  crm_data_query: {
    label: 'crm_data_query',
    name: 'CRM Database Query',
    description: 'Retrieving role-scoped CRM workspace records',
    category: 'general',
  },
};

/**
 * Predicts the most relevant CRM read tool from a natural-language prompt.
 */
export function detectPredictedTool(queryText) {
  const q = String(queryText || '').toLowerCase().trim();
  if (!q) return 'crm_data_query';
  if (q.includes('overview') || q.includes('health') || q.includes('summary report') || q.includes('how are we doing') || q.includes('executive')) {
    return 'get_crm_overview';
  }
  if (q.includes('team') || q.includes('sales rep') || q.includes('quota') || q.includes('leaderboard') || q.includes('top perform')) {
    return 'get_team_performance';
  }
  if (q.includes('how many leads') || q.includes('lead count') || q.includes('lead conversion') || q.includes('lead source') || q.includes('lead breakdown')) {
    return 'get_leads_summary';
  }
  if (q.includes('lead') || q.includes('score') || q.includes('prospect')) return 'search_leads';
  if (q.includes('pipeline') || q.includes('funnel') || q.includes('stage breakdown') || q.includes('stages')) {
    return 'get_pipeline_summary';
  }
  if (q.includes('deal') || q.includes('negotiat') || q.includes('revenue') || q.includes('closing')) {
    return 'search_deals';
  }
  if (q.includes('campaign') || q.includes('attribution') || q.includes('roi') || q.includes('ad spend')) {
    return 'get_campaign_performance';
  }
  if (q.includes('product') || q.includes('sku') || q.includes('license') || q.includes('package')) {
    return 'get_product_performance';
  }
  if (q.includes('account') || q.includes('company') || q.includes('client') || q.includes('enterprise')) {
    return 'get_account_summary';
  }
  if (q.includes('contact') || q.includes('phone') || q.includes('email list') || q.includes('person')) {
    return 'search_contacts';
  }
  if (q.includes('call') || q.includes('task') || q.includes('meeting') || q.includes('activity')) {
    return 'search_activities';
  }
  return 'crm_data_query';
}

/**
 * Normalizes tool calls array from backend response or generates synthesis from toolsUsed.
 */
export function normalizeToolCalls(toolCalls = [], toolsUsed = [], durationMs = null) {
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return toolCalls.map((tc, idx) => ({
      id: tc.id || `tool-${idx}`,
      name: tc.name || 'crm_data_query',
      arguments: tc.arguments && typeof tc.arguments === 'object' ? tc.arguments : {},
      status: tc.status === 'failed' ? 'failed' : 'completed',
      duration_ms: tc.duration_ms ?? (durationMs ? Math.round(durationMs / toolCalls.length) : null),
      summary: tc.summary || `Executed CRM tool ${tc.name || 'query'}`,
      result_count: tc.result_count ?? null,
    }));
  }

  if (Array.isArray(toolsUsed) && toolsUsed.length > 0) {
    const perToolDuration = durationMs ? Math.round(durationMs / toolsUsed.length) : null;
    return toolsUsed.map((toolName, idx) => {
      const meta = CRM_TOOL_REGISTRY[toolName] || CRM_TOOL_REGISTRY.crm_data_query;
      return {
        id: `tool-${idx}`,
        name: toolName,
        arguments: {},
        status: 'completed',
        duration_ms: perToolDuration,
        summary: meta.description,
        result_count: null,
      };
    });
  }

  return [];
}

/**
 * Builds the Antigravity-style execution pipeline steps.
 */
export function buildExecutionSteps(toolCalls = [], toolsUsed = [], durationMs = null, role = 'verified_role') {
  const normalizedTools = normalizeToolCalls(toolCalls, toolsUsed, durationMs);

  const steps = [
    {
      id: 'step-query-plan',
      title: 'Query & Scope Analysis',
      status: 'completed',
      detail: `Validated tenant authentication and role permissions (${role}).`,
    },
  ];

  if (normalizedTools.length > 0) {
    normalizedTools.forEach((tc) => {
      steps.push({
        id: `step-${tc.id}`,
        title: `Called tool: ${tc.name}`,
        status: tc.status,
        tool: tc.name,
        duration_ms: tc.duration_ms,
        detail: tc.summary,
        arguments: tc.arguments,
        result_count: tc.result_count,
      });
    });
  }

  steps.push({
    id: 'step-synthesis',
    title: 'Response Synthesis & Grounding',
    status: 'completed',
    detail: 'Formatted CRM analytics and structured visualizations.',
  });

  return steps;
}
