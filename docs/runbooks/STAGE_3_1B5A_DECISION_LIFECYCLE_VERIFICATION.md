# Stage 3.1B.5A — Decision Lifecycle Verification Runbook

**Status:** Local verification  
**Date:** 2026-08-05  
**Script:** `scripts/verify-stage-3-1b5a-decision-lifecycle.ts`  
**Prerequisite:** Local Supabase Docker; migrations through `029`

---

## Preconditions

1. `npx supabase start` (or already running).  
2. Do **not** point at Preview/production URLs.  
3. Script refuses non-local API URLs.

---

## Commands

```bash
npx supabase db reset
npx tsx scripts/verify-stage-3-1b5a-decision-lifecycle.ts
```

Full regression (required for batch close):

```bash
npx supabase db reset
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/verify-stage-3-1a-product-stabilisation.ts
npx tsx scripts/verify-stage-3-1a-r1-preview-remediation.ts
npx tsx scripts/verify-stage-3-1d-domain-model-refinement.ts
npx tsx scripts/verify-stage-3-1b1-suggestion-contract.ts
npx tsx scripts/verify-stage-3-1b2-scope-relationship-catalogue.ts
npx tsx scripts/verify-stage-3-1b3-ai-discovery-provider.ts
npx tsx scripts/verify-stage-3-1b4a-discovery-orchestration.ts
npx tsx scripts/verify-stage-3-1b4b-persistence.ts
npx tsx scripts/verify-stage-3-1b5a-decision-lifecycle.ts
npx tsx scripts/verify-rls-coverage.ts
npx tsx scripts/verify-batch-2b10-final-commercial-authority.ts
```

---

## Coverage map

| Area | Checks |
| --- | --- |
| Acceptance | WA created; ACCEPT linked; no Facts; immutable suggestion; duplicate/foreign/stale/superseded blocked |
| Rejection | Append-only; no WA; idempotent retry; foreign blocked; after scope blocked; suppression evidence |
| Modify | Corrected WA; decision fields; immutable original; second create blocked; invalid type blocked |
| Atomicity | WA fail → no decision; decision fail → no WA; concurrent ACCEPT → one WA; ACCEPT vs MODIFY → one scope |
| Security | Auth required; anon EXECUTE denied; cross-org as not found; sanitised codes |
| Boundaries | No Analyse Job / UI / DNA / commercial imports |

---

## Remote

Do **not** apply migrations 028/029 remotely from this runbook.
