import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPredictedTool,
  normalizeToolCalls,
  buildExecutionSteps,
  CRM_TOOL_REGISTRY,
} from '../agentProcessTracker.js';

test('detectPredictedTool maps lead queries correctly', () => {
  assert.equal(detectPredictedTool('Show me qualified leads this month'), 'search_leads');
  assert.equal(detectPredictedTool('Which prospect has score over 100?'), 'search_leads');
});

test('detectPredictedTool maps pipeline and deal queries', () => {
  assert.equal(detectPredictedTool('Show pipeline summary by stage'), 'get_pipeline_summary');
  assert.equal(detectPredictedTool('What is our total deal revenue in negotiation?'), 'search_deals');
});

test('detectPredictedTool maps campaign, product and account queries', () => {
  assert.equal(detectPredictedTool('Top campaigns by ROI and attribution'), 'get_campaign_performance');
  assert.equal(detectPredictedTool('Which product SKU sells the most?'), 'get_product_performance');
  assert.equal(detectPredictedTool('Show enterprise accounts summary'), 'get_account_summary');
});

test('detectPredictedTool fallbacks gracefully for empty or generic input', () => {
  assert.equal(detectPredictedTool(''), 'crm_data_query');
  assert.equal(detectPredictedTool(null), 'crm_data_query');
  assert.equal(detectPredictedTool('Hello how are you?'), 'crm_data_query');
});

test('normalizeToolCalls returns structured tool call objects', () => {
  const raw = [
    {
      id: 'tc-1',
      name: 'search_leads',
      arguments: { status: 'Qualified', limit: 20 },
      status: 'completed',
      duration_ms: 110,
      summary: 'Retrieved 15 leads',
      result_count: 15,
    },
  ];
  const normalized = normalizeToolCalls(raw, [], 110);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, 'search_leads');
  assert.equal(normalized[0].status, 'completed');
  assert.equal(normalized[0].duration_ms, 110);
  assert.equal(normalized[0].result_count, 15);
});

test('normalizeToolCalls synthesizes from toolsUsed when toolCalls is empty', () => {
  const toolsUsed = ['search_deals', 'get_pipeline_summary'];
  const normalized = normalizeToolCalls([], toolsUsed, 300);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].name, 'search_deals');
  assert.equal(normalized[1].name, 'get_pipeline_summary');
  assert.equal(normalized[0].duration_ms, 150);
});

test('buildExecutionSteps generates initial scope, tool calls, and synthesis steps', () => {
  const toolCalls = [
    {
      id: 'call_1',
      name: 'search_leads',
      arguments: { status: 'new' },
      status: 'completed',
      duration_ms: 95,
      summary: 'Retrieved 8 leads',
      result_count: 8,
    },
  ];
  const steps = buildExecutionSteps(toolCalls, ['search_leads'], 95, 'manager');
  assert.equal(steps.length, 3);
  assert.equal(steps[0].id, 'step-query-plan');
  assert.equal(steps[0].status, 'completed');
  assert.equal(steps[1].id, 'step-call_1');
  assert.equal(steps[1].tool, 'search_leads');
  assert.equal(steps[1].status, 'completed');
  assert.equal(steps[2].id, 'step-synthesis');
  assert.equal(steps[2].status, 'completed');
});
