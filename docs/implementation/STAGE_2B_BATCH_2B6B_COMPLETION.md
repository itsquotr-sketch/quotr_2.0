# Stage 2B — Batch 2B.6B Completion Report

**Batch:** 2B.6B — Complete Authoritative Commercial-Engine Adoption Across the Pricing Domain  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Live adoption:** Pricing-domain mutations + recalibration + create-from-estimate  

---

## 1. Objective

Make the commercial engine the sole persisted financial authority across remaining pricing-domain paths after Batch 2B.6A item CRUD, without adopting estimates, quotes, UI, or schema changes.

## 2. Paths adopted

- `updatePricingDocument` (GST aggregate via authoritative helper; metadata-only otherwise)
- `createPricingFromEstimate` (per-line engine mapping + authoritative document aggregate)
- Pricing recalibration apply (`applyRecalibration`) — non-manual items via estimate→engine adapter; aggregate authoritative
- Pricing read mappers — return persisted totals; derive `cost_known` without recalculating money
- Shared document total persistence used by pricing mutations/recalibration

## 3. Paths deferred / not applicable

| Path | Status | Why |
| --- | --- | --- |
| Estimate generation / estimate line arithmetic | Not adopted | Out of pricing domain (2B.7) |
| Quote arithmetic / revisions | Not adopted | 2B.8 |
| Client/UI calculations (`PricingItemEditForm`, section rollups) | Not adopted | 2B.9 |
| `markPricingReviewed` engine wiring | Not applicable | Status-only; no arithmetic |
| DB `cost_known` column | Deferred | No migration authorised; sentinel rule retained |

## 4. updatePricingDocument behaviour

Schema allows metadata + optional `gst_rate` only — **no document-level margin field**. Product intent preserved: GST-only updates recalculate document GST amount / inclusive total from stored item excl-GST totals; line cost/sell unchanged. Aggregate uses authoritative helper when authority switch is on. Manual item overrides unaffected.

## 5. createPricingFromEstimate behaviour

1. Auth + ownership  
2. Map **all** estimate lines through `valuesFromEstimateLineItem` → engine **before** any insert  
3. Blocking map errors abort with no document created  
4. Insert document with authoritative aggregate (not estimate GP triad snapshot)  
5. Insert items with engine money fields + `source_estimate_line_item_id`  
6. Compensating delete of document if item insert fails  
7. Idempotent authoritative recalc  
8. Source estimate untouched  

Qty/productivity lines with rates ignore stale recommended totals; lump / missing-rate lines use recommended cost/sell as approved lump snapshot inputs. Unknown-cost (0 cost, positive sell) persists sentinel 0 margin with `cost_known=false` on read.

## 6. Recalibration decision

**Adopted.** Semantics clear: preserve `manually_edited`; rebuild non-manual from estimate via engine; orphan notes; stored GST; authoritative aggregate. Preview uses same mapping. No automatic rewrite of documents that are not explicitly recalibrated by the user.

## 7. Reviewed / read path treatment

- `markPricingReviewed`: status/timestamp only — no legacy or engine recalc.  
- `mapPricingDocument` / `mapPricingItem`: return stored fields; add derived `cost_known`; do not recompute aggregates.

## 8. Legacy functions removed

**None.** Unused-import check showed `calculateDocumentTotals` / `calculatePricingItemTotals` / `calculatePricingItemEdit` still required by UI, quotes, parity comparison, 2A/2B verification scripts, and the legacy rollback branch.

## 9. Legacy functions retained and why

| Helper | Why retained |
| --- | --- |
| `calculateDocumentTotals` | UI section display, quotes, parity, rollback |
| `calculatePricingItemEdit` / `TotalsForSave` | Pricing UI live edit (2B.9), rollback |
| `buildPricingItemFieldsFromEstimateLineItem` | Mode/rate extraction input to engine adapter |
| Parity legacy wrappers | Comparison-only |

## 10. Unknown-cost sentinel treatment

Engine null → persist 0 (NOT NULL columns). Read mapper sets `cost_known=false` when cost=0 and sell>0 so consumers must not treat stored 0% as real margin. Paths using sentinel: item CRUD (2B.6A), create-from-estimate, recalibration, aggregate inference, read mapper.

## 11. Manual override treatment

Update item: `manually_edited=true`. Recalibration: manually edited items skip money rebuild. Duplicate (2B.6A): flag not copied. Document GST update does not clear item overrides.

## 12. GST treatment

Org → document on create (2B.5); stored document GST for all recalcs; applied once; 0% preserved; no hardcoded 15 in adopted paths.

## 13. Historical-record protection

No bulk recalc. Existing docs unchanged until user mutates/recalibrates. Quotes immutable. Estimates not mutated.

## 14. Security preservation

Stage 2A auth, ownership, Zod, sanitized errors unchanged.

## 15. Partial-write / cleanup

Create: map-all-first; document deleted if item insert fails. Recalibration: item updates then aggregate (pre-existing ordering).

## 16. Rollback approach

`PRICING_ITEM_CALCULATION_AUTHORITY = "legacy"` in `lib/pricing/adoption-authority.ts`, or git revert 2B.6A/2B.6B commits. No dual writes.

## 17. Files changed

### Created
- `lib/pricing/estimate-to-pricing-adapter.ts`
- `scripts/verify-batch-2b6b-complete-pricing-adoption.ts`
- `docs/implementation/STAGE_2B_BATCH_2B6B_COMPLETION.md`

### Modified
- `lib/pricing/actions.ts` (create + comments)
- `lib/pricing/recalibration.ts`, `recalibration-helpers.ts`
- `lib/pricing/mappers.ts`, `types.ts`, `adoption-authority.ts`
- Gate, matrix, audit, plan, MVP guide

## 18. Tests and results

Required suites pass including `verify-batch-2b6b-complete-pricing-adoption.ts` (27/27). Golden 60/60; contract 37/37; parity 0 blockers.

## 19. Remaining pricing-domain gaps

- UI still calculates live previews (2B.9)
- No persisted `cost_known` / engine steps
- Quote path still separate (2B.8)
- Estimate generation still legacy (2B.7)

## 20. Recommendation for next batch

**2B.7 Estimate adoption** (or **2B.9 UI** if product prioritises display honesty for unknown-cost). Optional narrow migration for `cost_known` only if authorised separately.

---

## Future Learning Compatibility Check

1. Yes — `source_estimate_line_item_id` + mapped inputs.  
2. Yes — `manually_edited` preserved on recalibration.  
3. Yes — engine honesty + `cost_known` on read.  
4. Partially — qty/rates/lump totals replayable; steps/warnings unpersisted.  
5. Unpersisted: steps, warnings, learning hooks, explicit cost_known column.  
6. Yes — DNA cannot alter arithmetic.  
7. Yes — estimates/quotes untouched.  
8. Yes — create/recal/GST paths now consistent with item CRUD.

**Stop:** Do not begin estimate/quote/UI/DNA/schema work in this change set.
