# Stage 2B — Batch 2B.5 Completion Report

**Batch:** 2B.5 — Pricing Adoption Gate and C-28 GST Defect Correction  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Commercial engine:** Non-authoritative (not wired to live actions)  

---

## 1. Objective

Correct the confirmed live GST-source defect (C-28 / CD-09 / LEG-P-05) in the existing pricing workflow, establish an explicit pricing-document GST source rule, add focused regression coverage, clear C-28 as an adoption blocker, and publish the formal pricing-action adoption gate for Batch 2B.6 — without adopting the commercial engine.

## 2. Confirmed defect

In `createPricingFromEstimate`:

1. Organisation GST rate was loaded and written to `pricing_documents.gst_rate`.
2. Initial insert totals used that organisation rate.
3. Post-item `recalculateAndPersistDocumentTotals(..., DEFAULT_GST_RATE, …)` hardcoded **15**.
4. When organisation GST ≠ 15, stored `gst_rate` disagreed with `gst_amount` / `total_incl_gst`.

## 3. Root cause

Hardcoded `DEFAULT_GST_RATE` argument on the post-insert recalculation call, ignoring the validated organisation rate already used for insert.

## 4. GST source rule

| Moment | Source |
| --- | --- |
| Creation | Organisation settings; application default 15% only if unset (nullish) |
| Ongoing | Stored `pricing_documents.gst_rate` (0% valid) |
| User update | Validated pricing-document GST mutation |
| Recalculation | Stored document GST (or mutation in the same operation) |
| Quote creation | Pricing snapshot GST — quote logic unchanged in this batch |

Implemented in `lib/pricing/gst-source.ts` (pure helpers; no global GST service).

## 5. Code correction

- `createPricingFromEstimate` now resolves GST via `resolveCreatePricingFromEstimateGstRates` and passes **`createGst.recalculationGstRate`** (same as document rate) into post-item recalc.
- Item add/update/duplicate/delete recalcs use `resolveStoredPricingDocumentGstRate(coercePersistedGstRate(...))` so **0% is not falsy-fallen back**.
- `updatePricingDocument` uses `resolvePricingGstForUpdate`.
- Recalibration aggregate recalc uses stored document GST via the same helper.
- No commercial-engine imports in pricing actions.

## 6. Pricing paths audited

| Path | GST behaviour after 2B.5 |
| --- | --- |
| createPricingFromEstimate | Org → document; same rate for insert + post-item recalc |
| updatePricingDocument | Mutation or stored; recalc with that rate |
| updatePricingItem | Stored document GST |
| addPricingItem | Stored document GST |
| duplicatePricingItem | Stored document GST |
| deletePricingItem | Stored document GST |
| markPricingReviewed | No recalculation |
| recalibration apply | Stored document GST |
| Pricing reads / mappers | Return stored fields; mapper nullish default 15 only if column null |
| Quote from pricing | Unchanged in this batch |
| Legitimate DEFAULT_GST_RATE | Org/settings missing rate; null document rate fallback; NZ default constant |

## 7. Historical protection

- No bulk update of existing `pricing_documents`.
- Existing documents retain stored `gst_rate`; future recalcs use that stored rate.
- Anomalous pre-2B.5 GST amounts (if any) are **not** silently rewritten.
- Sent/accepted quotes remain immutable.
- Historic C-28 anomalies require deliberate review, not automatic correction.
- 2B.4 parity reports archived as `*_HISTORIC_PRE_2B5.*` before regeneration.

## 8. Verification results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass (expected) |
| `npm run lint` | Pass (expected) |
| `npm run build` | Pass (expected) |
| `npx tsx scripts/verify-batch-2b3b-golden-commercial-engine.ts` | 60/60 |
| `npx tsx scripts/verify-batch-2b3c-engine-contract.ts` | 37/37 |
| `npx tsx scripts/verify-batch-2b4-shadow-parity.ts` | Pass; C-28 EXACT_MATCH; 0 adoption blockers |
| `npx tsx scripts/verify-batch-2b5-gst-source-and-adoption-gate.ts` | Pass |

## 9. Parity result before and after

| | Before (2B.4 historic) | After (2B.5) |
| --- | --- | --- |
| PAR-P-GST-BUG-C28 | BLOCKING_ADOPTION_MISMATCH | EXACT_MATCH |
| Adoption blockers | 1 | 0 |
| Exact matches | 13 | 14 |
| Evidence | `STAGE_2B_BATCH_2B4_PARITY_REPORT_HISTORIC_PRE_2B5.md` | Regenerated `STAGE_2B_BATCH_2B4_PARITY_REPORT.md` |

Historic bug reproduction retained in `legacyCreatePricingFromEstimateGstBug` for notes/evidence.

## 10. Adoption blocker status

- **C-28 / KM-GST-C28:** no longer blocks adoption (`blocksAdoption: false`).
- Remaining adoption themes (non-blocking for GST): sell-only unknown-cost mapping, engine wiring, estimate/quote batches later.

## 11. Adoption gate summary

`docs/specifications/PRICING_ACTION_ADOPTION_GATE.md` lists every pricing action with readiness. Pricing CRUD + create + reads are **ready for 2B.6** subject to engine wiring; recalibration is conditional after CRUD. **No action was adopted in 2B.5.**

## 12. Files changed

### Created

- `lib/pricing/gst-source.ts`
- `scripts/verify-batch-2b5-gst-source-and-adoption-gate.ts`
- `docs/specifications/PRICING_ACTION_ADOPTION_GATE.md`
- `docs/implementation/STAGE_2B_BATCH_2B5_COMPLETION.md`
- `docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT_HISTORIC_PRE_2B5.md`
- `docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT_HISTORIC_PRE_2B5.json`

### Modified

- `lib/pricing/actions.ts`
- `lib/pricing/recalibration.ts`
- `lib/commercial-engine/parity/fixtures.ts`
- `lib/commercial-engine/parity/known-mismatches.ts`
- `lib/commercial-engine/parity/legacy/legacy-pricing-document.ts`
- `lib/commercial-engine/parity/registry.ts`
- `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`
- `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`
- Regenerated parity reports under `docs/implementation/`

## 13. Commands run

See §8.

## 14. Remaining risks

- Pre-2B.5 pricing documents may still have GST amount/rate disagreement until manually reviewed.
- Sell-only fabricated margins remain in live legacy until 2B.6 mapping.
- Mapper / settings layers still use `?? 15` for **null** columns (correct); must never switch to truthy `|| 15`.

## 15. Confirmation — commercial engine remains non-authoritative

Pricing/estimate/quote actions do not import or call `lib/commercial-engine` for live totals. Engine remains comparison/golden/contract only.

## 16. Recommendation for Batch 2B.6

Proceed with pricing-action adoption in the documented order (read helpers → item CRUD → document update → createPricingFromEstimate → reviewed/reads → remove unused legacy formulas only after parity). Do not bulk-rewrite history. Keep feature-flag or commit-level rollback per action.

---

**Stop:** Batch 2B.5 complete. Do not begin 2B.6 in this change set.
