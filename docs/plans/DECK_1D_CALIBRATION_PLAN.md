# DECK-1D Calibration Plan

**Status:** PLANNING — DECK-1D IN PROGRESS / DECK-1D-A **COMPLETE / OWNER CALIBRATION MODEL VALIDATED** / DECK-1D-B **COMPLETE LOCAL / OWNER FIXTURE REVIEW PENDING**  
**Date:** 2026-08-18  
**Owner gate:** `docs/runbooks/DECK_1D_A_OWNER_CALIBRATION_GATE.md`  
**Audit:** `docs/audits/DECK_1D_LEGACY_SUBSTRUCTURE_DECOMPOSITION.md`  
**Contract:** `docs/architecture/DECK_STRUCTURAL_CALIBRATION_CONTRACT.md`  
**Handoff:** `docs/plans/DECK_1D_STRUCTURAL_CALIBRATION_HANDOFF.md`

DECK-1C remains **COMPLETE FOR INITIAL STRUCTURAL TIMBER RATE COVERAGE**. Owner D1–D9 locked. DECK-1D-B is calibration fixtures/diagnostics only — no promotion, no new prices, no DECK-3.

---

## 1. Batch split

| Batch | Name | Status |
| --- | --- | --- |
| **DECK-1D-A** | Current-state audit + calibration contract | **COMPLETE / OWNER CALIBRATION MODEL VALIDATED** |
| **DECK-1D-B** | Synthetic fixtures + comparison diagnostics | **COMPLETE LOCAL / OWNER FIXTURE REVIEW PENDING** |
| **DECK-1D-C** (optional) | REAL-JOB ingest | After Owner supplies jobs — **required before promotion** |
| **DECK-1R** | Authority promotion | Blocked: real-job + economic-hole gate + Owner signoff |

---

## 2. DECK-1D-A outcomes (Owner-validated)

- Legacy `$120/m²` package classified as **generic materials package** (LIKELY BUNDLED members; not a takeoff).
- Related legacy lines mapped; double-count risks named.
- Coverage matrix: 3 children priceable; supports/concrete unpriced = **ECONOMIC_GAP**, not excluded.
- Labour = combined generic Deck lump; materials may mature before DECK-3.
- Fixings = separate legacy catch-all.
- Blocking deferred = **NOT_MODELLED**, not $0.
- Future parent group: Framing/substructure (not implemented in 1D-B).
- No percentage tolerance.
- **No commercial promotion may create an economic hole.**
- Synthetic fixtures now; REAL-JOB required before promotion.

---

## 3. DECK-1D-B scope (after planning commit)

In scope:

- Synthetic JSON fixtures: SIMPLE / MEDIUM / ELEVATED / PARTIAL-SPEC / CUSTOM-MATERIAL
- REAL-JOB template/schema only (no invented job data)
- Non-production comparison engine + economic-gap detector
- Verifier

Out of scope:

- New structural cost components or formulas
- New Quotr timber / support / concrete / connector prices
- Authority promotion / parent-group implementation
- DECK-3
- Materials table / migration
- Production SD / Production deploy

---

## 4. Legacy retirement path (reaffirmed)

```
LEGACY_AUTHORITATIVE
  → SHADOW
  → REQUIREMENT_AUTHORITATIVE
  → LEGACY_FALLBACK
  → LEGACY_RETIRED
```

Do not skip phases. `UNPRICED` must not become a silent skip of SHADOW→authoritative with an economic hole.

---

## 5. Commercial freeze during DECK-1D

| Lock | Value |
| --- | --- |
| Deck 1 golden | **$48,340** — no restamp |
| Fence 2 / Pergola 1 / RW 2 | Unchanged |
| Structural children | SHADOW |
| `decking.surface` | REQUIREMENT_AUTHORITATIVE |
| `deck.labour` | SHADOW |
| Production SD | DISABLED |

---

## 6. Success for DECK-1D (programme)

Owner can answer, with evidence:

1. What the $120 package is (and is not).
2. Why timber-only $924.71 on RATE-REF-01 is incomplete (**not savings**).
3. Which required unpriced buckets are **ECONOMIC_GAP**.
4. Synthetic fixture set exists; REAL-JOB template ready for Owner data.
5. Material/substructure comparison is labelled separately from labour.
