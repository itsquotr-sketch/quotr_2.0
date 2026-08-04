# Stage 2B — Batch 2B.4 Completion Report

**Batch:** 2B.4 — Legacy Calculation Mapping and Shadow Parity Harness  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Live adoption:** None — commercial engine remains non-authoritative  

---

## 1. Objective

Map every confirmed legacy financial implementation, adapt inputs into the commercial-engine contract, run side-by-side comparison-only calculators, and classify every difference against owner decisions and golden truth — without changing any live or persisted result.

## 2. Legacy implementations mapped

**25** stable LEG-* IDs aligned to audit C-01…C-42 (see `parity/registry.ts` and compatibility matrix).

## 3. Adapters created

Pure adapters in `lib/commercial-engine/parity/`:

- pricing item → `CommercialCalculationRequest`
- pricing document → aggregate request (`all`)
- estimate sell-from-margin → line request
- quote document → aggregate request (`visible_only`)

No Supabase, no mutations, no server actions.

## 4. Comparison calculators created

Under `lib/commercial-engine/parity/legacy/` (deprecated / comparison-only):

- `legacy-pricing-item.ts` — reuses `calculatePricingItemTotals`
- `legacy-pricing-document.ts` — reuses `calculateDocumentTotals` + C-28 bug reproduction
- `legacy-estimate.ts` — reuses `deriveSellFromCost` / margin-override sums
- `legacy-quote.ts` — reuses quote totals/item total
- `legacy-client-calculations.ts` — client triad + unrounded margin

Not exported from `lib/commercial-engine/index.ts`.

## 5. Parity fixtures

**19** fixtures covering pricing items (qty/productivity/lump/sell-only/zero/manual sell), documents (mixed margin, GST 0%, C-28), estimates (SFM, aggregate), quotes (visible GST, prefer-total), pricing/quote divergence, client display.

## 6. Exact matches

**13**

## 7. Rounding / input-normalisation matches

**0** in this run (legacy and engine 2dp already aligned on covered paths)

## 8. Approved engine corrections

**1** — sell-only unknown-cost (legacy 100% margin vs engine null) — KM-SELL-ONLY-MARGIN

## 9. Legacy inconsistencies

Documented theme KM-GP-DUPLICATION (≥10 GP triad copies). Not a per-fixture failure when outputs match.

## 10. Adoption blockers

**0** after Batch **2B.5** (C-28 corrected). Historic 2B.4 run had **1** — KM-GST-C28 / LEG-P-05 (see `STAGE_2B_BATCH_2B4_PARITY_REPORT_HISTORIC_PRE_2B5.md`).

## 11. Known GST defect treatment

Captured in 2B.4 as `BLOCKING_ADOPTION_MISMATCH` with fixture `PAR-P-GST-BUG-C28`. **Fixed in Batch 2B.5** (live path + parity now EXACT_MATCH). Engine compared using organisation/document rate (commercially correct).

## 12. Historical snapshot treatment

Quotes must remain immutable; prior pricing GST anomalies under C-28 must not be silently rewritten; sell-only fabricated margins may exist in history.

## 13. Files changed

### Created

- `lib/commercial-engine/parity/**`
- `scripts/verify-batch-2b4-shadow-parity.ts`
- `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`
- `docs/implementation/STAGE_2B_BATCH_2B4_COMPLETION.md`
- `docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT.md` (generated)
- `docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT.json` (generated)

### Modified

- `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`

## 14. Commands and results

```
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/verify-batch-2b3b-golden-commercial-engine.ts   → 60/60
npx tsx scripts/verify-batch-2b3c-engine-contract.ts             → 37/37
npx tsx scripts/verify-batch-2b4-shadow-parity.ts                → pass (1 registered blocker)
```

## 15. Remaining risks

- C-28 still live until 2B.6
- Quote prefer-total policy undecided for engine
- Domain calculators (LEG-E-19) not line-by-line parity yet
- Client still duplicates money display

## 16. Future-learning compatibility

Parity is engineering evidence only; mismatches are not DNA signals; goldens stay independent; DNA must not alter arithmetic.

## 17. Confirmation no live adoption

No production call site imports `parity/`. Engine not used by pricing/estimate/quote actions. No migrations/UI/AI changes.

## 18. Recommended next batch

**Batch 2B.5** only if further shadow depth is required; otherwise proceed to **Batch 2B.6 pricing-action adoption** after fixing C-28 and satisfying adoption gates in the compatibility matrix. Do not adopt while KM-GST-C28 remains open.

---

## Future Learning Compatibility Check

1. Customer trust — improved by classifying defects before adoption.  
2. Explainable — every result has classification + authority.  
3. Replayable — engine side still replayable (2B.3C).  
4. Manual changes — preserved as evidence hooks later; not in this batch.  
5. Unknown values — engine honest; legacy fabrication documented.  
6. DNA review without controlling arithmetic — yes.  
7. Historical records protected — yes (documented).  
8. Independent of AI/persistence — yes.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2B_BATCH_2B4_COMPLETION.md` |
| Live adoption | **None** |
