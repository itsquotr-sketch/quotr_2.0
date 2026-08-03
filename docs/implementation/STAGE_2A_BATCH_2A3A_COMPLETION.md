# Stage 2A — Batch 2A.3A Completion Report

**Batch:** Secure Pricing Server Actions  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)

---

## 1. Objective

Apply Batch 2A.1 authentication / organisation-ownership infrastructure and Batch 2A.2 runtime validation schemas to all pricing-related server actions, without changing pricing formulas, quote actions, lump-sum commercial meaning, or database defaults.

## 2. Issue IDs addressed

| ID | Treatment |
| --- | --- |
| **S1-002** | Pricing-action portion addressed — lump-sum and financial inputs validated before persistence; `forwardTotalsMatchStored` lump-sum cross-check bypass retained but no longer reachable without schema + commercial guards |
| **S1-003** | Pricing-action portion addressed — Batch 2A.2 schemas wired into every client-callable pricing mutation |
| **S1-015** | Pricing-action portion — local `getAuthOrgContext` usage in pricing actions replaced with `requireAuthOrgContext`; `loadOwnedPricingDocument` now uses shared ownership assert |
| **Quote-action enforcement** | Explicitly **not** done — remains Batch **2A.3B** |

## 3. Pricing action inventory

| Export | Auth | Ownership | Schema | Reads | Writes | Multi-write | Client financial values | Transaction | Partial-write risk | External errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `getLatestPricingSummary` | `requireAuthOrgContext` | `assertOrgOwnsProject` | N/A (read) | pricing_documents | none | no | no | n/a | none | `null` |
| `getPricingSummariesForProjects` | `requireAuthOrgContext` | org filter only on listed IDs | N/A | pricing_documents | none | no | no | n/a | none | empty map |
| `getProjectWorkspaceTabContext` | `requireAuthOrgContext` | `assertOrgOwnsProject` | N/A | estimate + pricing | none | no | no | n/a | none | safe empty |
| `getPricingWorkspaceData` | `requireAuthOrgContext` | project + document asserts | N/A | workspace rows | none | no | no | n/a | none | `notFound()` |
| `createPricingFromEstimate` | `requireAuthOrgContext` | project + optional estimate | `createPricingFromEstimateInputSchema` | project, estimate, lines, work areas | document + items + optional project status | yes | no (from estimate) | no RPC | compensating delete on item failure | controlled `{ error }` / redirect |
| `updatePricingDocument` | via `loadOwnedPricingDocument` | document assert | `updatePricingDocumentInputSchema` | document | document (+ totals if GST) | conditional | GST/metadata | no | low | `{ error }` / `{ success }` |
| `updatePricingItem` | `requireAuthOrgContext` | item (+ work area) | `updatePricingItemInputSchema` | item, document | item + audit + totals | yes | yes | no | audit best-effort after item write | `{ error }` / success + item/document |
| `addPricingItem` | `requireAuthOrgContext` | document + project (+ work area) | `addPricingItemInputSchema` | sort order | item + totals | yes | seeded zeros | no | low | `{ error }` / success |
| `duplicatePricingItem` | `requireAuthOrgContext` | item + parent document | `duplicatePricingItemInputSchema` | source item | copy + totals | yes | copied from owned source | no | low | `{ error }` / success |
| `deletePricingItem` | `requireAuthOrgContext` | item | `deletePricingItemInputSchema` | item | delete + audit + totals | yes | no | no | audit best-effort after delete | `{ error }` / success |
| `markPricingReviewed` | via `loadOwnedPricingDocument` | document assert | `markPricingReviewedInputSchema` | document | status/reviewed_at | no | no | no | none | `{ error }` / `{ success }` |

## 4. Authentication changes

* All protected pricing reads and mutations use `requireAuthOrgContext()` (or `loadOwnedPricingDocument`, which delegates to it).
* Organisation ID comes only from the authenticated profile path.
* Unauthenticated / missing-org results return controlled `AUTH_ORG_MESSAGES` (or `null` / `notFound()` for reads).
* No client-supplied organisation ID is accepted.

## 5. Ownership changes

* Shared helpers used: `assertOrgOwnsProject`, `assertOrgOwnsPricingDocument`, `assertOrgOwnsPricingItem`, `assertOrgOwnsWorkArea`.
* New helper: `assertOrgOwnsEstimate` (for create-from-estimate when `estimateId` is supplied).
* Duplicate/delete/update verify item ownership before mutation; duplicate also verifies parent document ownership.
* Missing and foreign IDs return the same generic not-found messages.

## 6. Schema wiring by action

| Action | Schema |
| --- | --- |
| `createPricingFromEstimate` | `createPricingFromEstimateInputSchema` |
| `updatePricingDocument` | `updatePricingDocumentInputSchema` |
| `updatePricingItem` | `updatePricingItemInputSchema` → calc → `validateComputedItemForPersistence` |
| `addPricingItem` | `addPricingItemInputSchema` → seed calc → commercial guard |
| `duplicatePricingItem` | `duplicatePricingItemInputSchema` |
| `deletePricingItem` | `deletePricingItemInputSchema` |
| `markPricingReviewed` | `markPricingReviewedInputSchema` |

