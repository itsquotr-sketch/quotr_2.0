# DECK-1D-B — Calibration Fixture Completion

**Status:** COMPLETE LOCAL / OWNER FIXTURE REVIEW PENDING  
**Date:** 2026-08-18  
**HEAD (1D-A planning):** `c23b3efc46c96502c7a6cde1e55342e571f820dd`  
**Owner model:** `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`  
**Verify:** `npx tsx scripts/verify-deck-1d-b-calibration-fixtures.ts`

Diagnostic fixtures + comparison engine only. **No authority promotion. No new prices. No DECK-3. No production calculator change.**

---

## What shipped

| Path | Role |
| --- | --- |
| `tests/fixtures/deck-calibration/*.json` | Deterministic fixtures + REAL-JOB template |
| `scripts/deck-calibration/types.ts` | Diagnostic types |
| `scripts/deck-calibration/run-deck-calibration.ts` | Read-only comparison + economic-gap detector |
| `scripts/verify-deck-1d-b-calibration-fixtures.ts` | Verifier |

The runner calls existing `calculateEstimate`. It does not register authority, attach rates, or emit new components.

---

## Fixture set

| ID | Class | Intent |
| --- | --- | --- |
| SIMPLE-01 | SIMPLE | DECK-RATE-REF-01 geometry; height 0.25 m; KD spec |
| MEDIUM-01 | MEDIUM | 7.00 × 5.00; height 0.80 m; 3 bearer rows (explicit assumption) |
| ELEVATED-01 | ELEVATED | 6.00 × 4.00; height 1.50 m; post length **not** invented |
| PARTIAL-SPEC-01 | PARTIAL-SPEC | SIMPLE geometry; no grade/treatment/processing |
| CUSTOM-MATERIAL-01 | CUSTOM-MATERIAL | 200×50 joists/rim |
| REAL-JOB-TEMPLATE | REAL-JOB | Schema only — no invented job |

Comparison label: **MATERIAL / SUBSTRUCTURE COMPARISON**.

---

## Economic-gap detector

Required + (`UNPRICED` or `NOT_MODELLED`) without ALLOWANCE / LEGACY_FALLBACK / project-company rate → **ECONOMIC_GAP**.

`NOT_REQUIRED` does not flag. `priced=false` is UNPRICED, not excluded. Missing buckets are never $0.

Scope requirement is tracked separately from model/economic state:

- `REQUIRED`
- `NOT_REQUIRED`
- `UNKNOWN`

Blocking/trimmers: **NOT_MODELLED** + **KNOWN_MODEL_GAP** (not auto-promoted to ECONOMIC_GAP).

Fixings: **LEGACY CATCH-ALL** (`deck.fixings.m2`), separate from `deck.substructure`.

Labour: **CURRENT LABOUR AUTHORITY**, not in the child subtotal.

---

## SIMPLE-01 snapshot

- Area 16.12 m²; legacy substructure **$1,934.40**
- PARTIAL PRICED STRUCTURAL CHILD COST **$924.71**
- Supports 8 EA UNPRICED ECONOMIC_GAP; concrete 0.324 m³ UNPRICED ECONOMIC_GAP
- Status **PARTIAL_COVERAGE**; economic completeness **INCOMPLETE**
- Difference vs package is **not a cost reduction** (legacy cost provenance unknown; directional comparison only)

## MEDIUM-01 snapshot

- Area 35.00 m²; legacy substructure **$4,200.00**
- PARTIAL PRICED STRUCTURAL CHILD COST **$1,818.69** (joists 89.25 / rim 14.70 / bearers 22.05)
- Supports 12 EA UNPRICED; concrete 0.486 m³ UNPRICED
- Legacy $/m² **stable** at 120; priced timber $/m² **shrinking** 57.36 → 51.96 (directional; do not infer correctness)

---

## Non-actions

No commit of DECK-1D-B in the same batch as 1D-A. No Production deploy. No materials table. No migration.
