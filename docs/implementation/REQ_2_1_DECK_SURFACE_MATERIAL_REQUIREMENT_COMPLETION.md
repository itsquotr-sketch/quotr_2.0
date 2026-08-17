# REQ-2.1 — Deck surface MaterialRequirement shadow emission

**Classification:** COMPLETION  
**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**Baseline HEAD:** `3c95d3c1847d9aa93303a1aba9c8822dba81d709`  
**Verify:** `npx tsx scripts/verify-req-2-1-deck-surface-material-requirement.ts`  
**Owner gate:** `docs/runbooks/REQ_2_1_OWNER_TECHNICAL_GATE.md`

REQ-2 is **COMPLETE / MATERIAL EMISSION FOUNDATION VALIDATED**. Does not authorise REQ-2.2, fascia emission, money change, Materials UI, persistence, or Production.

---

## Purpose

Prove that the Deck calculator can emit **one** real `MaterialRequirement` for **Deck surface decking** that reuses the existing physical takeoff and rate-resolution result, without becoming estimate-money authority.

---

## Decision: width unknown

**Option B — emit no Deck surface MaterialRequirement** when board width is unknown.

The live calculator falls back to an m² package. That package is not a defensible board takeoff. Emitting an lm requirement would be fake; emitting an m² “takeoff” would claim detailed quantity that does not exist.

Physical lm is emitted only when `calculateDeckingBoardLm` succeeds (known area + known board width).

---

## Confidence

**medium**

Known: area, board width, material family, waste factor.  
Unknown / unmodelled: gaps, orientation, offcuts, stock-length optimisation, irregular geometry. Nominal width is used as coverage width. This is estimate-level takeoff, not fabrication accuracy.

Not **high**.

---

## Commercial boundary — three truths

| Truth | REQ-2.1 Deck surface |
| --- | --- |
| **Physical** | YES — known area + board width produce 115.14 / 11.51 / 126.65 lm |
| **Pricing** | YES where a company or Quotr lm path resolves; `priced: false` / `missing` otherwise |
| **Commercial authority** | NO / SHADOW — estimate line remains money SoT |

`priced: true` means internal cost fields are resolved. It does **not** mean the requirement drives estimate totals, Pricing, or Quote. Do not add a `commercialAuthority` field. REQ-4 owns promotion at component level.

Compatibility identity remains `deck.material.*.lm`. CAT-IDENTITY-01 / Catalogue V2 later separate physical material identity from rate unit. No rate-key refactor here.

---

## Approximation boundary (DECK-1 later)

- Nominal width as coverage
- Board gaps not modelled
- Orientation not modelled
- Stock length / offcut optimisation not modelled
- Irregular geometry limitations

These do not delay REQ-2.1.

---

## REQ-2 close

REQ-2 is the MaterialRequirement **emission foundation**, not an open queue of extra materials.

Current production emitter: **Deck surface only**. Capability is **ACTIVE**. Future materials emit during Work Area maturation (DECK-1 members, DECK-2 face/fascia, other WAs). Do not manufacture REQ-2.2.

**DECK-1 owns:** joists, bearers, posts/piles, concrete, fixings, improved surface takeoff.  
**DECK-2 owns:** face/fascia geometry (Front / Rear / Left / Right) and that material requirement.

## REQ-3 handoff (do not start here)

**LabourRequirement shadow emission foundation.**

Same discipline: one existing labour calculation → estimate line and LabourRequirement. Shadow only. No invented DECK-3 task split. Hours are labour hours, not crew elapsed time. Consume already-resolved adjusted hours; record `adjustmentRef.factors[]` as provenance; do not recompose Project Conditions (OD-PC-01 remains future).

**Recommended first candidate:** Deck **“Deck labour”** line (`createLabourLineItem`, area × productivity × combined access × quality, `resolveLabourRate`). Isolated, always present, hour-based, exact cost parity possible. Not “Existing deck removal” (scope-gated), not face-board labour (lump $), not bathroom labour (more fragmented).
