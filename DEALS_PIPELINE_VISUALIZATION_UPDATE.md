# Deals & Pipeline visualization update

## Changes
- Added a Deals & Pipeline analytics panel with shared Campaign, Product and Date Range filters.
- Added Funnel, Pie, Donut and Bar chart modes.
- Funnel stage names and counts are rendered in a high-contrast layout with a separate stage legend so labels remain readable.
- Clicking a stage in the visualization opens its stage-specific metrics and deals table.
- Added all five stages (Qualified, Proposal, Negotiation, Won, Lost) to the main Dashboard's Pipeline by stage chart.
- Clicking a stage in the main Dashboard stores the selected stage and opens Deals & Pipeline with that stage's detail panel selected.

## Data behavior
- Filters use campaign/product attributes on deals and, where available, the linked lead's campaign/product attributes.
- No campaign or product is fabricated for deals that have no association.
- Date presets use deal creation/update/close dates where available. Records without a usable date remain visible under All time.
- Analytics are calculated from the CRM records already loaded by the existing CRM context; existing auth, tenant handling, RBAC, API and database code are unchanged.

## Files
- `src/components/common/DealsPipelineAnalytics.jsx` (new)
- `src/components/common/Charts.jsx`
- `src/pages/DealsPage.jsx`
- `src/pages/DashboardPage.jsx`
