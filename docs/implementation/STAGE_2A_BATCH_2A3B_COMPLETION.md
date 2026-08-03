# Stage 2A — Batch 2A.3B Completion Report

**Batch:** Secure Quote Server Actions  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)

---

## 1. Objective

Apply Batch 2A.1 authentication / organisation-ownership infrastructure and Batch 2A.2 quote runtime validation schemas to all quote-related server actions, without changing quote or pricing arithmetic, quote presentation, or database defaults.

## 2. Issue IDs addressed

| ID | Treatment |
| --- | --- |
| **S1-003** | Quote-action portion addressed — Batch 2A.2 quote schemas wired into every client-callable quote mutation |
| **S1-015** | Quote-action portion — `getAuthOrgContext` replaced with `requireAuthOrgContext`; `loadOwnedQuote` delegates to shared auth + `assertOrgOwnsQuote` |
| **S1-002** | Not reopened (pricing-action work remains Batch 2A.3A) |

## 3. Quote action inventory

| Export | Auth | Ownership | Schema | Multi-write | Partial-write risk | Public shape |
| --- | --- | --- | --- | --- | --- | --- |
| `getLatestQuoteSummary` | `requireAuthOrgContext` | project | N/A (read) | no | none | `null` / summary |
| `getQuoteSummariesForProjects` | `requireAuthOrgContext` | org filter | N/A | no | none | map |
| `getQuoteSummaryForPricingDocument` | `requireAuthOrgContext` | pricing document | N/A | no | none | `null` / summary |
| `getQuoteWorkspaceData` | `requireAuthOrgContext` | project + quote | N/A | no | none | `notFound()` / data |
| `getQuotePrintData` | `requireAuthOrgContext` | project + quote | N/A | no | none | `notFound()` / data |
| `createQuoteFromPricing` | `requireAuthOrgContext` | project + pricing doc | `createQuoteFromPricingInputSchema` | yes | compensating org-scoped quote delete | `{ error }` / redirect |
| `updateQuote` | via `loadOwnedQuote` | quote | `updateQuoteInputSchema` | no | low | `{ error }` / `{ success }` |
| `updateQuoteItem` | `requireAuthOrgContext` | item + parent quote | `updateQuoteItemInputSchema` | item + totals | low | `{ error }` / `{ success }` |
| `setQuoteItemVisible` | `requireAuthOrgContext` | item + parent quote | `setQuoteItemVisibleInputSchema` | item + totals | low | `{ error }` / `{ success }` |
| `deleteQuoteItem` | `requireAuthOrgContext` | item + parent quote | `deleteQuoteItemInputSchema` | delete + totals | low | `{ error }` / `{ success }` |
| `markQuoteSent` | via `loadOwnedQuote` | quote | `quoteIdInputSchema` | quote + pricing + project | existing multi-side effects | `{ error }` / `{ success }` |
| `markQuoteAccepted` | via `loadOwnedQuote` | quote | `quoteIdInputSchema` | quote + project | existing | `{ error }` / `{ success }` |
| `markQuoteDeclined` | via `loadOwnedQuote` | quote | `quoteIdInputSchema` | quote + project | existing | `{ error }` / `{ success }` |
| `markQuoteExpired` | via `loadOwnedQuote` | quote | `quoteIdInputSchema` | quote | low | `{ error }` / `{ success }` |
| `reviseQuote` | `requireAuthOrgContext` | project + quote | `reviseQuoteInputSchema` | new quote + items + supersede | compensating cleanup | `{ error }` / redirect |
| `reviseQuoteFromFinalPricing` | `requireAuthOrgContext` | project + quote + pricing | `reviseQuoteFromFinalPricingInputSchema` | same pattern | compensating cleanup | `{ error }` / redirect |

No duplicate-quote-item action exists in production.

## 4. Authentication changes

* All protected quote reads and mutations use `requireAuthOrgContext()` (or `loadOwnedQuote`, which delegates to it).
* Organisation ID comes only from the authenticated profile.
* Unauthenticated / missing-org results use controlled `AUTH_ORG_MESSAGES`.
* No client-supplied organisation ID is accepted.

## 5. Ownership changes

* Shared helpers: `assertOrgOwnsProject`, `assertOrgOwnsQuote`, `assertOrgOwnsQuoteItem`, `assertOrgOwnsPricingDocument`.
* `assertOrgOwnsQuoteItem` now accepts an optional parent `quoteId` for mismatched-parent rejection.
* Create/revision paths verify project, source quote, and pricing document (when supplied or resolved) before writes.
* Missing and foreign IDs return equivalent generic not-found messages.

## 6. Schemas wired by action

| Action | Schema |
| --- | --- |
| `createQuoteFromPricing` | `createQuoteFromPricingInputSchema` |
| `updateQuote` | `updateQuoteInputSchema` |
| `updateQuoteItem` | `updateQuoteItemInputSchema` → calc → `validateQuoteItemTotalForPersistence` |
| `setQuoteItemVisible` | `setQuoteItemVisibleInputSchema` |
| `deleteQuoteItem` | `deleteQuoteItemInputSchema` |
| `markQuoteSent` / `Accepted` / `Declined` / `Expired` | `quoteIdInputSchema` |
| `reviseQuote` | `reviseQuoteInputSchema` |
| `reviseQuoteFromFinalPricing` | `reviseQuoteFromFinalPricingInputSchema` |

