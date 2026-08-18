# DECK-1D-B Owner Fixture Gate

**Status:** COMPLETE LOCAL / OWNER FIXTURE REVIEW PENDING  
**Date:** 2026-08-18  
**Implementation:** `docs/implementation/DECK_1D_B_CALIBRATION_FIXTURE_COMPLETION.md`  
**Verify:** `npx tsx scripts/verify-deck-1d-b-calibration-fixtures.ts`

This gate does **not** authorise promotion, new prices, DECK-3, or Production deploy.

---

## Review checklist

- [ ] SIMPLE-01 numbers match (16.12 m², $1,934.40 package, $924.71 partial timber)
- [ ] Supports/concrete shown as UNPRICED ECONOMIC_GAP, not excluded, not $0
- [ ] Scope requirement is distinct from model/economic state (`REQUIRED` / `NOT_REQUIRED` / `UNKNOWN`)
- [ ] MEDIUM-01 scale comparison is directional only
- [ ] ELEVATED-01 surfaces post-length / bracing / connector limits; confidence LOW
- [ ] PARTIAL-SPEC does not auto-enrich SG8/H3.2/KD
- [ ] CUSTOM 200×50 is valid and unpriced on joists/rim
- [ ] REAL-JOB-TEMPLATE is a blank schema — no invented job
- [ ] Fixings and Deck labour remain separate lines
- [ ] Fixings remain commercially covered by legacy catch-all, even though connectors are not yet decomposed
- [ ] Goldens unchanged

---

## After Owner review

If accepted: commit DECK-1D-B separately (`feat(deck): add structural calibration fixture diagnostics` or similar).

Next: Owner supplies anonymized REAL-JOB data (required before any promotion). Do not start DECK-1R.
