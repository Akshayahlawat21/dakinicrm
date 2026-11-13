# AI chat visualization update

## What changed
- AI chat can render normal assistant prose, Markdown headings/lists, readable Markdown tables, and `crm-chart` JSON blocks in one response.
- Supported chart types: bar (category comparison), pie (part-to-whole), and line (time trend).
- Each chart includes a collapsible data table for exact values and accessibility/readability.
- Chart rendering uses React + inline SVG/CSS; no chart package or extra browser dependency was added.
- Layer 5 prompt asks Gemini to include a chart block only when existing CRM tool results contain sufficient numeric data. Individual-record questions should use a Markdown table instead.
- The chart block is generated from the same model response and retrieved CRM tool results. It does not trigger another Gemini API request or another CRM query.

## Chart response format

```crm-chart
{"type":"bar","title":"Leads by status","labels":["New","Qualified","Won"],"series":[{"name":"Leads","data":[12,8,4]}]}
```

Use `bar`, `pie`, or `line`. `labels` and each series' `data` must be aligned and sourced from tool results. Do not emit a chart if data is empty, non-numeric, or insufficient.

## Verification
- Python compile check passed for `ai/app` and `backend/app`.
- Layer 5 tests: 10 passed.
- Frontend production build was not run because `node_modules` is not present in this workspace. Run `npm install` and `npm run build` in the project environment before merging/deploying.
- No live Gemini API or production database test was performed.