Shared parse helper: `parseQuoteInput` in `lib/quotes/action-guards.ts`.

### Schema correction (Batch 2A.2 compatibility)

`reviseQuoteFromFinalPricingInputSchema` was aligned to the real action payload:

* **Before (2A.2):** `pricingDocumentId` required, `quoteId` optional  
* **After (2A.3B):** `quoteId` required, `pricingDocumentId` optional  

Validation was not weakened. Batch 2A.2 verification still passes.

## 7. Quote item validation

* Label required; quantity / unit_price / total finite and non-negative when present.
* Empty/invalid numeric strings are not coerced to zero.
* Client-supplied totals validated by schema; computed totals re-checked before persist.
* Existing `calculateQuoteItemTotal` behaviour preserved for valid inputs.
* Parent quote ownership verified before item mutations.
* Quote items have no category/type enum in the current model — N/A for enum rejection beyond status schemas.

## 8. Quote creation and revision treatment

1. Validate full external payload.
2. Resolve authenticated organisation.
3. Verify project / quote / pricing ownership.
4. Apply existing business rules (reviewed pricing, revisable statuses, etc.).
5. Persist; on item-copy failure, delete only the newly created quote (and its new items on supersede failure), scoped by `org_id`.

Copied children always receive authenticated `org_id`. No new transaction/RPC architecture.

## 9. Status and lifecycle treatment

* Status mutations accept only a validated quote ID; target status is hardcoded per action (`sent`, `accepted`, `declined`, `expired`) — not client-supplied.
* `quoteStatusSchema` rejects unknown statuses at the schema layer (used for validation/verification).
* Existing editable-draft rules and `REVISABLE_QUOTE_STATUSES` / `REFRESH_FROM_PRICING_STATUSES` preserved.
* **Limitation:** no full transition state machine was invented; each mark-* action remains independently callable as before. Documented, not redesigned.

## 10. Error contract

* Auth: `Not authenticated.` / `Organisation setup is required.`
* Ownership: `Quote not found.` / `Quote item not found.` / `Project not found.` / `Pricing document not found.`
* Schema: first Zod issue message.
* Database: `toUserError` with existing `USER_ERRORS.*` fallbacks — no raw PostgREST messages.
* Recalc throws use generic quote update failure message (dev-only console detail).

## 11. Partial-write protections and limitations

| Path | Protection | Residual risk |
| --- | --- | --- |
| Create from pricing | Org-scoped compensating delete of new quote if items fail | Compensating delete itself could fail |
| Revise / revise-from-pricing | Compensating delete of new quote (+ items) if copy or supersede fails | No multi-statement transaction |
| Mark sent | Quote status then pricing/project side effects | Existing multi-resource side effects unchanged |
| Item update/delete | Item then totals recalc | Totals recalc failure surfaces as controlled error |

## 12. Files changed

### Application

* `lib/quotes/actions.ts`
* `lib/quotes/action-guards.ts` *(new)*
* `lib/quotes/schemas.ts` (revise-from-pricing schema alignment)
* `lib/security/org-ownership.ts` (optional parent quoteId on quote item assert)

### Verification / docs

* `scripts/verify-batch-2a3b-quote-actions.ts` *(new)*
* `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md`
* `docs/MVP_HARDENING_GUIDE.md`
* `docs/implementation/STAGE_2A_BATCH_2A3B_COMPLETION.md` *(this file)*
* `docs/implementation/STAGE_2A_BATCH_2A2_COMPLETION.md` (schema correction note)

## 13. Tests added

* `scripts/verify-batch-2a3b-quote-actions.ts`

## 14. Commands and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npx tsx scripts/verify-batch-2a1-auth-org.ts` | Pass |
| `npx tsx scripts/verify-batch-2a2-validation.ts` | Pass |
| `npx tsx scripts/verify-batch-2a3a-pricing-actions.ts` | Pass |
| `npx tsx scripts/verify-batch-2a3b-quote-actions.ts` | Pass |

## 15. Public return-shape changes

* Shape remains `{ error: string }` / `{ success: true }` / redirect / `null` / `notFound()`.
* `createQuoteFromPricing` auth failure now uses shared `AUTH_ORG_MESSAGES` (aligned with pricing 2A.3A).
* Compensating deletes now also filter `org_id` (behavioural safety, not return-shape).

## 16. Remaining duplicate helpers

* Pricing `loadOwnedPricingDocument` and quote `loadOwnedQuote` remain thin wrappers that **delegate** to shared auth + ownership (not independent org resolvers).
* Lifecycle / project-notes ownership loaders outside quotes remain for later batches if needed.
* No independent local auth copy remains in `lib/quotes/actions.ts`.

## 17. Known limitations

* No full quote status transition state machine.
* No DB transaction for multi-step create/revise beyond compensating cleanup.
* Quote vs final-pricing subtotal divergence intentionally unchanged (Stage 6 / 2B).
* Database column default margin remains **25%**.
* Quote items have no category/type enum to validate beyond existing fields.

## 18. Confirmation no quote/pricing formulas changed

`lib/quotes/calculations.ts`, pricing calculation modules, and estimate arithmetic were **not** modified.

## 19. Confirmation no migrations or remote changes

No migrations created or applied. No remote Supabase changes. DB default gross margin remains 25%.

## 20. Recommended next step

Owner decisions as needed, then **Batch 2A.4 only** (database and RLS corrections). Do not begin Stage 2B formula consolidation without explicit approval.
