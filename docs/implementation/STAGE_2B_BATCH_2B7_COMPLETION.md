# Stage 2B — Batch 2B.7 Completion Report

**Batch:** 2B.7 — Authoritative Commercial-Engine Adoption Across the Estimate Domain  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Live adoption:** Estimate-domain line money, margin override, and aggregates (GST-exclusive)

---

## 1. Objective

Adopt the commercial engine as the sole deterministic financial authority for estimate line cost/sell/profit/margin and estimate aggregates, while keeping AI/workflow scope, confidence, and range **drivers** outside arithmetic. Quotes, UI design, migrations, AI prompts, and Company DNA unchanged.

## 2. Estimate paths audited

| Cluster | Location | Responsibility |
| --- | --- | --- |
| Sell-from-margin | `lib/estimate/rates.ts` `deriveSellFromCost` | F-SFM formula (parity-retained pure); production margin via engine |
| Line factories | `lib/estimate/line-items.ts` | Domain shapes qty/hours; engine money |
| GP triad / ranges | `buildAmounts`, `commercial-realism` rebuild | Engine expected; org factors for low/high |
| Margin override | `margin-override.ts`, `assistant/margin-actions.ts` | Engine F-SFM + aggregate |
| Aggregates | `summary.ts` `sumLineItems` / `finalizeEstimateResult` | Engine document aggregate, no GST |
| Calculators | `lib/estimate/calculators/*` | Qty/rate/hours only (unchanged) |
| Orchestration | `calculate-estimate.ts`, `assistant/actions.ts` | Calls factories + finalize |
| Read mappers | `assistant/mappers.ts` | Persisted fields; no money rewrite |
| Estimate→pricing | `lib/pricing/estimate-to-pricing-adapter.ts` | Already engine (2B.6B); verified |
| UI breakdowns | category-breakdown / EstimateBreakdownModal | Deferred 2B.9 |

Stable legacy IDs: LEG-E-01, LEG-E-08, LEG-E-13, LEG-E-15, LEG-E-16, LEG-E-19, LEG-E-21, LEG-E-24.

## 3. Estimate commercial boundary

See `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`.

- AI/workflow: scope, qty suggestions, confidence, assumptions, input shaping.
- Engine: deterministic money and aggregates.
- Application: auth, ownership, persistence, mapping, rollback switch.

## 4. Paths adopted

- Quantity-rate lines (`createRateLineItem`)
- Productivity/labour lines (`createLabourLineItem`, `createFixedLabourLineItem`)
- Lump/allowance lines (`createAllowanceLineItem`)
- Profit triad + org range application (`buildAmounts` / `rebuildLineItemAmounts`)
- Target margin apply (`applyMarginToAmounts`, `applyTargetMarginToLineItems`)
- Estimate aggregate (`sumLineItems`, `finalizeEstimateResult`, `aggregateEstimateLineTotals`)
- Margin update action + regenerate-with-target-margin path

## 5. Paths deferred

| Path | Why |
| --- | --- |
| Pure `deriveSellFromCost` / `recalculateSellFromCost` / `sumLineItemTotals` | Retained as **parity comparison** formulas (same F-SFM math); production uses adapter |
| Calculator domain heuristics (waste tables, quality factors as qty shaping) | Not commercial arithmetic |
| Confidence heuristic | Metadata only |
| Low/high invention | Domain factors only; engine does not invent bands |
| Client/UI estimate recalculation | Batch 2B.9 |
| Quotes | Batch 2B.8 |
| Per-line sell override UI | Not present in current estimate product |
| Schema / `cost_known` column on estimates | No migration authorised |

## 6. Production adapter

`lib/estimate/estimate-commercial-engine-adapter.ts`

- Maps estimate inputs → `CommercialCalculationRequest`
- Modes: quantity_rate, productivity_labour (hours as calculated_quantity), lump_sum
- Aggregate without GST
- Unknown-cost → sentinel 0 via shared `persistCommercialMetric`
- No Supabase, no mutation, no parity imports
- Rollback: `lib/estimate/adoption-authority.ts` (`ESTIMATE_CALCULATION_AUTHORITY`)

## 7. Creation behaviour

1. Calculators produce qty/hours/rates (AI/workflow inputs).
2. Factories call engine for cost/sell/GP/margin.
3. Ranges = expected × org factors.
4. `finalizeEstimateResult` aggregates via engine.
5. Persist authoritative fields; retain rate provenance metadata in notes.

