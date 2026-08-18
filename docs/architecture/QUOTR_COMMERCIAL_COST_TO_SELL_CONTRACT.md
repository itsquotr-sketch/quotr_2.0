# Quotr Commercial Cost-to-Sell Contract

**Classification:** CANONICAL — how COST becomes SELL  
**Status:** COMPLETE / COMMERCIAL CONTRACT VALIDATED  
**Date:** 2026-08-19  
**HEAD:** RECOVERY-1-R1 (Owner C1/C2/C3 applied)  
**Companions (do not compete):**
- Cost-first model: `docs/architecture/QUOTR_COST_FIRST_COMMERCIAL_MODEL.md`
- Component money source: `docs/architecture/QUOTR_COMPONENT_COMMERCIAL_AUTHORITY_CONTRACT.md`
- Engine math: `lib/commercial-engine/core/cost-first-authority.ts`

This file is the **sell-authority SoT**. Component *which line is active* stays in the component-authority contract. Rate *identity* stays in `lib/estimate/rates.ts`.

---

## 1. Chain

```
physical quantity
  → rate resolution (item_key / company / benchmark)
  → component commercial authority (which line is active money)
  → active COST line
  → sell authority (how unit/total sell is obtained)
  → estimate total
  → persist (line notes `sellAuthority` + optional snapshot `estimateSellAuthority`)
  → Pricing initial state copies estimate cost/sell
  → Quote copies Pricing customer totals
```

Rate source and sell authority are different fields.

| Concept | Answers | Examples |
| --- | --- | --- |
| **Rate source** | Where COST (and optional paired sell) came from | `user_rate`, `benchmark`, `default`, `work_area_rate` |
| **Sell authority** | Why that SELL number exists | `legacy_paired_rate`, `derived_from_gross_margin`, `explicit_sell_override`, then **project target GM** at estimate level |

---

## 2. Canonical formula

Gross margin (GM), never markup:

```
sell = roundMoney(cost / (1 − GM/100))
```

`roundMoney` = 2 decimal places (`lib/commercial-engine/core/money.ts`).

UI label **Margin** on the estimate panel is **gross margin** (GP ÷ sell), not markup (GP ÷ cost). Validation copy in `validateTargetMarginPercent` says “gross margin”.

Default GM: `estimates.target_margin_percent` if set, else `organisation_settings.default_margin_percent`, else `20`.

---

## 3. Unit-rate resolve (before project GM)

`classifyResolvedSell` — exactly three paths:

| Path | When | COST owner | SELL owner | Project GM later? |
| --- | --- | --- | --- | --- |
| **NORMAL cost-first** | company/cost-only row (`sell_rate` null) | company cost | commercial engine from **org** GM | Yes — rewrite totals from cost |
| **LEGACY PAIRED** | both cost and sell present (benchmarks, default labour 60/90, historical company pairs) | pair cost | **pair sell preserved** | Yes — **overwrites** pair sell on estimate totals |
| **EXPLICIT SELL OVERRIDE** | `explicitSellOverride` | cost | caller sell | Not used on estimate generation today |

No fourth path. Markup never owns sell.

---

## 4. Estimate-level project margin

If `estimates.target_margin_percent` is set:

1. `calculateEstimate` still builds lines using §3.
2. `runEstimateGeneration` then `applyTargetMarginToLineItems` — **every included line** `recommended_sell = F-SFM(recommended_cost, target GM)`.
3. `updateEstimateMargin` does the same from persisted `recommended_cost`.

This is **intentional COMMERCIAL-P0 behaviour**, not an accident:

- cost 60, legacy sell 90, project GM 20% → **75**, not 90 and not 108.

First generation with **no** target margin: line-resolved sells (legacy pairs survive).

Regenerate with a saved target margin: pairs are overwritten again.

**Gap:** `EstimateSellAuthority` exists in TypeScript (`line_resolved_sells` \| `project_target_margin`) but is **not persisted** on `estimates`. Infer from whether `target_margin_percent` is set. Line `sellAuthority` is not copied onto `estimate_line_items` (only `rate_source` text + notes metadata).

---

## 5. Authority table

| Kind | Who owns COST | Who owns SELL at resolve | Project GM changes estimate sell? | Regeneration | Pricing | Quote |
| --- | --- | --- | --- | --- | --- | --- |
| Normal detailed cost-first line | company cost × qty | org GM → derived unit sell | Yes, from cost | Recalculates cost then reapplies target GM if set | See §8 | Copies Pricing `total_sell` |
| Legacy paired line | pair cost × qty | pair sell | **Yes — overwrites pair** | Same | See §8 | Copies Pricing |
| Explicit project sell override | n/a on estimate | not a first-class estimate field | n/a | n/a | Pricing item edit can set unit/total sell | Copies Pricing |
| Project margin override | unchanged | F-SFM on cost | This *is* the override | Reapplied if `target_margin_percent` set | See §8 | Copies Pricing |
| Company exact `item_key` | that row | pair or derived per §3 | Yes if target GM set | Yes | See §8 | Copies Pricing |
| Quotr benchmark | catalogue cost | paired catalogue sell | Yes if target GM set | Yes | See §8 | Copies Pricing |

---

## 6. REAL-JOB-01 current Preview (Owner smoke)

Observed:

- Cost ≈ **$8,127**
- Margin **23.5%** (gross margin)
- Sell ≈ **$10,620**

Math:

```
8127 / (1 − 0.235) = 8127 / 0.765 ≈ 10623.53
```