Shared parse helper: `parsePricingInput` in `lib/pricing/action-guards.ts`.

No Batch 2A.2 schema field inventing or weakening was required.

## 7. Lump-sum guard sequence

1. `updatePricingItemInputSchema` / `pricingItemInputSchema` — requires finite non-negative `total_cost` and `total_sell` when `calculation_mode === "lump_sum"`.
2. `requireAuthOrgContext()`.
3. `assertOrgOwnsPricingItem` (+ optional work-area assert).
4. Existing `calculatePricingItemTotals` (may still take the `forwardTotalsMatchStored` lump-sum bypass for quantity×rate cross-checks — **unchanged**).
5. `validateComputedItemForPersistence` — finite non-negative totals + gross margin 0–95% + markup 0–1000%.
6. Persist item; best-effort audit log; recalculate document totals.

Invalid lump-sum never reaches step 6.

## 8. Quantity-rate and productivity-labour treatment

* Schemas enforce mode-specific required fields (quantity for quantity-rate; productivity rate or calculated hours for productivity-labour).
* Arithmetic still uses existing `calculatePricingItemTotals` / `calculatePricingItemTotalsForSave`.
* Valid inputs retain prior calculation behaviour; invalid inputs fail before write.

## 9. Error contract

* Auth: `Not authenticated.` / `Organisation setup is required.`
* Ownership: resource-specific `… not found.` (missing ≡ foreign).
* Schema: first Zod issue message (user-safe).
* Database failures: `toUserError(..., PRICING_SAVE_FAILED)` — no raw PostgREST messages to clients.
* Recalc internal throws use the same generic save message (dev-only console detail).

## 10. Partial-write assessment

| Action | Assessment |
| --- | --- |
| `createPricingFromEstimate` | Validates + ownership first. Document insert then items; on item failure, compensating delete of the new document (org-scoped). No DB transaction/RPC — residual risk if compensating delete fails (documented for 2A.4 / 2B as appropriate). |
| `updatePricingItem` / `deletePricingItem` | Primary mutation completes before audit log; audit remains best-effort (existing product intent). |
| `addPricingItem` / `duplicatePricingItem` | Item write then document totals recalculation; no broad transaction architecture added. |

## 11. Files changed

### Application

* `lib/pricing/actions.ts`
* `lib/pricing/action-guards.ts` *(new)*
* `lib/security/org-ownership.ts` (`assertOrgOwnsEstimate`)

### Verification / docs

* `scripts/verify-batch-2a3a-pricing-actions.ts` *(new)*
* `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md`
* `docs/MVP_HARDENING_GUIDE.md`
* `docs/implementation/STAGE_2A_BATCH_2A3A_COMPLETION.md` *(this file)*

## 12. Tests added

* `scripts/verify-batch-2a3a-pricing-actions.ts` — auth, ownership indistinguishability, schema rejects, lump-sum guard path, other modes, mutation ordering, sanitized DB errors.

## 13. Commands run and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npx tsx scripts/verify-batch-2a2-validation.ts` | Pass |
| `npx tsx scripts/verify-batch-2a3a-pricing-actions.ts` | Pass |
| `npx tsx scripts/verify-batch-2a1-auth-org.ts` | Pass |

## 14. Public return-shape changes

* Shape remains `{ error: string }` / `{ success: true, … }` / redirect / `null` / `notFound()`.
* `createPricingFromEstimate` auth failure message aligned to shared `AUTH_ORG_MESSAGES` (no longer the longer “organisation profile could not be loaded…” string).
* Database failure messages are now generic (`Could not save pricing changes…` / action-specific safe fallbacks) instead of raw Supabase `error.message`.

## 15. Known limitations

* No multi-statement DB transaction for create-from-estimate beyond compensating delete.
* Audit-log failures do not roll back item mutations (preserved intent).
* Database column default margin remains **25%** (deferred — Batch 2A.4 or explicitly approved migration).
* Quote actions unsecured by this batch (2A.3B).
* `getPricingSummariesForProjects` trusts the caller-supplied project ID list under org filter only (dashboard batch read); individual workspace paths assert project ownership.

## 16. Duplicated helpers remaining

Intentionally retained elsewhere (not pricing-action local auth copies):

* `loadOwnedProject`, `loadOwnedQuote`, `assertProjectOwned` and similar lifecycle/quote loaders (quote path is 2A.3B).
* Pricing still uses a thin `loadOwnedPricingDocument` wrapper that **delegates** to `requireAuthOrgContext` + `assertOrgOwnsPricingDocument` (not a duplicate resolver).

## 17. Confirmation no formulas changed

Pricing arithmetic modules (`lib/pricing/calculations.ts`, `lib/pricing/pricing-item-calculation.ts`, including `forwardTotalsMatchStored` lump-sum bypass) were **not** modified. Estimate arithmetic was **not** modified.

## 18. Confirmation no migrations or remote database changes

No migrations created or applied. No remote Supabase changes. DB default margin remains 25%.

## 19. Recommended next step

**Batch 2A.3B only** — Secure quote server actions with the same auth / ownership / schema pattern. Do not begin formula consolidation (Stage 2B) or Batch 2A.4 migrations without explicit approval.
