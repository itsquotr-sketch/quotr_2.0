# Stage 2B — Batch 2B.6A Completion Report

**Batch:** 2B.6A — Authoritative Engine Adoption for Pricing Item Mutations and Aggregation  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Live adoption:** Pricing item CRUD + document aggregate after those mutations  

---

## 1. Objective

Make the commercial engine authoritative for `addPricingItem`, `updatePricingItem`, `duplicatePricingItem`, and document aggregation after those mutations (including `deletePricingItem`), while preserving Stage 2A security, Batch 2B.5 GST rules, manual overrides, and historical records.

## 2. Actions adopted

- `addPricingItem`
- `updatePricingItem`
- `duplicatePricingItem`
- `deletePricingItem` (aggregation only; no line calculation)

Shared helper `recalculateAndPersistDocumentTotals` now uses authoritative aggregation when the 2B.6A authority switch is on (also affects post-mutation GST paths that share the helper).

## 3. Actions not adopted

- `createPricingFromEstimate` (line copy still legacy; aggregate helper may run after insert)
- `updatePricingDocument` field edits (GST recalc may use shared aggregate helper)
- `markPricingReviewed`
- Pricing read mappers
- Recalibration workflow
- Estimate / quote / UI calculations

## 4. Production adapter

`lib/pricing/commercial-engine-adapter.ts`

- Maps validated domain inputs → `CommercialCalculationRequest`
- Executes `executeCommercialCalculation` + `calculateLineItem` for full outputs
- Maps to existing pricing-item columns
- Does **not** import `lib/commercial-engine/parity/`

## 5. Persisted-field mapping

| Field | Classification |
| --- | --- |
| quantity, unit, unit_cost, unit_sell | Validated input / engine output |
| productivity_rate, productivity_unit, calculated_quantity | Validated input / engine output |
| total_cost, total_sell | **Authoritative engine output** (qty/productivity: client totals ignored) |
| gross_profit, margin_percent, markup_percent | **Authoritative**; unknown-cost → DB sentinel **0** (NOT NULL; not 100%) |
| calculation_mode | Preserved / inferred then engine mode |
| manually_edited | Validated user/workflow flag (update=true; duplicate not copied) |
| work_area_id, labels, notes, visibility | Validated user input |
| labour hours / rates | Via productivity fields (no separate DB labour columns) |
| material/subcontractor cost | Represented via item_type + cost fields (no separate columns) |
| Engine steps, warnings, learning hooks, cost_known | **Unpersisted** (documented; no migration) |

## 6. Add behaviour

Blank item calculated as known-zero `lump_sum` via engine; then authoritative document aggregate with stored GST.

## 7. Update behaviour

Full item recalculated from normalized inputs via engine. Stale client totals ignored for quantity/productivity modes. `manually_edited=true`. Omitted optional Zod fields are `undefined`; explicit `null` and `0` preserved on lump-sum cost.

## 8. Duplicate behaviour

Recalculates from source commercial inputs (not blind copy of derived totals). Source unchanged. `manually_edited` not copied (prior behaviour / DB default false); rates and mode remain inputs to the engine.

## 9. Delete / aggregate behaviour

Ownership → delete → authoritative aggregate of remaining lines with stored `gst_rate`. Empty document → zeros; no NaN margin; GST once; margin from aggregate totals.

## 10. Unknown-cost treatment

Engine returns null profit metrics; persistence uses **0** sentinel (DB NOT NULL). Aggregate treats `cost=0` + `sell>0` as unknown unless overridden.

## 11. Manual override treatment

Update always sets `manually_edited`. Adapter can attach `ManualOverrideCapture` for manual sell. Duplicate resets override flag.

## 12. GST treatment

Stored document GST via Batch 2B.5 helpers; applied once at document total; 0% preserved.

## 13. Security preservation

Auth → schema → ownership unchanged. Errors sanitized. Validation before mutation.

## 14. Partial-write assessment

Item write then aggregate update (same as before). Failed engine calc rejects before item persist. Aggregate failure after item write can leave item saved with stale document totals (pre-existing risk); no new dual-write of conflicting formulas.

## 15. Rollback approach

`lib/pricing/adoption-authority.ts` — `PRICING_ITEM_CALCULATION_AUTHORITY` default `"authoritative"`; set `"legacy"` to restore prior helpers, or `git revert` the 2B.6A commit. No public UI flag. No dual authority writes.

## 16. Files changed

### Created

- `lib/pricing/adoption-authority.ts`
- `lib/pricing/commercial-engine-adapter.ts`
- `lib/pricing/authoritative-document-totals.ts`
- `scripts/verify-batch-2b6a-pricing-item-adoption.ts`
- `docs/implementation/STAGE_2B_BATCH_2B6A_COMPLETION.md`

### Modified

- `lib/pricing/actions.ts`
- `lib/pricing/action-guards.ts`
- `lib/commercial-engine/index.ts` (caller note)
- `docs/specifications/PRICING_ACTION_ADOPTION_GATE.md`
- `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`

## 17. Tests and results

See commands in § regression — all required suites pass; 2B.6A focused script **35/35**.

## 18. Parity result

Shadow parity remains green; **0** adoption blockers; sell-only remains `APPROVED_ENGINE_CORRECTION`.

## 19. Known limitations

- `cost_known` / engine steps / warnings not persisted (no migration).
- Unknown margin stored as 0 until schema allows null.
- Shared aggregate helper also used by create/GST-update paths.
- Recalibration / create line build still legacy.

## 20. Recommendation for 2B.6B

Adopt `createPricingFromEstimate` line mapping + `updatePricingDocument` explicitly; then recalibration; keep quotes/estimates later. Persist `cost_known` only with an authorised migration.

---

## Future Learning Compatibility Check

1. Commercial inputs preserved on item rows (qty/rates/mode/lump totals).  
2. Manual overrides identifiable via `manually_edited` (+ unpersisted override captures on calc record).  
3. Unknown values honest in engine; DB sentinel 0 for null metrics.  
4. Replay possible from persisted inputs for qty/productivity/lump; richer steps not stored.  
5. Unpersisted: steps, warnings, learning hooks, `cost_known`, explanation keys.  
6. Company DNA cannot alter arithmetic.  
7. Historical records untouched (no bulk recalc).  
8. Customers get consistent item/document totals on adopted paths.

**Stop:** Do not begin 2B.6B in this change set.
