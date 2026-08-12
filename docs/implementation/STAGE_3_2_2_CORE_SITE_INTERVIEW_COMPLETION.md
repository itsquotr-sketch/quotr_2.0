# Stage 3.2.2 — Core Project/Site Interview Completion

**Status:** Complete Local — Owner Preview (R2 Complete Local / Owner Preview Pending)  
**Date:** 2026-08-12  
**Branch:** `hardening/stage-2a-security`

---

## Delivered

- Project Conditions ASK card wired to `buildBuilderInterviewCandidates`
- PROJECT-scope filter only (WA deferred to 3.2.3)
- Batch save via `saveBuilderInterviewProjectAnswers` → `constraints`
- Conflict Keep/Replace (D13)
- Not sure / Skip / Assumption-deferred semantics
- Site Constraints summary mode + R5 fallback suppression when BI usable
- Scope Details project-wide suppress fix (`occupied_site`; live `constraints` load)
- Quick Estimate project-information readiness (presentation only)
- Attention Review → Project Conditions
- Performance marks: `builder_interview_*`
- Verify: `scripts/verify-stage-3-2-2-core-site-interview.ts`

---

## Naming defects fixed

| Incorrect | Canonical | Where fixed |
| --- | --- | --- |
| `project_constraints` | `constraints` | `lib/assistant/actions.ts`, `missing-questions.ts` |
| `site_occupied` | `occupied_site` | `lib/scopes/questions.ts` |

---

## Explicit non-goals (honoured)

- No migration
- No Work Area interview UI
- No Generate soft-block
- No Company DNA
- No Production Scope Discovery enablement
- No formula / AI changes
- Dead `inferConstraintsFromFacts` / `buildScopeDrivenConstraints` not revived

---

## Stage status

| Item | Status |
| --- | --- |
| 3.2.0 | Complete Planning |
| 3.2.0-R1 | Complete |
| 3.2.1 | Complete |
| **3.2.2** | **Complete Local** |
| 3.2.2 Owner Preview | Pending |
| 3.2.3+ | Not Started |
| Production Scope Discovery | Disabled |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |

Do **not** mark global Stage 3.2 Complete.

---

## Next action

Owner Preview Test using `docs/runbooks/STAGE_3_2_2_CORE_SITE_INTERVIEW_PREVIEW_TEST.md`.
