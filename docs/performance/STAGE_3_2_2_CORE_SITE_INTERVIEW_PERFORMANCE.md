# Stage 3.2.2 — Core Project/Site Interview Performance

**Status:** Observational baseline  
**Date:** 2026-08-12

---

## Marks added

| Mark | Meaning |
| --- | --- |
| `builder_interview_load` | Card / snapshot load path |
| `builder_interview_candidate_build` | Pure engine + PROJECT filter |
| `builder_interview_batch_save_ack` | Server action returned |
| `builder_interview_batch_save_complete` | Client save cycle complete |
| `builder_interview_recompute` | Post-save candidate rebuild |

Metadata only: elapsed, candidate count, write count, ok/fail.  
**Never** logs answers, brief text, or commercial values.

---

## Expected characteristics

- Candidate build: sub-ms to low-ms (pure; Fitout ~0.1ms engine baseline from 3.2.1)
- Batch save: one server round-trip for N answers
- Recompute: once per confirmed batch
- No AI call
- No per-answer `router.refresh`

---

## Findings (local)

- Engine recompute remains cheap; UI cost dominated by network/auth on batch save
- Disclosure prefers keeping Project Conditions open after save (no yank-collapse)
- Stage unlock to `ready_to_estimate` is a single empty `saveConstraints` when BI layer activates — avoids trapping Generate behind a duplicate questionnaire

Update companion: `docs/performance/ASSISTANT_RESPONSIVENESS_LATENCY_OPTIMISATION_PASS.md`
