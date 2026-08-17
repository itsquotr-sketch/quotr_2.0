# DECK-1 Implementation Plan

**Status:** PLANNING — DECK-1 IN PROGRESS / DECK-1A COMPLETE / OWNER MODEL VALIDATED  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`

**Canonical model:** `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md`  
**Current-state audit:** `docs/audits/DECK_1A_CURRENT_STATE_AND_INPUT_AUDIT.md`  
**Owner gate:** `docs/runbooks/DECK_1A_OWNER_MODEL_GATE.md`

---

## 0. Programme context

| Item | Status |
| --- | --- |
| REQ programme | COMPLETE / FROZEN |
| `decking.surface` | REQUIREMENT_AUTHORITATIVE |
| `deck.labour` | SHADOW |
| Structural components | LEGACY (`deck.substructure.m2` package) |
| DECK-1A | COMPLETE LOCAL / OWNER MODEL REVIEW PENDING |
| DECK-1B | NOT STARTED |

---

## 1. Goal

Replace coarse Deck structural **m² package** allowances with **physically explainable member quantities** emitted as **shadow MaterialRequirements**, without changing estimate money until explicit authority promotion (DECK-1R).

---

## 2. Batch sequence

| Batch | Name | Scope | Money impact |
| --- | --- | --- | --- |
| **DECK-1A** | Current-state audit + physical model contract | This document + architecture | **None** |
| **DECK-1B** | Scope Details facts + shadow emitters + verifier | New facts (Owner-approved), calculator module, SHADOW reqs | **None** — legacy package remains authoritative |
| **DECK-1C** | Rate keys + benchmarks + catalogue rows | `timber.sg8.*`, concrete key, fixings allowance | **None** — shadow pricing only |
| **DECK-1D** | Shadow reconciliation + fixture matrix outputs | Verifier proves Σ shadow ↔ legacy package | **None** |
| **DECK-1R** | Commercial review + selective authority promotion | Parent group or child promotion | **Owner gate** — intentional model improvement |
| **DECK-2** | Face/fascia physical model | Separate programme | TBD |
| **DECK-3** | Task-level labour | Separate programme | TBD |
| **DECK-5** | Materials transparency UI | Read-only breakdown | TBD |

**Do not skip DECK-1A Owner review before DECK-1B.**

---

## 3. DECK-1B boundaries (next implementation batch)

### In scope

- Owner-approved Scope Details fact keys (orientation, spacing, sections)
- `lib/estimate/deck-structural-*.ts` calculator module (deterministic, no AI)
- Shadow `MaterialRequirement` emitters for: joists, rim, bearers, supports, concrete (blocking/fixings per Owner decision)
- Geometry gate: rectangular L+W only
- Legacy fallback when spec incomplete
- `scripts/verify-deck-1-structural-shadow-emission.ts`
- Assumption recording for defaults

### Out of scope

- Authority promotion (REQUIREMENT_AUTHORITATIVE)
- Legacy package removal
- Pricing / Quote changes
- Migration
- Materials UI
- Production deploy
- Catalogue V2 full seed (minimal benchmark keys only if needed for shadow pricing)

### Preconditions

- [ ] DECK-1A Owner model gate approved
- [ ] Reference fixture structural facts chosen (16.12 m² deck)
- [ ] Joist count boundary rule confirmed (+1 convention)
- [ ] Corner post dedup rule confirmed
- [ ] Default spacing list approved (or mandatory ask)

---

## 4. DECK-1C — rate infrastructure

| Task | Detail |
| --- | --- |
| Add `MATERIAL_RATE_KEYS` entries | `timber.sg8.{section}.{treatment}.lm` pattern |
| Benchmark defaults | Owner-approved $/lm for MVP sections |
| Catalogue rows | `specific-material-catalogue.ts` |
| Concrete key | `concrete.footing.m3` or agreed generic |
| Post EA keys | `timber.sg8.{section}.{treatment}.ea` |
| Fixings | `deck.fixings.structural.m2` allowance key |

**Dependency:** CAT-V2-1 taxonomy alignment — do not invent merchant-full size list without Owner approval.

---

## 5. DECK-1D — verification

| Check | Method |
| --- | --- |
| Shadow emission | Each componentKey present when spec complete |
| No emission on area-only | EDGE-01 fixture |
| No double count | One-source rule per componentKey |
| Aggregate parity | Σ shadow structural cost within documented model vs `deck.substructure.m2` — **intentional improvement may differ** |
| Goldens unchanged | Deck 1 $48,340, Fence, Pergola, RW |
| REQ-4B surface | Still REQUIREMENT_AUTHORITATIVE |
| No migration | 001–036 only |

---

## 6. DECK-1R — promotion (future)

Only after DECK-1D aggregate review:

1. Owner commercial review of intentional model improvement vs legacy package.
2. Register `deck.substructure` group authority (or per-child promotion).
3. Follow REQ-4B pattern: SHADOW → parity → REQUIREMENT_AUTHORITATIVE → LEGACY_FALLBACK → retire.
4. Preview proof + atomic persist validation.

---

## 7. Files expected (DECK-1B+ — not created in DECK-1A)

| File | Purpose |
| --- | --- |
| `lib/estimate/deck-structural-model.ts` | Geometry + orientation |
| `lib/estimate/deck-joist-requirement.ts` | Joist MaterialRequirement |
| `lib/estimate/deck-bearer-requirement.ts` | Bearer MaterialRequirement |
| `lib/estimate/deck-support-requirement.ts` | Post/pile requirement |
| `lib/estimate/deck-concrete-requirement.ts` | Concrete requirement |
| `lib/scopes/templates/deck.ts` | New questions (Owner-approved keys) |
| `scripts/verify-deck-1-structural-shadow-emission.ts` | Verifier |

---

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| Silent structural design | DECK-STRUCT-01; disclosed defaults only |
| Double count on promotion | One-source rule; aggregate reconciliation |
| Over-questioning builders | Minimum question set; sensible defaults |
| Missing rate keys block shadow pricing | DECK-1C before meaningful reconciliation |
| Area-only decks break | Explicit legacy fallback |

---

## 9. Success criteria

DECK-1 programme complete when:

1. Shadow structural requirements explain every member quantity on reference fixtures.
2. Legacy `deck.substructure.m2` reconciles or documented intentional improvement accepted.
3. Owner promotes structural commercial authority (DECK-1R) with Preview proof.
4. Deck 1 golden unchanged until intentional structural promotion review.
5. Materials transparency data model supports DECK-5 UI (no UI required now).

---

## 10. Exact next action

**Owner review of DECK-1A model contract** (`docs/runbooks/DECK_1A_OWNER_MODEL_GATE.md`). Upon approval, begin **DECK-1B** — Scope Details facts + shadow emission (no money change).
