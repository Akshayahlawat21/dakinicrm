# Dashboard Pipeline by stage – data source correction

The screenshot showed only 8 records counted (Qualified 5 + Proposal 3), while the Dashboard's opportunity KPI reflected a larger set. The chart had been forcing the locally loaded Deals page collection even when the complete Layer 9 stage aggregation was available.

- The unfiltered Dashboard chart now prefers the complete analytics pipeline aggregation returned by the analytics API.
- Campaign/product-filtered Dashboard views still use the corresponding filtered deal records (Dashboard passes an empty aggregation array in that case).
- Stage resolution checks all supported stage/status fields and nested opportunity/deal stage fields; an unrecognized earlier field no longer hides a recognized later field.
- It recognizes Negotiation, Won/Closed Won, Lost/Closed Lost, Proposal/Quote, and Qualified/Discovery/Qualification.
- All five stage columns always render, including zero-count stages.

Note: exact live counts depend on the Layer 9 API returning rows for all five stages. If the API itself omits a stage or returns incorrect counts, the backend aggregation query must be corrected against the live database.
