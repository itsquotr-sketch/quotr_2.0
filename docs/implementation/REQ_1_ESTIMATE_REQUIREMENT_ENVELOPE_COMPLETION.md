# REQ-1 — Estimate requirement envelope + aggregation foundation

**Classification:** COMPLETION  
**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**Baseline HEAD:** `5a6b8223e29e1bde369dc4a4bfe8cc11aeff2b6e`  
**Verify:** `npx tsx scripts/verify-req-1-estimate-requirement-envelope.ts`  
**Aggregation contract:** `docs/architecture/QUOTR_REQUIREMENT_AGGREGATION_CONTRACT.md`  
**Owner gate:** `docs/runbooks/REQ_1_OWNER_TECHNICAL_GATE.md`

Does not authorise REQ-2 emission, money change, Materials/Labour UI, persistence, or Production.

---

## Purpose

Make structured `EstimateRequirement[]` **possible** on the calculator envelope, with validation, deterministic ordering, and physical aggregation.

Do **not** make emission universal. Do **not** make requirements commercially authoritative.

---

## Delivered

1. Optional `requirements` on `CalculatorResult` and collected `EstimateResult.requirements`.
2. Production calculators unchanged (field omitted). Empty collection is the live path.
3. `collectRequirements` → `normalizeRequirements` → `summarizeEstimateRequirements`.
4. Kind-specific validation; duplicate IDs fail loudly; negatives rejected; zero preserved.
5. Material / labour / plant / subcontract / waste physical grouping with contributor provenance.
6. Priced-only diagnostic cost totals explicitly **not** added to estimate money.
7. Multi-WA collection, including commercial interior component composition.
8. Verifier covering contract, identity, validation, aggregation, commercial safety.

---

## Envelope decision

Narrowest correct boundary: **`CalculatorResult.requirements?: readonly EstimateRequirement[]`**.

One optional field. Calculators remain valid without it. No duplicate requirement fields. `calculateEstimate` collects after `finalizeEstimateResult` so totals stay line-item-only.

---

## Commercial safety

| Rule | Evidence |
| --- | --- |
| Requirement costs not in estimate totals | `finalizeEstimateResult` ignores requirements; generate attaches collection after totals |
| Line items remain money SoT | Unchanged commercial engine path |
| No component authority | Lifecycle type reserved only |
| No persistence | `persistEstimateResult` payload unchanged |
| No migration | None |
| Live calculators do not emit | Deck/Bathroom/etc. omit `requirements` |
| Goldens unchanged | Deck 1 $48,340 · Fence 2 $8,782 · Pergola 1 $15,374 · RW 2 $7,345 |

---

## REQ-2 handoff (do not start)

**MaterialRequirement emission** — not a Deck rewrite.

**FIRST PRODUCTION MATERIAL REQUIREMENT: Deck surface decking ONLY.**

Do **not** include face/fascia boards in the first emission batch.

Reason: Deck surface already has a reconciled physical quantity and rate authority. Face/fascia remains tied to future **DECK-2** / **OD-FACE-01** (Front / Rear / Left / Right). Do not formalise incomplete legacy fascia geometry merely because an lm allowance currently exists.

Also defer until physical models are mature:

- joists
- bearers
- posts/piles
- concrete
- fixings

REQ-2 first proof should be deliberately narrow.

### First-proof contract (document only — do not implement here)

| Field | Value |
| --- | --- |
| kind | `material` |
| component | `decking.surface` |
| material identity | current matching Deck surface material |
| base quantity | current pre-waste physical lm |
| waste | current explicit waste factor |
| purchase quantity | current post-waste lm |
| unit | `lm` |
| rate source | `company` / `project_override` / `supplier` / `benchmark` / etc. per frozen contract |
| unit cost | same rate authority as existing Deck surface pricing |
| total cost | same physical-price calculation |
| priced | `true` |
| commercial authority | **SHADOW / NOT ESTIMATE MONEY YET** |

`priced: true` means requirement pricing is **internally resolved**. It does **not** mean the requirement drives estimate totals. **REQ-4** owns commercial promotion.

### Parity expectation (16.12 m² / 140 mm / 10% hardwood)

| Quantity | Value |
| --- | --- |
| base | 115.14 lm |
| waste | 11.51 lm |
| purchase | 126.65 lm |

When Quotr benchmark **$22/lm** is authoritative: cost **$2,786.30**.

The MaterialRequirement must reconcile to the **same** current Deck surface pricing path. No estimate-money change. No duplicate pricing.

---

## REQ-3 handoff (do not start)

**LabourRequirement emission** at **honest current granularity**.

Today Deck labour is largely one (or few) hour lines, not DECK-3 task breakdown. REQ-3 should expose existing calculator labour as requirements (component/task key = current line), carrying `adjustmentRef.factors` without inventing demolition/setout/joist/decking task hours. DECK-3 owns the detailed task model.

---

## REQ-4 gates (do not start)

- **REQ-SNAPSHOT-01** — snapshot/provenance before promotion
- Component authority lifecycle (`LEGACY_AUTHORITATIVE` → … → `LEGACY_RETIRED`)
- Parity classes A/B (semantic reimplementation vs intentional change)
- Do not add requirement cost to estimate until promotion

---

## Non-goals (held)

Calculator emission · Materials UI · Labour UI · DB rows · migrations · component-authority table · snapshot schema · OD-PC-01 composition · unit-conversion engine · confidence percentages · Production SD · Company DNA
