# Dashboard pipeline and Total Leads drill-down

## Pipeline by stage
- Stage extraction now checks `stage`, `stage_name`, `pipeline_stage`, `opportunity_stage`, and `status`.
- Stage labels are normalized for spaces, underscores, and hyphens; Closed Won/Won and Closed Lost/Lost are recognized explicitly.
- Unknown stage labels are no longer silently counted as Qualified, preventing inflated Qualified counts.
- Counts and values continue to be calculated from the same Dashboard-filtered, permission-scoped deal records.

## Total Leads KPI click-through
- The Total Leads KPI is now an accessible button.
- Clicking it stores the IDs of the already filtered lead records (period, campaign, product, and current CRM/RBAC scope) and navigates to Leads.
- Leads page applies those IDs to the existing search/status/list filtering and shows a clearable dashboard-filter banner.
- Clearing the banner restores the normal Leads list. No API schema or database changes are required.
