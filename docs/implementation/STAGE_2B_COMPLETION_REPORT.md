# Stage 2B — Completion Report

**Status:** Complete — Local  
**Date:** 2026-08-05  
**Closing batch:** 2B.10 — Final Commercial-Engine Regression, Legacy Cleanup and Stage Completion  
**Deployment:** Not executed (owner-gated)  
**Stage 2C:** Not started  

---

## 1. Executive summary

Stage 2B delivers one authoritative commercial calculation engine under `lib/commercial-engine/`. Estimate, pricing and quote production adapters consume it. Client UI is presentation-only (persisted values or approved engine-backed previews). Historical quote snapshots remain immutable. Stage 2A security regression remains intact. No migrations, AI redesign, Company DNA, or formula changes occurred in Stage 2B adoption batches.

**Local status:** Complete — Local. Production deployment and smoke test remain owner-gated.

---

## 2. Stage objective

Establish a single deterministic commercial truth for money arithmetic across estimates, final pricing and quotes, without rebuilding the product, without Company DNA, and without silently rewriting historical quotes.

---

## 3. Batches completed

| Batch | Title | Outcome |
| --- | --- | --- |
| 2B.1 | Pricing engine audit | Inventory of duplicated formulas |
| 2B.2 | Owner commercial decisions | OCD register |
| 2B.3A–2B.3C | Engine kernel, goldens, contract/replay | Engine + 60 goldens + 37 contract |
| 2B.4 | Shadow parity | Legacy classified; historic C-28 blocker archived |
| 2B.5 | GST source + adoption gate | C-28 corrected; 0 blockers |
| 2B.6A–2B.6B | Pricing-domain adoption | Item CRUD, aggregates, estimate→pricing, recalibration |
| 2B.7 | Estimate-domain adoption | Line money, margin, aggregates |
| 2B.8 | Quote-domain adoption | Visible aggregates, draft recalc; revise-copy immutable |
| 2B.9 | Client financial authority removal | Presentation boundary + view models |
| 2B.10 | Final regression + stage close | This report |

---

## 4. Commercial decisions

Owner decisions (OCD / CD register) govern gross-margin primary, GST on sell, unknown-cost honesty, visible-only quote aggregation, CD-22 prefer-total, and exclusion of discounts/credits from Stage 2B. Formulas were not changed in 2B.10.

---

## 5. Golden scenario coverage

- Golden suite: **60/60** (`scripts/verify-batch-2b3b-golden-commercial-engine.ts`)
- Expectations were not altered to pass

---

## 6. Engine architecture

```text
lib/commercial-engine/     ← authoritative arithmetic
  ├── core/                money, sell-from-margin, profit
  ├── calculations/        line modes + document aggregate
  ├── contract/            request/record/replay
  ├── fixtures/            golden scenarios
  ├── versioning/          ENGINE_VERSION / FORMULA_VERSION
  └── parity/              comparison-only (never production)

Production adapters:
  lib/estimate/estimate-commercial-engine-adapter.ts
  lib/pricing/commercial-engine-adapter.ts
  lib/pricing/authoritative-document-totals.ts
  lib/pricing/estimate-to-pricing-adapter.ts
  lib/quotes/quote-commercial-engine-adapter.ts
```

---

## 7. Contract and replay

- Contract suite: **37/37** (`scripts/verify-batch-2b3c-engine-contract.ts`)
- Unsupported versions fail safely
- Engine version: `2B.3C.0` · Formula version: `2B.mvp.1`

---

## 8. Pricing adoption

- Item CRUD, document GST aggregate, create-from-estimate, recalibration (manual preserve)
- Authority switch: `PRICING_ITEM_CALCULATION_AUTHORITY` (default `authoritative`; retained for emergency rollback)

---

## 9. Estimate adoption

- Line factories, margin override, GST-exclusive aggregates
- Ranges remain expected × org factors; confidence remains non-money
- Authority switch: `ESTIMATE_CALCULATION_AUTHORITY` (retained)

---

## 10. Quote adoption

- Create/refresh snapshots via visible_only + document GST
- Draft item total resolution (CD-22 prefer-total)
- `reviseQuote` copies money; supersedes prior record
- Authority switch: `QUOTE_CALCULATION_AUTHORITY` (retained)

---

## 11. UI authority removal

- Boundary: `docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md`
- Presentation helpers for pricing edit preview, section totals, estimate breakdowns, view models
- Components do not call document/quote totals or legacy GP formulas

---

## 12. GST correction

- C-28 (hardcoded 15% overwrite on create-from-estimate) corrected in 2B.5
- Production uses document/org GST; default 15 only as unset fallback
- Pre-2B.5 anomalies not bulk-rewritten

---

## 13. Unknown-cost treatment

- Engine: sell-only / unknown cost → `cost_known=false`; profit/margin not fabricated as known
- Persistence sentinel: 0 for NOT NULL columns when unknown
- UI labels: “Profitability unavailable” / “Margin unavailable”
- **Limitation:** no persisted `cost_known` column (inferred at map/display time)

---

## 14. Manual override treatment

- Pricing recalibration preserves manual flags
- Quote CD-22: explicit line total preferred when supplied
- Overrides structured in engine metadata where request path supplies them

