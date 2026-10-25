# Layer 2 Gateway patch for Layer 9

This patch makes the new analytics endpoints available through Layer 2 at `/v1/analytics/...`. It does not change or replace the existing Layer 3 API routes.

## Apply

1. Extract the `Dakini_CRM_Layer9_Complete_Integration.zip` package, or copy its `gateway-patch/` folder into your existing `dakinicrm` repository checkout.
2. From the **repository root** (the folder containing `gateway/`, `backend/`, and `src/`), run:

   ```powershell
   python gateway-patch/apply_gateway_integration.py
   ```

3. Review the script's modified files and `.layer9-integration-backup/`.
4. Set `ANALYTICS_API_URL=http://localhost:8090` in your gateway environment.
5. Start Layer 9 on port 8090 and Layer 2 on port 8080.
6. Set the frontend to `VITE_ANALYTICS_BASE_URL=/v1/analytics` and restart Vite.

The script is idempotent. It backs up each file the first time it changes it. If your Gateway files have materially diverged from the linked branch, the script stops rather than guessing at edits.

## Security behavior

- This proxy route is placed before the Gateway's generic `/v1/{path:path}` proxy.
- It requires the existing Gateway JWT validation and rate-limit middleware.
- It only forwards the registered read-only analytics report paths.
- It removes caller-supplied `X-Tenant-Id`, `X-User-Id`, `X-User-Roles`, and `X-Team-Id` headers and replaces them with identity claims established by JWT validation.
- Layer 9 should listen on a private interface and remain unreachable to untrusted clients. The frontend's `/analytics` Vite proxy is intended for local development only.
- Layer 9 still needs a real organization ID or slug that exists in `public.organizations`. The optional `TENANT_SLUG_MAP_JSON` maps Gateway tenant aliases to an organization id/slug; it does not create organizations.

## Verification

From the repository root, run your existing Gateway pytest suite, then test authenticated requests to:
`/v1/analytics/reports/overview?period=month` and
`/v1/analytics/reports/export.csv?report=lead-sources&period=last_30_days`.

The analytics service should return its normal JSON / CSV response, not a Layer 3 fallback mock. Invalid tenant identities must continue to fail closed.
