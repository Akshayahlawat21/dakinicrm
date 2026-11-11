# Dashboard and Deals & Pipeline filter correction

## Fixes
- One shared attribution resolver now handles direct deal campaign/product IDs, arrays of linked campaign/product IDs, linked lead IDs, and exact unique-company fallback for legacy deals.
- Campaign/product names normalize punctuation and whitespace, so values such as `Dakinicrm` and `Dakini CRM` resolve to the same catalog item.
- Dashboard lead counts use both foreign keys and the lead's `interested_product` label.
- Dashboard open-opportunity count, active pipeline value, weighted pipeline value and stage chart use the filtered deal set. This removes the unfiltered `10` count shown while a selected campaign has no converted deals.
- Deals & Pipeline filters now also filter the Kanban stage columns and page-level active/total pipeline figures, not only the analytics card.
- Deals API response now returns all campaign and product IDs/names related to an opportunity/deal, instead of retaining an arbitrary single relationship.
- Stage-details table displays all resolved campaign/product names.
- Product catalog endpoint includes all non-deleted products, including inactive products referenced by historic leads/deals.
- Campaign catalog request fetches up to 1000 records; API limit raised accordingly.
- Date filtering uses calendar week/month/quarter/year-to-date for dashboard and the selected rolling date window for Deals analytics.

## Validation
- Node filter regression tests: 16 passed.
- Backend Python compileall: passed.
- Full frontend production build not run because node_modules is not installed in the supplied project folder.
- Live Supabase data verification and concurrent load testing remain deployment checks.
