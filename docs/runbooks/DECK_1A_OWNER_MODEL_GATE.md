# DECK-1A Owner Model Gate

**Status:** OWNER MODEL VALIDATED (R1 2026-08-18)  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`

---

## Purpose

Owner approval of the **physical Deck structural material model contract** before DECK-1B implementation. This gate does **not** authorise commercial promotion or estimate money changes.

---

## Artifacts for review

| Document | Content |
| --- | --- |
| `docs/architecture/DECK_STRUCTURAL_MATERIAL_MODEL.md` | **Canonical contract** — model table, formulas, migration, DECK-STRUCT-01 |
| `docs/audits/DECK_1A_CURRENT_STATE_AND_INPUT_AUDIT.md` | As-is facts, calculator lines, rate gaps |
| `docs/plans/DECK_1_IMPLEMENTATION_PLAN.md` | DECK-1B+ batch sequence |

---

## Owner decision register

Decisions requiring product/construction judgment:

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | First geometry class | A rectangular only / B composite / C area-only | **A — rectangular only** |
| D2 | Joist direction convention | User always asks / default perpendicular-to-boards | **Default with disclosure** |
| D3 | Default joist spacing | Mandatory ask / 450 mm default / 600 mm default | **450 mm Quotr default** (disclosed) — confirm NZ practice |
| D4 | Joist count formula | `ceil(span/centres) + 1` vs other boundary rule | Confirm +1 both boundaries |
| D5 | Supports unit | EA only (MVP) / LM when height derivable | **EA for MVP** |
| D6 | Corner post dedup | Deduplicate shared posts / count per bearer | **Deduplicate** — define rule |
| D7 | Blocking in MVP | Deterministic rows / allowance / defer | **Defer or 0 rows default** |
| D8 | Structural fixings depth | EA deterministic / m² allowance / defer | **m² allowance initially** |
| D9 | Substructure commercial grouping | Per-child authority / parent group | **Parent group `deck.substructure`** |
| D10 | Reference fixture 16.12 m² | Choose L×W, sections, spacing, footings | **Owner to specify** |
| D11 | Approved timber sections | 90×45, 140×45, 190×45, post sizes | Confirm MVP list (no 200×50 until approved) |
| D12 | Framing waste default | Use org `timber_framing_wastage_percent` / fixed % | **Org setting with 5% fallback** |

---

## Review checklist

- [x] DECK-STRUCT-01 accepted
- [x] Rectangular-only MVP with area-only legacy fallback accepted
- [x] Bearer direction corrected (perpendicular to joists)
- [x] Rim topology corrected (end rim only, no 2L+2W double count)
- [x] No corner post deduction in MVP layout
- [x] Blocking deferred from DECK-1B
- [x] No universal member/treatment defaults
- [x] DECK-REF-01 synthetic fixture locked
- [x] Partial child emission accepted
- [x] Parent group `deck.substructure` accepted

---

## On approval

| Item | Status |
| --- | --- |
| DECK-1A | COMPLETE / OWNER MODEL APPROVED |
| DECK-1B | READY TO START |
| Estimate money | Unchanged until DECK-1R |

---

## On rejection

Revise model contract per Owner feedback. Do not start DECK-1B.

---

## Explicit non-actions

This gate does **not** approve:

- Authority promotion of structural components
- Legacy `deck.substructure.m2` retirement
- Production deploy
- Migration 037+
- Materials UI
- `deck.labour` promotion
