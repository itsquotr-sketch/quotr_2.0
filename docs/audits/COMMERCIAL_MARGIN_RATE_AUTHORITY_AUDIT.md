# Commercial Margin / Rate Authority Audit

**Classification:** HISTORICAL — P0 implemented. **CANONICAL commercial model:** `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`.  
**Status:** Complete — Audit / Specification only (2026-08-13)  
**Checkpoint:** Post Stage 3.2.2-R5 / before Stage 3.2.3  
**Branch baseline:** `hardening/stage-2a-security` (`d84de4d` R5)  
**Scope:** Trace actual repository commercial authority. **No formula or feature changes in this pass.**

**Companions:**
- Cost-first model: `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`
- Materials takeoff audit: `docs/audits/MATERIAL_PRICING_TAKEOFF_CURRENT_STATE_AUDIT.md`
- Plan: `docs/plans/POST_3_2_2_COMMERCIAL_MATERIALS_PLAN.md`
- Binding engine contract: `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md`
- Estimate boundary: `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md`
- Rate provenance: `docs/architecture/QUOTR_RATE_AUTHORITY_AND_PROVENANCE_MODEL.md`

---

## 1. Executive verdict

Quotr’s **engine sell formula is gross-margin correct**:

`sell = round2(cost / (1 − gross_margin/100))` (F-SFM)

Production estimate factories pass **both** unit cost and unit sell into the commercial engine. When sell is present, the engine **does not** apply F-SFM again. Project `target_margin` **replaces** line sells from cost (replace, not stack).

Therefore Quotr is **not** doing the naive double-count:

> charge-out (already margined) → treated as cost → project margin applied again

**However**, commercial uplift is **dual-authority** today:

1. **Unit sell / charge-out / benchmark sell pairs** often already embed margin (or a different implied GM than org default).
2. **Org `default_margin_percent` (20%)** and **`target_margin_percent`** re-derive sell from **cost** when applied.

Without `target_margin`, generation uses pre-baked unit sells. With `target_margin` (or regenerate after margin edit), sell is rewritten from cost at the selected GM — **wiping** explicit charge-out premiums.

**Demo blocker?** **No** for the classic double-margin stacking bug.  
**Commercial correctness (P0 planning):** **Yes** — dual sell authorities + margin-edit → Pricing/Quote sync gap.

---

## 2. Commercial authority map

```
Rates UI / org settings
  → public.rates (cost_rate, sell_rate, markup_percent*)
  → organisation_settings.default_margin_percent (GM; app default 20)
  → resolveLabourRate / resolveRate (+ calculator benchmarks)
  → createLabourLineItem / createRateLineItem / createAllowanceLineItem
  → commercial engine (hours×rates or qty×rates; F-SFM only if unit_sell missing)
  → finalizeEstimateResult → aggregateEstimateLines
  → [optional] applyTargetMarginToLineItems (F-SFM on recommended_cost)
  → persistEstimateResult  (+ markPricingDocumentsNeedingRecalibration)
  → Pricing adapter (qty×rates or lump snapshot)
  → Quote (total_sell + GST once; no second margin)

* rates.markup_percent is persisted/UI-capable but NOT read by estimate resolvers.
```

| Layer | Authority | Money role |
| --- | --- | --- |
| Commercial engine | `deriveSellFromCost`, `deriveProfitMetrics`, line/aggregate | Expected cost/sell/GP/GM/markup |
| Rate resolution | `resolveLabourRate`, `resolveRate` | Unit cost + unit sell |
| Domain calculators | `lib/estimate/calculators/*` | Hours, qty, rate keys / benchmarks |
| Estimate factories | `createLabourLineItem`, `createRateLineItem`, `createAllowanceLineItem` | Line money via engine |
| Margin override | `applyMarginToAmounts` → `applyAuthoritativeMarginToAmounts` | Re-derive sell from **cost** |
| Pricing / quote | adapters + GST | Consume priced sell; no second margin |

---

## 3. Rate source matrix

