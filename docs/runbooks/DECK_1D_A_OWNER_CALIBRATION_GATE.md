# DECK-1D-A Owner Calibration Gate

**Status:** COMPLETE / OWNER CALIBRATION MODEL VALIDATED  
**Date:** 2026-08-18  
**HEAD (planning close):** apply on current `b432dfbdd4dee296bbde7b8cf7a5f9551068b952` tree  
**Audit:** `docs/audits/DECK_1D_LEGACY_SUBSTRUCTURE_DECOMPOSITION.md`  
**Contract:** `docs/architecture/DECK_STRUCTURAL_CALIBRATION_CONTRACT.md`

Owner closed D1–D9. This gate authorises **DECK-1D-B calibration fixtures/diagnostics only**. It does **not** authorise promotion, new prices, DECK-3, materials table, migration, or Production deploy.

---

## Locked already (do not reopen)

- Structural children remain SHADOW
- `deck.substructure.m2` remains commercial money ($120 / $180 per m² fallback)
- PARTIAL PRICED STRUCTURAL CHILD COST is diagnostic only
- Quotr timber benchmarks remain the three KD identities only
- Deck 1 golden $48,340 — no restamp
- Production SD DISABLED
- **UNPRICED ≠ EXCLUDED** (see terminology lock in the calibration contract)
- **NO COMMERCIAL PROMOTION MAY CREATE AN ECONOMIC HOLE**

---

## Owner decisions (closed)

### D1 — Real-job availability — CLOSED

**Proceed with synthetic calibration fixtures now.**

REAL-JOB calibration remains **REQUIRED before any commercial authority promotion**. Lack of real-job data does **not** block DECK-1D-B fixture implementation.

Create a ready-to-fill REAL-JOB fixture contract. Do not invent real-job data.

### D2 — Labour sequencing — CLOSED

**Material/substructure authority may mature independently from DECK-3.**

Existing generic Deck labour remains the current labour commercial source. Calibration must label **MATERIAL / SUBSTRUCTURE COMPARISON** and must not imply DECK-3 labour is inside detailed structural material children.

Do not start DECK-3.

### D3 — Supports — CLOSED

`deck.supports` remains physical EA, unpriced. **Do not add a benchmark in DECK-1D-B. Do not invent post length.**

If supports are required and price is unresolved: this is an **economic coverage gap** (`UNPRICED` / `ECONOMIC_GAP`).

Later handling may be: project/company rate, explicit allowance, legacy fallback bucket, or quote-blocking pricing-required.

It is **NOT** a valid “exclusion” merely because pricing is unknown.

### D4 — Concrete — CLOSED

Same principle as supports. Required concrete + unknown price = **economic coverage gap**.

Do not add a benchmark. Do not bag-convert.

Future options: allowance, project/company rate, known mix + procurement model, legacy fallback. DECK-1D-B diagnostics only.

### D5 — Fixings — CLOSED

Keep `deck.fixings.m2` as the **active legacy catch-all**. Do not add detailed structural connector money.

Audit/comparison must treat this line **separately** from `deck.substructure`. Split surface vs structural remains UNKNOWN.

### D6 — Blocking / trimmers — CLOSED

**Defer physical modelling.** Record as **known missing structural scope** where applicable. Do not treat missing model as zero quantity/cost (`NOT_MODELLED` / `KNOWN_MODEL_GAP`).

### D7 — Parent / group authority — CLOSED

Future preferred architecture:

- detailed internal structural children
- → parent commercial group: **Framing/substructure**
- customer-facing quote remains grouped where practical

**Do not implement this authority change in DECK-1D-B.**

### D8 — Variance tolerance — CLOSED

**Do not lock a generic percentage tolerance.** No ±10% / ±20% promotion rule.

Calibration first determines: normal variance, missing-bucket effects, fixture scaling, real-job direction.

### D9 — Promotion gate — CLOSED (draft, not executed)

Approve the draft gate **plus**:

**NO COMMERCIAL PROMOTION MAY CREATE AN ECONOMIC HOLE.**

If a required cost bucket is not physically/deterministically priced, it must be:

- **A.** legitimately outside project scope (`NOT_REQUIRED` / EXCLUDED)
- **B.** covered by explicit allowance
- **C.** covered by safe retained legacy fallback
- **D.** resolved by project/company rate
- **E.** treated as a blocking pricing-required condition (`UNPRICED`)

Required-but-unpriced may **NOT** silently disappear.

Promotion does **not** require every physical edge case to have a perfect takeoff. Promotion **does** require every commercially material required cost to be represented by: detailed requirement, explicit allowance, safe legacy fallback, project/company rate, or quote-blocking pricing-required state.

---

## Terminology lock (Owner)

| Term | Meaning |
| --- | --- |
| **EXCLUDED / NOT_REQUIRED** | Project genuinely does not require that work/material (e.g. existing supports retained) |
| **UNPRICED** | Project requires it; Quotr has no trustworthy cost |
| `priced=false` | **UNPRICED**, not excluded |

---

## Explicit non-actions (still)

- Do not promote structural requirements
- Do not change legacy Deck substructure money
- Do not add more Quotr prices
- Do not start DECK-3
- Do not create a materials table or migration
- Do not deploy Production
