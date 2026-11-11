# Campaign attribution implementation

## Lead creation
- The Lead form has an optional Campaign dropdown populated from the existing Campaign API data (active/running campaigns).
- Lead Source remains a separate field.
- A campaign can also be attributed from `utm_campaign` on the current landing-page URL. The form preselects a matching campaign when available and submits the UTM value for server-side resolution.

## Backend persistence
- The existing `leads.campaign_id` foreign key is used; no duplicate campaign column is introduced.
- The API validates explicit campaign IDs within the current organization. If no ID is supplied, it resolves `utm_campaign` against the organization's campaign name (including hyphen/underscore slug variants).
- The lead is also registered in the existing `campaign_members` table.
- Existing schema SQL and seed migration already define `leads.campaign_id`.

## Conversion and analytics
- Lead conversion retains attribution through `lead_conversions` -> `leads.campaign_id`.
- The selected Lead product is copied into `deal_products` as one line item during conversion.
- Deal list responses now include Account company name, Campaign ID/name, and Product ID/name.
- Deal Company no longer falls back to the Deal name; missing Account names display as an em dash in the frontend mapping.
- Deals & Pipeline can consume the returned campaign/product fields for its existing filters and shared filtered chart dataset.

## UTM format
Use campaign names as URL slugs, for example:
`https://example.com/contact?utm_source=google&utm_medium=cpc&utm_campaign=november-crm-promotion`

`utm_campaign` should match the Campaign name `November CRM Promotion`. If the name cannot be resolved, the lead is saved without a campaign attribution; it is not assigned to an arbitrary campaign.

## Verification
- Python backend source compilation passed with `python -m compileall -q backend/app`.
- Backend pytest execution was blocked in this environment because the installed Python environment is missing `bcrypt`.
- Vite production build could not run because frontend dependencies (`node_modules/.bin/vite`) are not installed; `npm ci` did not complete within the available execution window. Run `npm ci` then `npm run build` in the project directory before deployment.
