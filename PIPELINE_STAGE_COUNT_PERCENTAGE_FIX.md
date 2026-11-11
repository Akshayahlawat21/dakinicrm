# Pipeline stage count and percentage fix

- Dashboard PipelineStageChart calculates stage counts and values from the exact dashboardFilteredDeals collection whenever deal records are supplied. Cached Layer 9 API rows no longer override the filtered records. This fixes stale/mismatched Qualified counts and restores Won counts.
- Deals & Pipeline horizontal stage bars use stage count / total filtered deals * 100 for width, matching the percentage shown in the label. Previously width was relative to the largest stage, so a stage labelled 29% could occupy nearly the full track.
- For the 7-deal example: Qualified 2 = 28.6%, Negotiation 2 = 28.6%, Won 3 = 42.9%; Proposal and Lost = 0%.