---

## 15. Historical snapshot protection

- Sent / accepted / superseded quotes are not recalculated on status transitions
- Revisions create new quote records and copy money
- Pricing recalibration does not update `quotes`
- Print/export uses stored snapshot values
- Verified in `scripts/verify-batch-2b10-final-commercial-authority.ts`

---

## 16. Security preservation

Stage 2A suites remain required and green:

- Auth/org, validation, pricing/quote actions, DB integrity, RLS coverage, tenant isolation

---

## 17. Legacy code removed (2B.10)

| Symbol | Reason |
| --- | --- |
| `lib/pricing/calculations.ts` `calculatePricingItemEdit` wrapper | Unused; preview uses `pricing-item-calculation` / presentation preview |
| `lib/estimate/presentation-breakdown.ts` `presentEstimateCategoryMargin` | Unused dead export |

---

## 18. Legacy code retained (intentional)

| Symbol / module | Reason |
| --- | --- |
| `calculateDocumentTotals`, `calculatePricingItemTotals` | Rollback + parity + verify |
| `pricing-item-calculation.calculatePricingItemEdit` | Preview shaping + totals-for-save chain |
| `calculateQuoteTotals`, `calculateQuoteItemTotal` | Rollback + parity |
| `recalculateSellFromCost`, `sumLineItemTotals` | Parity-only |
| `rates.deriveSellFromCost` | Rate resolution when sell missing |
| Three `*_CALCULATION_AUTHORITY` switches | Emergency rollback (prefer git revert) |
| `lib/commercial-engine/parity/**` | Comparison-only audit evidence |
| Historic parity report pre-2B.5 | Audit evidence |

---

## 19. Regression results

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass (run in 2B.10) |
| `npm run lint` | Pass (run in 2B.10) |
| `npm run build` | Pass (run in 2B.10) |
| 2A.1–2A.5 + RLS | Pass (run in 2B.10) |
| Golden 60/60 | Pass |
| Contract 37/37 | Pass |
| Shadow parity blockers | 0 |
| 2B.5–2B.9 adoption | Pass |
| 2B.10 final authority | Pass |

---

## 20. Accepted limitations

1. No DB `cost_known` column — inferred from 0 cost + sell > 0 sentinel.
2. Engine/formula version metadata not fully persisted on estimate/quote rows.
3. S1-010 pricing-all vs quote-visible UX warning deferred to Stage 6.
4. Optional AUD/NZD formatter consolidation deferred.
5. Authority switches retained temporarily (not UI-exposed).
6. Legacy pure helpers retained for parity/rollback.
7. Pre-2B.5 GST anomalies not bulk-rewritten.
8. Company DNA / learning not implemented (by design).

---

## 21. Future-learning compatibility

- Deterministic results are replayable via contract records and golden fixtures.
- Manual overrides are structured on engine requests where supplied.
- Source provenance retained in notes/metadata where schema allows.
- AI confidence remains separate from money.
- Company DNA may later recommend rates/margins but must not silently alter arithmetic without an explicit approved version bump.
- Missing persisted engine metadata and explicit cost-known storage are deferred to a separate architecture stage.
- No DNA tables or migrations created.

---

## 22. Final acceptance checklist

| # | Criterion | Result |
| ---: | --- | --- |
| 1 | One deterministic commercial engine exists | **Pass** |
| 2 | Estimate server money is authoritative | **Pass** |
| 3 | Pricing server money is authoritative | **Pass** |
| 4 | Quote server money is authoritative | **Pass** |
| 5 | UI is presentation-only | **Pass** |
| 6 | Golden scenarios pass | **Pass** |
| 7 | Contract replay passes | **Pass** |
| 8 | Shadow parity has no unresolved blocker | **Pass** |
| 9 | GST source is correct | **Pass** |
| 10 | Unknown-cost behaviour is honest | **Pass with accepted limitation** (no `cost_known` column) |
| 11 | Manual overrides are preserved | **Pass** |
| 12 | Historical quote snapshots are immutable | **Pass** |
| 13 | Stage 2A security remains intact | **Pass** |
| 14 | No production parity imports exist | **Pass** |
| 15 | No client-side financial authority remains | **Pass** |
| 16 | No formula duplication in authoritative production paths | **Pass** (legacy retained for rollback/parity only) |
| 17 | Rollback is documented | **Pass** |
| 18 | Accepted limitations are documented | **Pass** |
| 19 | No migrations/DB changes during Stage 2B adoption | **Pass** |
| 20 | Future Company DNA remains separated from arithmetic | **Pass** |

No unresolved Critical or High failures.

---

## 23. Final Stage 2B status

**Complete — Local**

- Deployment not yet completed
- Production smoke test still owner-gated
- No Stage 2C work started

---

## 24. Recommended next stage

Owner-gated: deploy Stage 2B using `docs/runbooks/STAGE_2B_DEPLOYMENT_AND_SMOKE_TEST.md`, complete production smoke, then begin the next authorised architecture stage only after explicit approval. Do not start Stage 2C from this batch.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2B_COMPLETION_REPORT.md` |
| Created | 2026-08-05 |
| Closing verify | `scripts/verify-batch-2b10-final-commercial-authority.ts` |
