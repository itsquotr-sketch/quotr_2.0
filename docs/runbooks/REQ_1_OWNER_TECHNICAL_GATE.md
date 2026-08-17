# REQ-1 Owner Technical Gate

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Batch:** REQ-1 Estimate requirement envelope  
**Completion:** `docs/implementation/REQ_1_ESTIMATE_REQUIREMENT_ENVELOPE_COMPLETION.md`

REQ-1 has **no customer-facing UI**. Do not invent a visual feature to test.

Automation is the primary gate. Owner smoke is a short “app still behaves the same” check (loads, Deck/Bathroom/multi-WA generate, Pricing/Quote open, no requirement UI).

Next authorised implementation: **REQ-2** — Deck **surface decking only**. Do not start in the REQ-1 close batch.

---

## What to confirm

Automation is the primary gate. If green, Owner smoke is a short “app still behaves the same” check:

1. App loads on Preview.
2. Open an existing project — workflow unchanged (Project Conditions → Scope Details → Estimate).
3. Generate a **Deck** estimate — totals and line labels look as before (no Materials takeoff UI).
4. Generate a **Bathroom** estimate — unchanged.
5. Multi-WA / commercial interior project still generates from component Work Areas (no `commercial_fitout` calculator).
6. Pricing and Quote from that estimate are unchanged.

No exhaustive UI regression is required when `verify-req-1-estimate-requirement-envelope.ts` and commercial goldens are green.

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

- Materials / Labour screens
- Requirement rows in the database
- New estimate totals
- REQ-2 Deck decking emission
- Production deploy
- Production Scope Discovery
