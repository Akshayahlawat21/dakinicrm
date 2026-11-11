import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesDealFilters } from '../dealAnalyticsFilters.js';

const campaigns = [{ id: 'c1', name: 'November CRM Campaign' }, { id: 'c2', name: 'LinkedIn Launch' }];
const products = [{ id: 'p1', name: 'CRM Software' }, { id: 'p2', name: 'AI Chatbot' }];
const leadById = new Map([['l1', { id: 'l1', campaign_id: 'c1', product_id: 'p1' }]]);
const deal = { id: 'd1', lead_id: 'l1', created_at: '2026-11-08T10:00:00Z', stage: 'Won' };
const base = { leadById, campaigns, products, now: new Date('2026-11-10T12:00:00Z') };

test('All campaigns and products includes attributed deal', () => {
  assert.equal(matchesDealFilters(deal, base), true);
});
test('Campaign filter matches linked lead campaign ID', () => {
  assert.equal(matchesDealFilters(deal, { ...base, campaignId: 'c1' }), true);
  assert.equal(matchesDealFilters(deal, { ...base, campaignId: 'c2' }), false);
});
test('Product filter matches linked lead product ID', () => {
  assert.equal(matchesDealFilters(deal, { ...base, productId: 'p1' }), true);
  assert.equal(matchesDealFilters(deal, { ...base, productId: 'p2' }), false);
});
test('Campaign and product filters combine with AND semantics', () => {
  assert.equal(matchesDealFilters(deal, { ...base, campaignId: 'c1', productId: 'p1' }), true);
  assert.equal(matchesDealFilters(deal, { ...base, campaignId: 'c2', productId: 'p1' }), false);
});
test('Date range excludes older deal and includes recent deal', () => {
  assert.equal(matchesDealFilters(deal, { ...base, dateRange: '30' }), true);
  assert.equal(matchesDealFilters(deal, { ...base, dateRange: '90' }), true);
  assert.equal(matchesDealFilters(deal, { ...base, dateRange: '365' }), true);
  const oldDeal = { ...deal, created_at: '2025-01-01T00:00:00Z' };
  assert.equal(matchesDealFilters(oldDeal, { ...base, dateRange: '30' }), false);
});
test('Product ID on deal takes precedence without a linked lead', () => {
  assert.equal(matchesDealFilters({ id: 'd2', product_id: 'p2' }, { ...base, leadById: new Map(), productId: 'p2' }), true);
});

test('Campaign and product labels resolve to catalog IDs', () => {
  const labelledDeal = { campaign_name: 'November CRM Campaign', product_name: 'CRM Software' };
  assert.equal(matchesDealFilters(labelledDeal, { ...base, campaignId: 'c1', productId: 'p1' }), true);
});
test('Unattributed deal is excluded from specific campaign/product filters', () => {
  const unattributed = { id: 'd3', name: 'Manual deal', created_at: '2026-11-09T10:00:00Z' };
  assert.equal(matchesDealFilters(unattributed, { ...base, campaignId: 'c1' }), false);
  assert.equal(matchesDealFilters(unattributed, { ...base, productId: 'p1' }), false);
});
test('Campaign and product IDs compare case-insensitively only through normalized labels', () => {
  const labelledDeal = { campaign_name: 'NOVEMBER_CRM_CAMPAIGN', product_name: 'crm software' };
  assert.equal(matchesDealFilters(labelledDeal, { ...base, campaignId: 'c1', productId: 'p1' }), true);
});

test('Actual Layer 3 deal DTO campaign_id and product_id filters work', () => {
  const apiDeal = {
    id: 'deal-uuid', lead_id: 'lead-uuid', campaign_id: 'c1',
    campaign_name: 'November CRM Campaign', product_id: 'p2',
    product_name: 'AI Chatbot', created_at: '2026-11-09T10:00:00Z'
  };
  assert.equal(matchesDealFilters(apiDeal, { ...base, campaignId: 'c1' }), true);
  assert.equal(matchesDealFilters(apiDeal, { ...base, productId: 'p2' }), true);
  assert.equal(matchesDealFilters(apiDeal, { ...base, campaignId: 'c1', productId: 'p2' }), true);
  assert.equal(matchesDealFilters(apiDeal, { ...base, campaignId: 'c2' }), false);
});