| SOURCE | Stored / constant | Semantic | Consumer | COST or SELL | Further uplift? |
| --- | --- | --- | --- | --- | --- |
| Company labour | `rates.cost_rate` / `sell_rate` | Business cost / charge-out | `resolveLabourRate` | Both | Engine: no if sell present. `target_margin`: **replaces** sell from cost |
| Company material | same | Unit cost / charge | `resolveRate` | Both | Same |
| Blank sell + cost | derive via `default_margin_percent` | Org GM baked into unit sell | resolvers | SELL derived | Then treated as final unit sell unless target_margin |
| Hardcoded labour default | `DEFAULT_LABOUR_COST_RATE=60`, `SELL=90` | Fallback (~33% GM) | `resolveLabourRate` | Both | Same |
| Benchmarks | `{cost, sell}` pairs | Curated cost & sell | calculator fallbacks | Both | Same; sell usually **not** re-derived from org 20% |
| Subcontractor lines | allowance / rate factories | Trade package money | bathroom/kitchen/fitout/etc. | Both from rates/benchmarks | Same pattern |
| Project override | Pricing item edits | Explicit project money | Pricing domain | User-set | Quote copies `total_sell` |
| `rates.markup_percent` | DB + some setup fields | Intended markup | **No estimate consumer** | — | Never applied |
| Face board labour (Deck) | literals `35` / `55` | Hardcoded cost/sell | `deck.ts` allowance | Both hardcoded | Quality factor may scale; not org labour rates |

---

## 4. Explicit answers (A1–A14)

### A1 — Canonical “cost” today
Business cost to deliver: unit `cost_rate` / hourly labour cost → line `recommended_cost` → estimate `recommended_cost`. Not charge-out.

### A2 — Canonical “margin”
**Gross margin** = GP ÷ sell. Validated in `lib/security/margin-validation.ts`. Org `default_margin_percent`; estimate `margin_percent` / `target_margin_percent`. Markup is a **derived display metric** (GP ÷ cost), not the sell driver.

### A3 — Gross margin or markup?
**Gross margin** for sell-from-cost (F-SFM). Markup computed after (`deriveProfitMetrics` / triad).

### A4 — Is `sell = cost / (1 − gm)` consistent?
**Yes for F-SFM paths** (engine + `lib/estimate/rates.deriveSellFromCost` + margin override).  
**No as the only sell source:** explicit `sell_rate`, benchmark sell pairs, labour defaults 60/90 often set sell without equaling org default GM.

### A5 — Any `sell = cost × (1 + margin)`?
**No** production margin path found. `(1 + x%)` appears for **waste** only. Markup % is output, not sell input.

### A6 — Labour charge-out already uplifted before project margin?
**Yes.** `resolveLabourRate` returns `sellRate` (stored, margin-derived, or 90). Line sell = hours × that sell. Project `target_margin` later **recomputes sell from cost** (replace, not stack). Generation without `target_margin` has **no second project margin layer**.

### A7 — Benchmarks COST or SELL?
**Both** — paired `{ cost, sell }` in `benchmark-rates.ts` / catalogue defaults.

### A8 — Materials COST or SELL?
**Both** via `cost_rate`/`sell_rate` or benchmark pairs; blank sell → derive from cost + org GM.

### A9 — Subcontractors COST or SELL?
Estimate lines carry both (allowance/rate factories). Schema allows `rate_type=subcontractor`. Subbie money in practice = calculator allowances with cost+sell from rates/benchmarks.

### A10 — Can uplift be double-counted?
- **No stacked F-SFM** when engine receives both unit cost and unit sell (estimate factories pass both).
- **Replace semantics** for `target_margin` (overwrite, not stack).
- **Commercial ambiguity (not classic double-count):** rate/benchmark sell uplift vs org GM can disagree (e.g. labour 60→90 ≈ 33% GM vs product 20%).

### A11 — Can uplift be omitted?
- Explicit sell = cost → no uplift unless `target_margin` applied.
- `rates.markup_percent` / `default_markup_percent` never applied.
- Contingency percent not applied as automatic estimate uplift in the traced path.
- With `allow_benchmark_rates=false`, resolvers may still inject fallback money while labelling `missing`.

### A12 — Does changing project margin reconcile cost / sell / GP / range / pricing / quote?
**Partial.** `updateEstimateMargin` updates estimate lines + header sell/GP/margin/ranges (cost expected unchanged). **Does not** call `markPricingDocumentsNeedingRecalibration` (only `persistEstimateResult` does). Pricing/quote can stay stale until regenerate/recalibrate/refresh quote.

### A13 — Do QE / Pricing / Quote use the same commercial authority?
**Shared commercial engine formulas**, different lifecycle snapshots: QE = estimate totals; Pricing may recompute from rates or snapshot lumps; Quote = pricing `total_sell` + GST. Same arithmetic family; **not one live shared state** after margin edit.

### A14 — Ambiguous fields (consumers, not names alone)

