-- Campaign attribution lookup indexes for production analytics.
-- Safe to apply repeatedly; existing rows and relationships are preserved.
CREATE INDEX IF NOT EXISTS ix_leads_org_campaign_created
    ON leads (organization_id, campaign_id, created_at DESC)
    WHERE deleted_at IS NULL AND campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_lead_conversions_opportunity_lead
    ON lead_conversions (opportunity_id, lead_id)
    WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_deal_products_deal_product
    ON deal_products (deal_id, product_id);
