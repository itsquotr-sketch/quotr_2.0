# Stage 3.2.1 — Candidate Engine Performance Baseline

**Status:** Recorded  
**Date:** 2026-08-12  
**Environment:** Local Windows; `npx tsx scripts/verify-stage-3-2-1-builder-interview-candidate-engine.ts`  
**Method:** 50 in-process runs per fixture; `performance.now()` wall average  

**Not an SLA.** Measure before optimising (D9 / D15). PERF-FUTURE-01 remains a separate track.

---

## Results (representative run)

| Fixture | Confirmed WAs | Candidates | Suppressed | Avg runtime |
| --- | ---: | ---: | ---: | ---: |
| Deck | 2 | 7 | 22 | ~0.05 ms |
| Bathroom | 2 | 7 | 22 | ~0.04 ms |
| Commercial Fitout | 7 | 3 | 26 | ~0.11 ms |

Smoke gate in verify: Fitout average **&lt; 50 ms** (passes by large margin).

---

## Implications

- Full in-memory recompute per approved boundary is inexpensive for multi-WA jobs.
- No incremental cache required in 3.2.1.
- UI integration must still avoid remount / refresh storms (D9) — engine cost is not the bottleneck.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/performance/STAGE_3_2_1_CANDIDATE_ENGINE_BASELINE.md` |
