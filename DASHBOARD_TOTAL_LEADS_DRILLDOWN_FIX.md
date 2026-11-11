# Dashboard Total Leads drill-down fix (latest uploaded project)

- The Dashboard Total Leads KPI now displays `dashboardFilteredLeads.length` consistently. This is the same set filtered by the selected period, campaign, and product, rather than switching to the unfiltered overview API total when campaign/product are set to All.
- Clicking the KPI stores the IDs from that exact filtered lead set and navigates to Leads.
- LeadsPage now actually applies the stored ID set before its existing search/status/tab filters. This was the missing condition that caused the normal lead list to remain visible.
- The Leads page displays a banner showing the Dashboard-scoped record count and provides Clear filter to return to the normal list.
- Existing CRM data context/RBAC scope is retained: the drill-down only selects from the lead records already available to the current user.
