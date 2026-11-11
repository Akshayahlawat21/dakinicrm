# Campaign & Product Analytics Fix

## Changes
- Fixed the campaign filter's always-true predicate. Campaign filtering now compares the selected campaign ID with the deal's resolved campaign ID.
- Product filtering now resolves product IDs from deal-product data and falls back to product names only when IDs are unavailable.
- Added a one-time Lead index in memory for analytics filtering, avoiding a linear Lead search for every Deal.
- Aggregated pipeline stage counts and values in one pass rather than repeatedly scanning the filtered deals.
- Deal list response now includes the source `lead_id` from the LeadConversion relationship, in addition to campaign and product identifiers.
- Increased the bounded Deal list default to 500 (maximum 1,000) to reduce the chance that analytics only sees the first small page.
- Added tenant-safe attribution indexes for campaign, conversion, and deal-product analytics joins.
- Forwarded UTM source and medium fields from the Lead creation context.

## Data behavior
- Existing converted deals can show Campaign only when their linked Lead has campaign attribution.
- Existing deals can show Product only when a `deal_products` row exists.
- This code does not guess missing campaign or product attribution. Backfill those records from verified historical source data before expecting old deals to appear in filtered results.
- Leads with no campaign remain excluded from a specific Campaign filter and remain included in All Campaigns.

## UTM format
Use links such as:
`https://your-domain.example/lead-form?utm_source=google&utm_medium=cpc&utm_campaign=november-crm-promotion`

The `utm_campaign` value must match a campaign name (case-insensitive; spaces, underscores and hyphens normalized) for automatic mapping. Explicit campaign selection takes precedence.

## Deployment
1. Review and apply `backend/sql/migrations/20261110_006_campaign_analytics_indexes.sql` to the production database.
2. Deploy backend and frontend together.
3. Verify Lead create (manual Campaign), Lead create (UTM), Lead conversion, Deal list response, and Campaign/Product filters under each tenant role.
4. Run `npm ci && npm run build` in the frontend package and the backend test suite in CI.

## Verification in this build environment
- Python backend compileall passed.
- ZIP integrity passed after packaging.
- Vite production build could not be completed in this environment because the archived `node_modules` Vite executable was unavailable (`vite: Permission denied` / missing Vite JS entry). Do not treat this as a successful production build.
