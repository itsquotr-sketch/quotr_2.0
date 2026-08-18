# Quotr Estimate Presentation Contract

**Classification:** CANONICAL — common estimate projection for Builder Review (future)  
**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Mode:** Presentation contract only. Does **not** change commercial authority, rates, or sell. Hybrid takeoff + allowances is **permanent**.  
**Commercial SoT:** `docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md`  
**Live grouping today:** `lib/estimate/presentation-breakdown.ts`

---

## 1. Purpose

Any Work Area must be **presentable** as:

- MATERIALS
- LABOUR
- ALLOWANCES
- SUBCONTRACT
- PLANT
- WASTE
- OTHER DIRECT COSTS

without changing underlying commercial authority.

This prepares **Builder Review** (RECOVERY-5). No UI in this batch.

Empty buckets are valid. Do not invent plant or waste lines to fill the grid.

---

## 2. Live line categories vs presentation buckets

`LineItemCategory` today:

`labour | materials | subcontractor | allowance | contingency | mixed`

There is **no** `plant` or `waste` category. Waste appears as demolition allowance or baked wastage on materials.

### Projection map (presentation only)

| Presentation bucket | Source |
| --- | --- |
| MATERIALS | `category === "materials"` (and mixed splits that are material) |
| LABOUR | `category === "labour"` |
| SUBCONTRACT | `category === "subcontractor"` |
| ALLOWANCES | `category === "allowance"` plus residual/package allowances |
| PLANT | **empty until** a line is explicitly plant (do not rebadge labour) |
| WASTE | demolition waste allowances / explicit waste lines; not a new money engine |
| OTHER DIRECT COSTS | `contingency`, unmatched `mixed`, P&G if ever shown internally (usually Pricing, not Estimate) |

Work Area grouping: **`work_areas.name` / id** — already used by `presentEstimateWorkAreaTotals`. Keep that parent. Do not group by calculator category labels.

Sell/cost/margin remain commercial-engine rollups. Presentation must not recompute sell.

---

## 3. Builder Review target sections (RECOVERY-5)

Separable from Assistant setup:

1. **Overview** — totals, confidence, Work Area list
2. **Materials** — major materials; residual allowance visibility
3. **Labour** — hours/cost; later LABOUR-CREW-01 if emitted
4. **Allowances / Other Costs** — subcontract, plant, waste, other
5. **Assumptions / Checks**
6. **Pricing Required**

Editable Facts stale the estimate (existing rule). Builder Review **explains/confirms**. It does not become Pricing.

DECK-2C (face/fascia review editing) is **superseded / deferred into RECOVERY-5**. Do not start DECK-2C as a separate UX programme.

---

## 4. Hybrid estimate principle (locked)

Detailed physical takeoff is used where it improves:

- accuracy
- user value
- commercial visibility

Allowances/packages remain valid for:

- minor items
- variable items
- low-value items
- scope still maturing

Example (Deck, current engine — do not change money here):

- Decking lm: detailed
- Substructure m² package: still valid until structural promotion
- Fascia unknown: check / residual, not a fake takeoff

Bathroom: subcontract packages are honest first-class lines, not a failed takeoff.

---

## 5. Pricing / Quote presentation boundary

| Surface | May show | Must not leak |
| --- | --- | --- |
| Estimate / Builder Review | cost, sell, GM, assumptions, rate source labels the builder already sees | shadow diagnostics, internal authority enums as customer copy |
| Pricing | deliberate edits; RECOVERY-1 sell authority | must not change sell merely by entering |
| Quote | customer scope + priced items | material takeoff internals, rate provenance, `sellAuthority`, shadow, REAL-JOB $13,000 |

Job Plan included/excluded text is the future source of **clean customer scope wording**. Quote still snapshots Pricing, not Job Plan money.

---

## 6. Multi-Work-Area presentation

Builder Review groups **first by Work Area**, then by presentation bucket.

A bathroom + deck + painting job shows three parents. Painting labour does not merge into Deck labour.

Unallocated lines (empty `work_area_name`) stay Unallocated — never invent a Work Area label from a calculator category.
