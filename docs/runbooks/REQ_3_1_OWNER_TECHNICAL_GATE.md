# REQ-3.1 Owner Technical Gate

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Batch:** REQ-3.1 Deck labour LabourRequirement shadow emission  
**Completion:** `docs/implementation/REQ_3_1_DECK_LABOUR_REQUIREMENT_COMPLETION.md`

REQ-3.1 has **no customer-facing UI**. Automation is the principal gate.

REQ-3.1-R1: benchmarks-off still prices labour at hardcoded 60/90; the requirement matches that pricing truth (`hardcoded_legacy`, exact line cost). Estimate money was not changed.

REQ-3 is **COMPLETE / LABOUR EMISSION FOUNDATION VALIDATED**. Next authorised infrastructure: **REQ-4** (do not start in this batch).

---

## What was confirmed

1. App loads (Preview after push).
2. Deck estimate generates; totals and line labels unchanged.
3. Deck labour line hours and cost unchanged versus pre-REQ-3.1.
4. Pricing unchanged.
5. Quote unchanged.
6. No Labour / hours / requirement inspector UI.

---

## Expected commercial goldens (unchanged)

| Scenario | Sell |
| --- | --- |
| Deck 1 | $48,340 |
| Fence 2 | $8,782 |
| Pergola 1 | $15,374 |
| Retaining Wall 2 | $7,345 |

---

## Not this gate

- Labour tab / hours breakdown UI
- DECK-3 task split
- Demolition or fascia LabourRequirements
- Estimate total changes
- REQ-4 snapshot / promotion
- CM-03 money/label remediation
- Production deploy
- Production Scope Discovery
