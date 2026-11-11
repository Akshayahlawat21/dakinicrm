# Deals & Pipeline Campaign/Product Filter Repair

## Root cause
- The Deals & Pipeline filter helper normalized labels with an incorrectly escaped whitespace regex, so name-based matches could fail.
- Deal attribution is stored through relationships: Campaign is reached through LeadConversion -> Lead -> Campaign; Product is reached through DealProduct -> Product. Older/manual deals may not carry direct attribution in the UI response.
- The stage details table only displayed direct deal campaign/product names, so it showed dashes even when a unique associated lead could provide attribution.

## Changes
- Fixed label normalization (`whitespace`, `_`, and `-` normalization).
- Match the actual Layer 3 Deal DTO fields: `campaign_id`, `campaign_name`, `product_id`, `product_name`, `lead_id`.
- Resolve missing attribution from a directly linked lead, or from an exact unique company-to-lead match. Ambiguous company matches are deliberately not guessed.
- Layer 3 deal list now enriches legacy/manual deals from a unique tenant-scoped lead matching the deal's account/company. It only uses this fallback when there is exactly one matching lead; existing LeadConversion and DealProduct relationships take precedence.
- Stage details table now displays resolved campaign and product names, not only direct deal fields.
- Added regression cases for DTO ID matching, company fallback, AND filter semantics, date ranges, and ambiguous lead matches.

## Tests
- `node --test src/utils/__tests__/dealAnalyticsFilters.test.js`: 12 passed.
- Python compile check for `backend/app/api/routes/deals.py`: passed.

## Data integrity note
A deal with no campaign/product relationship and no unique matching lead should remain unmatched for that filter. This avoids assigning an incorrect campaign or product to a deal.