## 8. Edit / recalculation behaviour

- Target margin override re-runs F-SFM through engine per line, then authoritative aggregate.
- Quantity/rate/hours changes flow through factories/adapter on regenerate.
- Client/AI derived totals are not trusted as authority.
- Omitted vs null vs zero: see boundary doc.

## 9. Aggregation behaviour

- Filters `includedInTotal !== false`
- Aggregate GP/margin from totals (not average of line %)
- No GST
- Unknown-cost line → aggregate `costKnown=false`; profit/margin sentinel 0 (no fabrication)
- No NaN / divide-by-zero

## 10. Range treatment

- Expected: engine
- Low/high: domain factors on expected (defaults 0.9 / 1.15)
- Engine does not invent low/high
- Confidence is not a multiplier

## 11. Confidence treatment

Unchanged heuristic in `computeConfidence`; never multiplies money.

## 12. Unknown-cost treatment

Cost 0 + sell > 0 → engine unknown; persist GP/margin 0; aggregate marks cost unknown.

## 13. Manual override treatment

Target margin is an explicit commercial override applied via engine. AI does not silently restore overridden margin on regenerate when `target_margin_percent` is set (existing behaviour preserved, now engine-backed).

## 14. Estimate-to-pricing compatibility

Verified: conversion adapter uses rates for qty/labour; lump snapshot when needed; no double margin; pricing GST independent; source estimate not mutated (2B.6B behaviour retained).

## 15. Security preservation

Stage 2A auth, ownership, Zod validation unchanged. No persistence after auth/validation failure.

## 16. Historical protection

No bulk rewrite of existing estimates. New generates/edits write engine outputs. Existing rows unchanged until user regenerates or updates margin.

## 17. Rollback approach

`ESTIMATE_CALCULATION_AUTHORITY = "legacy"` or git revert 2B.7. Independent of pricing authority switch. No dual writes. Parity remains read-only.

## 18. Files changed

**Created**

- `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`
- `lib/estimate/adoption-authority.ts`
- `lib/estimate/estimate-commercial-engine-adapter.ts`
- `scripts/verify-batch-2b7-estimate-adoption.ts`
- `docs/implementation/STAGE_2B_BATCH_2B7_COMPLETION.md`

**Modified**

- `lib/estimate/line-items.ts`
- `lib/estimate/margin-override.ts`
- `lib/estimate/summary.ts`
- `lib/estimate/commercial-realism.ts`
- `lib/assistant/margin-actions.ts`
- `lib/assistant/actions.ts`
- `docs/audits/STAGE_2B_PRICING_ENGINE_AUDIT.md`
- `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md`
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`

## 19. Tests and results

`scripts/verify-batch-2b7-estimate-adoption.ts` — **38/38** (see suite run in batch verification).

Required regression (tsc, lint, build, 2A/2B scripts) recorded in verification run.

## 20. Remaining estimate-domain gaps

- UI/client estimate money display helpers (2B.9)
- Optional estimate `cost_known` persistence column (migration later)
- Pure rate-resolution `deriveSellFromCost` still local F-SFM (identical formula; parity needs pure export)
- Waste percent as explicit engine modifier when factories pass waste separately (today baked into qty)

## 21. Recommendation for Batch 2B.8

Adopt quote-domain aggregates and item totals through the commercial engine with **visible_only** inclusion, preserve revision immutability, and keep historical quote snapshots untouched.

---

## Future Learning Compatibility Check

1. AI suggestions separated from deterministic arithmetic? **Yes.**
2. Exact commercial inputs retained? **Yes** (qty, rates, hours, provenance in metadata).
3. Manual corrections identifiable? **Yes** (`target_margin_percent`, sellDerivedFromMargin).
4. Range and confidence distinct? **Yes.**
5. Estimate calculations replayable? **Yes** via engine contract when inputs retained.
6. Engine metadata not persisted? **Structured steps/hooks** — not fully persisted on estimate rows (same as pricing).
7. Future Company DNA inspect without altering arithmetic? **Yes** — boundary forbids DNA arithmetic.
8. Existing estimates protected from silent rewriting? **Yes.**
9. Customer receives more accurate/consistent estimates today? **Yes** — single money authority; honest unknown-cost.