Display ≈ $10,620 is 2-decimal / UI rounding of F-SFM, not a second formula.

This is **not** empty-rates $10,526.30 / $16,069.10 (org GM 20%, line-resolved paired sells).  
This is **not** $10,632.38 / $14,823.78 ($22.50/lm hardwood, no project GM rewrite).

Lower cost means the Preview **org rates** (likely cheaper hardwood and/or labour) reduced COST. 23.5% target GM then owns SELL.

Controlled illustration (hardwood **$10.69/lm** cost-only + canonical framing/fixings/labour + 23.5% GM) — **not** a dump of the Owner org:

| Line | Qty | Cost rate | Cost | Resolve sell auth | Sell after 23.5% GM |
| --- | --- | --- | --- | --- | --- |
| Deck labour | 27 m² (32.4 h) | $60/h | $1,944.00 | legacy pair $90 | $2,541.18 |
| Decking materials | 212.15 lm | $10.69 | $2,267.88 | cost-first $13.36 | $2,964.55 |
| Framing/substructure | 27 m² | $120 | $3,240.00 | legacy pair $180 | $4,235.29 |
| Fixings | 27 m² | $25 | $675.00 | legacy pair $40 | $882.35 |
| **Total** | | | **$8,126.88** | | **$10,623.37** |

`$8,126.88` displays as ≈ $8,127. `$10,623.37` displays as ≈ $10,620. Exact F-SFM: `8126.88 / 0.765 = 10623.3725…` → `roundMoney` **$10,623.37**.

There is **no separate project-rate table**. Surface “project rate” is a company `item_key` (`user_rate`). Blank-key work-area packages do **not** bind named `decking.surface` or `deck.substructure.m2` after RECOVERY-0.

$13,000 + GST remains **REAL_JOB_PARTIAL_COMMERCIAL_EVIDENCE**. Do not calibrate toward it.

---

## 7. Deck components (current)

| Line | Component / item key | Authority | Typical empty-rates REAL-JOB |
| --- | --- | --- | --- |
| Decking materials | `decking.surface` / `deck.material.hardwood.lm` | **REQUIREMENT_AUTHORITATIVE** | 212.15 lm × $22 / $34 → $4,667.30 / $7,213.10 |
| Deck labour | `deck.labour` | **SHADOW** (legacy line still money) | 27 m² × 1.2 h/m² = 32.4 h × $60 / $90 → $1,944 / $2,916 |
| Framing/substructure | `deck.substructure.m2` | **LEGACY_AUTHORITATIVE** | 27 m² × $120 / $180 → $3,240 / $4,860 |
| Fixings | `deck.fixings.m2` | **LEGACY_AUTHORITATIVE** | 27 m² × $25 / $40 → $675 / $1,080 |

Joists / rim / bearers / supports / concrete: **SHADOW diagnostic requirements**. Not estimate cost/sell. Do not promote in this batch.

Labour quantity basis today: **area × hours per m² × Project Conditions factor**. Display unit is m²; money is hours × hourly rate.

### Future (do not implement here)

**LABOUR EFFORT ≠ CREW SIZE ≠ ELAPSED DURATION.**

```
2 workers × 6 hours elapsed = 12 labour-hours
```

This future domain requirement applies beyond Deck. Backlog: **LABOUR-CREW-01**. Do not start DECK-3. Current lumped Deck labour must not be silently reinterpreted.

---

## 8. Persistence / Pricing / Quote — locked behaviour (Owner C1/C2/C3)

**Persist:** generation RPC writes estimate + lines + snapshot. Line `sellAuthority` is stored in existing `__quotr_meta__` JSON (no migration). Optional snapshot `estimateSellAuthority` is `line_resolved_sells` or `project_target_margin`. Historical snapshots omit it — interpret from `estimates.target_margin_percent` or line notes. Notes `sellRate` remains **source evidence** (legacy pair), not current sell.

**Pricing create-from-estimate:** copies estimate `recommended_cost` / `recommended_sell`. Unit sell is display-derived: `totalSell / quantity` (or hours for productivity labour). Notes paired unit sell must not change initial Pricing totals.

**Quote:** `mapPricingItemsToQuoteItems` copies Pricing `total_sell`. No `calculateEstimate`. Client labels strip internal wording including sell-authority identifiers.

**Explicit Pricing edit:** `manually_edited` remains the current override flag. Architecture allows `sellAuthority = explicit_sell_override`. This batch does not add override UX.

---

## 9. Locked forward contract (Owner approved)

**R1 (locked).**  
- COST is always authoritative from rate/component resolution.  
- If `target_margin_percent` is set, estimate **and** Pricing **and** Quote use F-SFM(cost, GM).  
- If no target margin, grandfathered legacy paired unit sell flows Estimate → Pricing → Quote until a later cost-only benchmark migration (C2).  
- Do not retire paired benchmarks in this batch.

R2 and R3 are not adopted.

---

## 10. Four permanent quality gates

Future estimating promotions need all applicable gates:

| Gate | Meaning |
| --- | --- |
| **A. CALCULATION GATE** | Physical quantities and formulas are correct. |
| **B. COMMERCIAL GATE** | Rate source, component authority, margin, and sell authority are correct. |
| **C. PERSISTENCE GATE** | Saved/reloaded money matches the generated result (and Pricing/Quote do not invent a second sell). |
| **D. USER GATE** | The flow makes the builder’s work faster and clearer. |

---

## 11. Non-goals

No UX rebuild. No rate calibration. No $13,000 target. No structural promotion. No DECK-3. No migration. No Production deploy.
