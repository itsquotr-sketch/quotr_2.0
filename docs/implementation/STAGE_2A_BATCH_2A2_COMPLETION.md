# Stage 2A — Batch 2A.2 Completion Report

**Batch:** Runtime Validation Schemas  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)

---

## 1. Objective

Define, test and document authoritative runtime-validation schemas and shared helpers for pricing and quote mutation inputs, including owner-approved gross-margin and markup bounds, without changing pricing formulas or wiring schemas into server actions yet (except narrow margin/markup bound alignment on existing validators).

## 2. Issue IDs addressed

| ID | Treatment |
| --- | --- |
| **S1-002** | Partial — lump-sum and financial field rules encoded in schemas/helpers; action application deferred to Batch 2A.3 |
| **S1-003** | Partial — pricing and quote Zod schemas created; not yet applied to `lib/pricing/actions.ts` / `lib/quotes/actions.ts` |

## 3. Existing validation architecture (before)

* Zod used widely on assistant/projects/rates/setup/settings actions.
* Pricing and quote actions relied on TypeScript types only (`PricingItemInput`, `QuoteItemInput`, etc.).
* Gross-margin helper enforced **0–80%** (`lib/security/margin-validation.ts` and `validateTargetMarginPercent`).
* App default margin constant was **25%** (`DEFAULT_MARGIN_PERCENT`); DB column default remains 25.00 (no migration in this batch).
* Markup existed as:
  * derived persisted fields on pricing documents/items and estimates;
  * editable `rates.markup_percent` (Zod `.min(0)` only, no upper bound).
* Calculation modes: `quantity_rate` | `productivity_labour` | `lump_sum`.
* No dedicated informational / no-charge item type; `optional` / `visible_on_quote` / `visible` flags exist; blank items often start at zero totals.

## 4. Schemas created

* `lib/pricing/schemas.ts` — item/document/create/add/update/duplicate/delete/review input schemas; calculation-mode refinements including mandatory lump-sum totals.
* `lib/quotes/schemas.ts` — quote/item/create/update/visibility/delete/status/revise input schemas; GST helper schema.

## 5. Shared helpers created

* `lib/security/numeric-validation.ts` — finite, non-negative, positive, UUID, trimmed strings, GST percent, deliberate string parse (rejects `""` → 0).
* `lib/security/markup-validation.ts` — `validateMarkupPercent` / `markupPercentSchema` (0–1000%), separate from gross margin.

## 6. Gross-margin changes

* Range **0–95%** inclusive (`MIN_GROSS_MARGIN_PERCENT` / `MAX_GROSS_MARGIN_PERCENT`).
* Messages refer to **gross margin**; document that ≥100% breaks sell-from-cost divisor.
* `DEFAULT_MARGIN_PERCENT` set to **20%**.
* `validateTargetMarginPercent` / `MARGIN_MAX_PERCENT` aligned to 95.
* Existing rates/setup margin Zod bounds pick up new constants.

## 7. Markup treatment

* Markup **exists** in the domain (persisted derived fields + rate `markup_percent`).
* Separate validator **0–1000%**; no conversion to/from margin.
* Rates `markup_percent` Zod schema aligned to the new upper bound.

## 8. Zero-value treatment

| Allowed zero | Why |
| --- | --- |
| Quantities, rates, totals as finite `>= 0` | Existing blank/new lines and optional lines already use zeros |
| Lump-sum `total_cost` / `total_sell` = 0 | Matches current `addPricingItem` seed behaviour |
| Quote item qty/price/total = 0 | Supported by current types; `optional` flag exists |

**Ambiguity documented:** there is **no** dedicated informational / included-at-no-charge / provisional enum. Zero is permitted as intentional non-negative input; invalid/missing values are **not** coerced to zero. A future product field would be required to distinguish “commercial zero” from “invalid omitted” more strictly — out of Stage 2A.2 scope.

## 9. Lump-sum treatment

* Mode remains an allowed enum value.
* Schema requires finite non-negative `total_cost` and `total_sell` when `calculation_mode === "lump_sum"`.
* Negative / non-finite / missing totals rejected.
* No redesign of calculation behaviour; no action wiring yet.

## 10. Files changed

### New

* `lib/security/numeric-validation.ts`
* `lib/security/markup-validation.ts`
* `lib/pricing/schemas.ts`
* `lib/quotes/schemas.ts`
* `scripts/verify-batch-2a2-validation.ts`
* `docs/implementation/STAGE_2A_BATCH_2A2_COMPLETION.md`

### Updated (narrow alignment / docs)

* `lib/security/margin-validation.ts`
* `lib/estimate/constants.ts` (default 20)
* `lib/estimate/margin-override.ts` (max 95)
* `lib/rates/actions.ts` (margin copy + markup max)
* `lib/setup/actions.ts` (margin validation refine)
* `lib/rates/calibration.ts` (default constant)
* `components/setup/CompanyDefaultsStep.tsx` (default fallback)
* `components/rates/CompanyDefaultsSection.tsx` (default fallback)
* `scripts/verify-quote-safety.ts` (expects 95 accepted)
* `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md`
* `docs/MVP_HARDENING_GUIDE.md`

## 11. Tests added

* `scripts/verify-batch-2a2-validation.ts` — exercises exported schemas/helpers (margin, markup, numerics, modes, IDs, quote inputs).

## 12. Commands run and results

| Command | Result |
| --- | --- |
| `./node_modules/.bin/tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npx --yes tsx scripts/verify-batch-2a2-validation.ts` | Pass (all checks) |

## 13. Existing call sites aligned

* Margin helpers and estimate target-margin validator → 0–95.
* Rates/setup company default margin Zod bounds → new constants.
* Rates `markup_percent` → max 1000 via markup validator.
* Default margin constant / UI fallbacks → 20%.
* `scripts/verify-quote-safety.ts` margin assertions updated.

**Not wired (at Batch 2A.2 close):** `lib/pricing/actions.ts` and `lib/quotes/actions.ts` did not yet call the new schemas (Batch 2A.3).

**Post-batch note (2026-08-03):** Schemas were wired in Batches 2A.3A (pricing) and 2A.3B (quotes). In 2A.3B, `reviseQuoteFromFinalPricingInputSchema` was corrected so `quoteId` is required and `pricingDocumentId` is optional — matching the real action payload without weakening validation.

## 14. Known limitations

* DB `organisation_settings.default_margin_percent` default remains **25.00** until an authorised migration (not this batch).
* Schemas are not yet enforced on pricing/quote server actions.
* No explicit no-charge/informational item type in the domain model.
* Quote total trust vs recompute decision deferred to 2A.3 / Stage 2B.
* GST bounds encoded as 0–100 pending any tighter owner rule (R8).

## 15. Confirmation — pricing formulas

**No pricing formulas, estimate arithmetic, or quote arithmetic were changed.** Calculation helpers were not modified except margin **bound** constants used by validation.

## 16. Confirmation — server-action rollout

**No broad schema application** to pricing/quote actions. Only narrow margin/markup bound alignment on existing validators/defaults.

## 17. Confirmation — migrations / remote

**None.** No migrations created or applied. No remote Supabase changes.

## 18. Recommended next step

**Batch 2A.3A only** — apply authentication, ownership and these schemas to pricing (and then quote) server actions, preserving current calculation behaviour.

Do not begin Batch 2A.3 until explicitly authorised.
