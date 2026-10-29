-- Migration: 20261028_004_lead_product_link.sql
-- Description: Add product_id and interested_product to leads table for product-linked leads and deduplication

ALTER TABLE IF EXISTS leads
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS leads
ADD COLUMN IF NOT EXISTS interested_product VARCHAR(100) NULL;

CREATE INDEX IF NOT EXISTS idx_leads_product_id ON leads(product_id);
CREATE INDEX IF NOT EXISTS idx_leads_interested_product ON leads(LOWER(TRIM(interested_product)));
