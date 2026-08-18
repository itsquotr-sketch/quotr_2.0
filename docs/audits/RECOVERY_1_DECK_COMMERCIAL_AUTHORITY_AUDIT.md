# RECOVERY-1 — Deck commercial authority audit

**Status:** COMPLETE / COMMERCIAL CONTRACT VALIDATED  
**Date:** 2026-08-19  
**HEAD verified:** `b89843823c7ef0847056b9c068b231af0c9449e6` local = remote `hardening/stage-2a-security`  
**Verify:** `npx tsx scripts/verify-recovery-1-commercial-authority.ts`  
**Contract:** `docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md`

No production commercial behaviour was changed in this batch.

---

## 1. Preview money explained

Owner Preview (authenticated, after RECOVERY-0):

| | Observed |
| --- | --- |
| Cost | ≈ $8,127 |
| Margin | 23.5% |
| Recommended sell | ≈ $10,620 |

`8127 / (1 − 0.235) ≈ 10623.53`. UI ≈ $10,620 is F-SFM rounding/display.

Why not the synthetic figures:

| Synthetic | Cost | Sell | Why different |
| --- | --- | --- | --- |
| Empty `rates: []`, org GM 20%, **no** target GM | $10,526.30 | $16,069.10 | Paired benchmark sells (180/40/90/34) summed |
| $22.50/lm hardwood, no target GM | $10,632.38 | $14,823.78 | Decking cost-first; framing/fixings still paired |
| Preview org | ≈ $8,127 | ≈ $10,620 | **Cheaper org cost rates** + **project GM 23.5% rewrites every line sell from cost** |

$13,000 + GST is not used as a rate.

---

## 2. Line-level empty-rates REAL-JOB-01 (controlled)

| Description | Key | Qty | Unit | Cost rate | Cost | Cost source | Resolve sell | Resolve sell auth | Line sell (no target GM) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Deck labour | `deck.labour` / default carpenter | 27 (32.4 h) | m² (hours) | $60/h | $1,944 | default pair | $90/h | `legacy_paired_rate` | $2,916 |
| Decking materials | `decking.surface` / hardwood lm | 212.15 | lm | $22 | $4,667.30 | benchmark | $34 | `legacy_paired_rate` | $7,213.10 |
| Framing/substructure | `deck.substructure.m2` | 27 | m² | $120 | $3,240 | benchmark | $180 | `legacy_paired_rate` | $4,860 |
| Fixings | `deck.fixings.m2` | 27 | m² | $25 | $675 | benchmark | $40 | `legacy_paired_rate` | $1,080 |
| **Total** | | | | | **$10,526.30** | | | | **$16,069.10** |

After `applyTargetMarginToLineItems(…, 23.5)` every sell becomes `cost / 0.765`. Framing $4,860 → $4,235.29.

Preview-shaped illustration: hardwood **$10.69/lm** cost-only + same labour/framing/fixings + 23.5% GM:

| Line | Qty | Cost | Resolve sell | Sell after 23.5% GM |
| --- | --- | --- | --- | --- |
| Deck labour | 27 m² / 32.4 h | $1,944.00 | $2,916 (pair $90) | $2,541.18 |
| Decking materials | 212.15 lm | $2,267.88 | $2,833.52 (derived $13.36) | $2,964.55 |
| Framing/substructure | 27 m² | $3,240.00 | $4,860 (pair $180) | $4,235.29 |
| Fixings | 27 m² | $675.00 | $1,080 (pair $40) | $882.35 |
| **Total** | | **$8,126.88** | | **$10,623.37** |

That is an illustration of the **math**, not a claim of the Preview org’s exact hardwood rate. Owner Preview ≈ $8,127 / $10,620 matches this F-SFM shape.

---

## 3. Legacy paired vs cost-first vs project GM

| Question | Code answer |
| --- | --- |
| A. Is paired sell authoritative at resolve? | **Yes**, `classifyResolvedSell` → `legacy_paired_rate` when both present |
| B. Grandfather / display only? | Grandfathered **until** project target GM is applied |
| C. Does project GM recompute sell from cost? | **Yes**, all included lines |
| D. Does margin edit overwrite paired sell? | **Yes** (`updateEstimateMargin` → `applyMarginToAmounts` on `recommended_cost`) |
| E. Does new generation preserve paired sell? | Only if `target_margin_percent` is null |
| F. Does Pricing preserve paired sell? | **It uses notes unit sell**, so it can restore the pair even after estimate GM rewrite — **STOP** |
| G. Does Quote preserve paired sell? | Quote copies Pricing totals; it does not know about pairs |

---

## 4. Pricing parity (Owner C1)

`calculateAuthoritativeFieldsFromEstimateLine` copies estimate `recommended_cost` / `recommended_sell`. Unit sell is `totalSell / quantity` (or hours). Notes `sellRate` is lineage only.

After 23.5% GM, estimate framing sell = Pricing initial sell = **$4,235.29**. Quote copies Pricing.

## 4b. Persistence (Owner C3)

`sellAuthority` is stored in line `__quotr_meta__`. Snapshot may include `estimateSellAuthority`. No migration. Historical rows without the field are interpreted by `interpretLineSellAuthority`.

---

## 5. Surface / substructure / fixings / labour

- **Surface:** REQUIREMENT_AUTHORITATIVE.
  - A. Benchmark: $22/$34 paired, `benchmark`, snapshot + Pricing use those unit rates until project GM.
  - B. Company exact cost-only: `user_rate`, sell derived from org GM, then project GM rewrites totals.
  - C. There is no separate project-rate table. A company `item_key` is `user_rate`. Blank-key work-area packages do not bind named surface (RECOVERY-0).
  - Pricing transfer: create-from-estimate copies `component_key` and recomputes from notes unit rates (same STOP as framing if GM was applied).
- **Substructure:** one legacy active line. Children not on money lines. Sell = pair $180 until project GM F-SFM on $3,240.
- **Fixings:** one legacy active line. Exact company `deck.fixings.m2` outranks $25/$40. Sell = pair $40 until project GM.
- **Labour:** SHADOW requirement; legacy line still prices. 1.2 h/m² × area × PC factor. Company `labour.carpenter.hour` outranks 60/90. No double-count with structural children.

---

## 6. Persistence

Local disposable org + `persist_estimate_generation_v1`: reloaded cost/sell match generated empty-rates totals. This is **local Docker**, not hosted Preview mutation.

**Hosted Preview:** disposable org `RECOVERY-1-PROOF` on `lxvnylhsbvudzzupxeqr` via production `persistEstimateGenerationViaRpc`. Reloaded F-SFM cost/sell matched generated totals; snapshot readable; Pricing adapter on reloaded notes restored framing **$4,860** while estimate line sell was **$4,235.29**; Quote projection copied Pricing, not estimate F-SFM. Disposable org deleted.

This batch does not write Production or the Owner test org.

---

## 7. Goldens

Unchanged. No restamp.
