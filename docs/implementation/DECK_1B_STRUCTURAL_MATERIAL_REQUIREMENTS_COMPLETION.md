# DECK-1B Structural Material Requirements — Completion

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**DECK-1A commit:** `ca1e137bd12c0602ffb8f2fa8006ab82f94387e1`  
**DECK-1B commit:** `60a356e005897be8ca1e54a20204eeca352b592d`  
**Preview URL:** `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`  
**Verify local:** `npx tsx scripts/verify-deck-1b-structural-material-requirements.ts` (69/0)  
**Verify remote:** `npx tsx scripts/verify-deck-1b-remote-preview-structural-proof.ts` (27/0)

Deterministic rectangular Deck structural physical quantities emitted as **shadow MaterialRequirements**. No commercial authority change. Legacy `deck.substructure.m2` remains money authority.

---

## What landed

| Item | Detail |
| --- | --- |
| Module | `lib/estimate/deck-structure.ts` |
| Scope facts | 14 new optional Scope Details keys (framing/supports/footings/orientation) with dependency gating |
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

## Remote validation (2026-08-18)

- `project_facts` save/reload preserved DECK-REF-01 structural inputs
- Requirement snapshot contains all five SHADOW structural children at reference quantities
- 450 → 400 mm joist centres: joist purchase 45.57 lm; legacy substructure money unchanged
- Partial footing maturity: concrete omitted only; estimate money unchanged
- Disposable org cleaned up after proof

---

## Next

**DECK-1C** — rate keys + benchmark seeding for `timber.sg8.*` and concrete.  
**DECK-1R** — commercial review + selective authority promotion (future).