| Field | Sounds like | Actually |
| --- | --- | --- |
| `margin_percent` / `default_margin_percent` | Could be markup | **Gross margin** |
| `markup_percent` (rates) | Drives sell | Stored only; **unused** by calculators |
| `default_markup_percent` | Org markup default | **Dead** (SQL only; no TS consumers) |
| `sell_rate` / UI “Charge rate” | Sell after project margin | **Unit charge-out**; may already include margin |
| `recommended_sell` | Always org GM | From line sells or target-margin rewrite |
| `prefer_user_rates` | Affects resolution | **Dead** for resolution |
| `cost_rate_low/high` on `rates` | Range inputs | **Unused**; ranges from org factors on totals |
| `target_margin_percent` | Soft target | Hard rewrite of all line sells from cost |

---

## 5. Findings (severity)

| ID | Severity | Finding | Demo blocker? |
| --- | --- | --- | --- |
| CM-01 | **High — Commercial correctness** | Dual sell authorities: charge-out/benchmark sell ≠ org GM; default labour 60/90 (~33% GM) vs product 20% | **No** (demo) |
| CM-02 | **High — Commercial correctness** | Margin edit did not invalidate/sync Pricing/Quote (`margin-actions.ts` vs `persist-estimate.ts`) — **FIXED in COMMERCIAL-P0** (`markPricingDocumentsNeedingRecalibration`) | Was conditional demo risk; remediated |
| CM-03 | Medium | **Labour benchmark-disabled fallback source-label mismatch.** `allow_benchmark_rates=false` + no company labour rate still injects $60/$90 while `sourceType` may be `missing`. Money is deliberate legacy fallback; label is misleading. Do not remove 60/90 silently. **Backlog / Not Started.** | No |
| CM-04 | Medium | Legacy `rates.markup_percent` / `default_markup_percent` noise | No |
| CM-05 | Medium | DB rate range columns unused; ranges from org factors only | No |
| CM-06 | Medium | Work-area rate fallback can cross-bind unrelated material rows | No |
| CM-07 | Medium | `target_margin` on regenerate wipes explicit charge-out premiums | No (intended replace; product ambiguity) |
| CM-08 | Low | Two `deriveSellFromCost` implementations (same formula) | No |
| CM-09 | Low | `resolveMaterialRate` not on main calculator path | No |
| CM-10 | Low | Dead `prefer_user_rates` still exposed in settings | No |
| CM-11 | Medium (materials) | Deck face labour hardcodes 35/55 (bypasses labour rates; embeds sell) | No |

---

## 6. Do tests prove single-consume margin?

**Partially — conversion layers only.**

| Proof | Suite | Shows |
| --- | --- | --- |
| F-SFM 20% → 1250 from 1000 | `verify-batch-2b10-final-commercial-authority.ts` | Formula |
| Estimate→pricing no second margin | `verify-batch-2b7-estimate-adoption.ts`, 2B.10 | Adapter |
| Quote from pricing sell + GST once | 2B.10 | No margin on quote |
| Optimistic triad matches F-SFM | `verify-stage-3-2-2-r2-ux-margin-responsiveness.ts` | UI pending |

**Not proven:**
1. Generation never applies org GM twice across all line types (architectural intent + factories pass both rates; not an end-to-end golden).
2. Labour/benchmark embedded sell consistency with org default GM.
3. Margin edit → pricing/quote reconciliation.
4. `rates.markup_percent` never affecting money (absence of consumer, not a dedicated test).

**Verdict:** Engine boundary avoids stacking F-SFM when both cost and sell are present; project margin **replaces** sell from cost. “Single-consume margin” is **architecturally intended** at the engine boundary, but **commercially ambiguous** because uplift often already lives inside unit sell/benchmarks, and margin edits stop at the estimate snapshot.

---

## 7. Key evidence paths

| Concern | Path |
| --- | --- |
| F-SFM | `lib/commercial-engine/core/sell-from-margin.ts` |
| Engine labour (sell only if null) | `lib/commercial-engine/calculations/productivity-labour.ts` |
| Rate resolve + labour defaults | `lib/estimate/rates.ts` |
| Margin override / target | `lib/estimate/margin-override.ts` |
| Margin action (no pricing invalidate) | `lib/assistant/margin-actions.ts` |
| Regenerate + target margin | `lib/assistant/actions.ts` |
| Persist + pricing stale | `lib/estimate/persist-estimate.ts` |
| Estimate boundary | `docs/specifications/ESTIMATE_COMMERCIAL_BOUNDARY.md` |

---

## 8. Status map (unchanged by this audit)

| Item | Status |
| --- | --- |
| Stage 3.2.2-R5 | Complete Local / Owner Demo Preview Pending |
| Stage 3.2.3 | Not Started |
| Production Scope Discovery | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