test('Deals without direct attribution resolve from their unique linked lead', () => {
  const linkedLead = { id: 'l2', company: 'Unique Co', campaign_id: 'c2', product_id: 'p2', interested_product: 'AI Chatbot' };
  const noForeignKeysDeal = { id: 'd4', company: 'Unique Co', created_at: '2026-11-09T10:00:00Z' };
  const options = { ...base, leads: [linkedLead], leadById: new Map() };
  assert.equal(matchesDealFilters(noForeignKeysDeal, { ...options, campaignId: 'c2' }), true);
  assert.equal(matchesDealFilters(noForeignKeysDeal, { ...options, productId: 'p2' }), true);
});

test('Ambiguous company-to-lead matches are not guessed', () => {
  const candidates = [
    { id: 'l3', company: 'Shared Co', campaign_id: 'c1', product_id: 'p1' },
    { id: 'l4', company: 'Shared Co', campaign_id: 'c2', product_id: 'p2' }
  ];
  const noForeignKeysDeal = { id: 'd5', company: 'Shared Co', created_at: '2026-11-09T10:00:00Z' };
  const options = { ...base, leads: candidates, leadById: new Map() };
  assert.equal(matchesDealFilters(noForeignKeysDeal, { ...options, campaignId: 'c1' }), false);
  assert.equal(matchesDealFilters(noForeignKeysDeal, { ...options, productId: 'p1' }), false);
});

import { matchesLeadFilters, resolveDealAttribution } from '../dealAnalyticsFilters.js';

test('Dashboard lead filter resolves interested_product label to product catalog ID', () => {
  const lead = { id: 'l10', campaign_id: 'c1', interested_product: 'CRM Software', created_at: '2026-11-09T10:00:00Z' };
  assert.equal(matchesLeadFilters(lead, { ...base, campaignId: 'c1', productId: 'p1', dateRange: 'month' }), true);
  assert.equal(matchesLeadFilters(lead, { ...base, productId: 'p2' }), false);
});

test('Deal filters support all product and campaign IDs from relation arrays', () => {
  const multiDeal = {
    id: 'd-multi', campaign_ids: ['c1', 'c2'], campaign_names: ['November CRM Campaign', 'LinkedIn Launch'],
    product_ids: ['p1', 'p2'], product_names: ['CRM Software', 'AI Chatbot'],
    created_at: '2026-11-09T10:00:00Z'
  };
  assert.equal(matchesDealFilters(multiDeal, { ...base, campaignId: 'c2' }), true);
  assert.equal(matchesDealFilters(multiDeal, { ...base, productId: 'p2' }), true);
  assert.equal(matchesDealFilters(multiDeal, { ...base, campaignId: 'c2', productId: 'p2' }), true);
});

test('Deal attribution exposes all product and campaign names for the stage table', () => {
  const multiDeal = { campaign_ids: ['c1', 'c2'], product_ids: ['p1', 'p2'] };
  const resolved = resolveDealAttribution(multiDeal, base);
  assert.deepEqual(resolved.campaignNames.sort(), ['LinkedIn Launch', 'November CRM Campaign'].sort());
  assert.deepEqual(resolved.productNames.sort(), ['AI Chatbot', 'CRM Software'].sort());
});

test('Product names match when spacing and punctuation differ (Dakini CRM / Dakinicrm)', () => {
  const lead = { id: 'l11', interested_product: 'Dakinicrm', created_at: '2026-11-10T10:00:00Z' };
  assert.equal(matchesLeadFilters(lead, { ...base, productId: 'p3', products: [{ id: 'p3', name: 'Dakini CRM' }] }), true);
});
