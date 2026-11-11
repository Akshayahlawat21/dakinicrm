export function normalizeLabel(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const list = (...values) => values.flatMap((value) => Array.isArray(value) ? value : value == null || value === '' ? [] : [value]);
const unique = (values) => [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];

function getLinkedLead(deal, leadById, leads = []) {
  const directIds = unique(list(deal.lead_id, deal.leadId, deal.related_lead_id, deal.relatedLeadId, deal.lead_ids, deal.leadIds));
  const direct = directIds.map((id) => leadById.get(id)).filter(Boolean);
  if (direct.length) return direct;
  const company = normalizeLabel(deal.company || deal.account_name || deal.accountName);
  if (!company) return [];
  const candidates = leads.filter((lead) =>
    normalizeLabel(lead.company || lead.account_name || lead.accountName) === company
  );
  // Only safe fallback when exactly one matching lead exists.
  return candidates.length === 1 ? candidates : [];
}

export function resolveDealAttribution(deal, options = {}) {
  const { leadById = new Map(), leads = [], campaigns = [], products = [] } = options;
  const linkedLeads = getLinkedLead(deal, leadById, leads);

  const rawCampaignIds = unique(list(
    deal.campaign_id, deal.campaignId, deal.campaign_ids, deal.campaignIds,
    ...linkedLeads.map((lead) => [lead.campaign_id, lead.campaignId])
  ));
  const rawCampaignNames = unique(list(
    deal.campaign_name, deal.campaignName, deal.campaign, deal.campaign_names, deal.campaignNames,
    ...linkedLeads.map((lead) => [lead.campaign_name, lead.campaignName, lead.campaign])
  ));
  const campaignRecords = campaigns.filter((item) =>
    rawCampaignIds.includes(String(item.id)) ||
    rawCampaignNames.some((name) => normalizeLabel(name) === normalizeLabel(item.name || item.campaign_name))
  );
  const campaignIds = unique([...rawCampaignIds, ...campaignRecords.map((item) => item.id)]);
  const campaignNames = unique([...rawCampaignNames, ...campaignRecords.map((item) => item.name || item.campaign_name)]);

  const rawProductIds = unique(list(
    deal.product_id, deal.productId, deal.product_ids, deal.productIds,
    deal.interested_product_id, deal.interestedProductId,
    ...list(deal.products, deal.deal_products).map((item) => typeof item === 'object' ? (item.product_id || item.productId || item.id || item.product?.id) : item),
    ...linkedLeads.map((lead) => [lead.product_id, lead.productId, lead.interested_product_id, lead.interestedProductId])
  ));
  const rawProductNames = unique(list(
    deal.product_name, deal.productName, deal.product, deal.product_names, deal.productNames,
    ...list(deal.products, deal.deal_products).map((item) => typeof item === 'object' ? (item.product_name || item.name || item.product?.name) : ''),
    ...linkedLeads.map((lead) => [lead.interested_product, lead.interestedProduct, lead.product_name, lead.productName])
  ));
  const productRecords = products.filter((item) =>
    rawProductIds.includes(String(item.id)) ||
    rawProductNames.some((name) => normalizeLabel(name) === normalizeLabel(item.name || item.product_name))
  );
  const productIds = unique([...rawProductIds, ...productRecords.map((item) => item.id)]);
  const productNames = unique([...rawProductNames, ...productRecords.map((item) => item.name || item.product_name)]);

  return {
    lead: linkedLeads[0] || {},
    leads: linkedLeads,
    campaignId: campaignIds[0] || '',
    campaignName: campaignNames.join(', '),
    campaignIds,
    campaignNames,
    productId: productIds[0] || '',
    productName: productNames.join(', '),
    productIds,
    productNames,
  };
}

export function matchesDealFilters(deal, options = {}) {
  const {
    campaignId = 'all', productId = 'all', dateRange = 'all',
    leadById = new Map(), leads = [], campaigns = [], products = [], now = new Date()
  } = options;
  const attribution = resolveDealAttribution(deal, { leadById, leads, campaigns, products });
  const campaignMatch = campaignId === 'all' || attribution.campaignIds.includes(String(campaignId));
  const productMatch = productId === 'all' || attribution.productIds.includes(String(productId));

  const rawDate = deal.created_at || deal.createdAt || deal.created_date || deal.close_date || deal.updated_at;
  const date = rawDate ? new Date(rawDate) : null;
  let start = null;
  if (dateRange === '30') start = new Date(now.getTime() - 30 * 86400000);
  else if (dateRange === '90') start = new Date(now.getTime() - 90 * 86400000);
  else if (dateRange === '365') start = new Date(now.getTime() - 365 * 86400000);
  else if (dateRange === 'week') { start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay()+6)%7)); }
  else if (dateRange === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (dateRange === 'quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  else if (dateRange === 'ytd') start = new Date(now.getFullYear(), 0, 1);
  const dateMatch = !start || (date && !Number.isNaN(date.getTime()) && date >= start);
  return campaignMatch && productMatch && Boolean(dateMatch);
}

export function matchesLeadFilters(lead, { campaignId = 'all', productId = 'all', dateRange = 'all', campaigns = [], products = [], now = new Date() } = {}) {
  const campaignName = lead.campaign_name || lead.campaign || '';
  const campaign = campaigns.find((item) => String(item.id) === String(lead.campaign_id || '') ||
    (campaignName && normalizeLabel(item.name) === normalizeLabel(campaignName)));
  const productName = lead.interested_product || lead.product_name || '';
  const product = products.find((item) => String(item.id) === String(lead.product_id || '') ||
    (productName && normalizeLabel(item.name || item.product_name) === normalizeLabel(productName)));
  const campaignMatch = campaignId === 'all' || String(lead.campaign_id || campaign?.id || '') === String(campaignId);
  const productMatch = productId === 'all' || String(lead.product_id || product?.id || '') === String(productId);
  const rawDate = lead.created_at || lead.createdAt;
  const date = rawDate ? new Date(rawDate) : null;
  let start = null;
  if (dateRange === 'week') { start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay()+6)%7)); }
  else if (dateRange === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (dateRange === 'quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  else if (dateRange === 'ytd') start = new Date(now.getFullYear(), 0, 1);
  else if (dateRange === '30') start = new Date(now.getTime()-30*86400000);
  else if (dateRange === '90') start = new Date(now.getTime()-90*86400000);
  else if (dateRange === '365') start = new Date(now.getTime()-365*86400000);
  return campaignMatch && productMatch && (!start || (date && !Number.isNaN(date.getTime()) && date >= start));
}
