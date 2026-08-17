# DECK-1B Structural Material Requirements — Completion

**Status:** COMPLETE LOCAL / OWNER QUANTITY REVIEW PENDING  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**DECK-1A commit:** `ca1e137bd12c0602ffb8f2fa8006ab82f94387e1`  
**Verify:** `npx tsx scripts/verify-deck-1b-structural-material-requirements.ts` (59/0)

Deterministic rectangular Deck structural physical quantities emitted as **shadow MaterialRequirements**. No commercial authority change. Legacy `deck.substructure.m2` remains money authority.

---

## What landed

| Item | Detail |
| --- | --- |
| Module | `lib/estimate/deck-structure.ts` |
| Scope facts | 14 new optional Scope Details keys (framing/supports/footings/orientation) |
| Shadow components | `deck.joists`, `deck.rim_framing`, `deck.bearers`, `deck.supports`, `deck.concrete` |
| Geometry gate | Requires `deck.length_m` + `deck.width_m` (no area-only framing grid) |
| Partial maturity | Each component emits when its own prerequisites are met |
| Reconciliation | `deckSubstructureReconciliation` on calculator result (INTENTIONAL_MODEL_IMPROVEMENT) |
| Reference fixture | DECK-REF-01 (5.20 × 3.10 m) — synthetic test fixture only |

## DECK-REF-01 expected outputs

| Component | Base | Purchase |
| --- | ---: | ---: |
| Joists | 40.30 lm | 42.32 lm |
| Rim (end only) | 10.40 lm | 10.92 lm |
| Bearers | 10.40 lm | 10.92 lm |
| Supports | 8 | 8 EA |
| Concrete | 0.324 m³ | 0.324 m³ |

## What did not land

- No authority promotion (all structural children remain SHADOW / unregistered LEGACY)
- No `deck.blocking` emission
- No `deck.fixings.structural` emission
- No rate catalogue seeding (DECK-1C)
- No migration / Production deploy
- No Materials UI

## Commercial safety

- `decking.surface` = REQUIREMENT_AUTHORITATIVE (unchanged)
- `deck.labour` = SHADOW (unchanged)
- Legacy Framing/substructure line unchanged
- Deck 1 golden sell **$48,340** unchanged
- Structural requirements `priced=false` when no company rate (valid DECK-1B behaviour)

## Next

**DECK-1C** — rate keys + benchmark seeding for `timber.sg8.*` and concrete.  
**DECK-1R** — commercial review + selective authority promotion (future).
