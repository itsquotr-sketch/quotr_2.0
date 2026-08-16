# FOUNDATION-R2-R1-R1 — Contractor rate precedence completion

**Status:** Complete Local / included in R2-R1 Preview gate  
**Date:** 2026-08-16  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `npx tsx scripts/verify-foundation-r2r1r1-contractor-rate-precedence.ts`

Do not mark Owner PASS from this document. Do not start REQ-1.

---

## Purpose

R2-R1 correctly priced Deck boards as **purchase lm × $/lm** and stopped double-counting m² + lm. Its fallback order still let a **Quotr $/lm benchmark** beat a contractor’s own matching **$/m²** merely because units differed. This batch locks contractor commercial authority where conversion is deterministic.

---

## Decisions

1. **Company outranks Quotr** for the same physical decking material.
2. **`deck.material.{material}.m2` semantics = B** — historical material package for the **same boards**, applied to net deck area. Not a whole-deck package (framing `deck.substructure.m2` and fixings `deck.fixings.m2` are separate). Conversion **is allowed** when board width is known.
3. **Owner ~$23 cost / ~$25 charge** is a **company-entered** `deck.material.hardwood.m2` row (unit m²). It is **not** a Quotr benchmark (hardwood m² bench is $230/$340). The persisted row was **not** rewritten and was **not** auto-converted in the rates table. Numerically it sits near a $/lm figure; if that was unit confusion, enter `$/lm` under All materials (step 1 still wins).
4. **Quotr m² is not converted to lm.** Benchmarks are independently calibrated. Converting Quotr m² would fight the published Quotr `$/lm` series.
5. **Waste once:** `purchaseLm` already includes waste %. Converted unit cost is `cost_m² × (width_mm / 1000)`. Total = purchase lm × that unit cost. Package fallback (no width) prices **net area × $/m²** and does not invent waste.

---

## Hierarchy (board width known)

1. Company exact `$/lm`
2. Company matching `$/m²` converted
3. Quotr exact `$/lm`
4. Matching `$/m²` area package
5. Pricing required (benchmarks off, no company rate)

Board width unknown: never invent lm. Company then Quotr matching m² package.

---

## Authoritative production arithmetic (16.12 m² · 140 mm · 10%)

Physical: base **115.14** + waste **11.51** = purchase **126.65** lm.

Engine money is `roundMoney(qty × unitRate)` after unit sell is classified.

| Case | Unit cost | Unit sell | Material cost | Sell | GP | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Company $18.50/lm cost-only | $18.50 | **$23.13** (`roundMoney(18.50/0.8)`) | **$2,343.03** | **$2,929.41** | $586.38 | Not $2,928.79 — that is F-SFM on the *total* cost. Production rounds **unit** sell first, then `126.65 × 23.13`. Margin displays 20.02% from 2 dp. |
| Company $160/m² converted | $22.40/lm | $28.00 | **$2,836.96** | **$3,546.20** | $709.24 | Waste once via purchase lm. Outranks Quotr $22/lm. Net-area-only would be $2,579.20. |
| Quotr $22/$34 lm | $22.00 | $34.00 | **$2,786.30** | **$4,306.10** | $1,519.80 | Legacy paired (~35.29% GM). No project-margin stack. |

**RATE-QUALITY-01:** Backlog / Not Started. Do not auto-correct company $23/m².

---

## REQ-1

**Technical gates: PASS.** Deck qty/rate authority is coherent, contractor precedence is settled, units reconcile, fallbacks are explicit, no critical double-count remains, and the priced lm (or honest package) can later feed a requirement envelope.

**Do not start REQ-1** until Owner Preview PASS of the combined R2-R1 + R2-R1-R1 gate.

---

## Verification

`npx tsx scripts/verify-foundation-r2r1r1-contractor-rate-precedence.ts` — expected **30 passed, 0 failed**.
