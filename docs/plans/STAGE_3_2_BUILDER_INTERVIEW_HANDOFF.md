# Stage 3.2 — Builder Interview — Planning Handoff

**Status:** Superseded for execution planning by `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`  
**3.2.0:** **Complete Planning** (2026-08-11)  
**3.2.1:** **Awaiting Owner Decisions**  
**Date:** 2026-08-11  
**Prerequisite:** Stage 3.1B Complete — Preview Validated (`docs/implementation/STAGE_3_1B_CLOSURE.md`; baseline `441f36c`)  
**Canonical roadmap:** `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`  
**Owner decisions:** `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md`

---

## Intent (from roadmap)

**Stage 3.2 — Builder Interview**

Structured interview capture aligned with constraints and DNA evidence.

Related backlog: **FEAT-003** Additional site constraints taxonomy (Deferred → 3.2; taxonomy designed in 3.2.0).

---

## Why this is next

Completed Stage 3 components:

- **3.1A / 3.1A-R1** — Product stabilisation / Preview remediation  
- **3.1D** — Domain model refinement (Fact SoT)  
- **3.1C** — Auth + first-run Setup (Preview Validated)  
- **3.1B** — Intelligent Scope Discovery (Preview Validated)

Roadmap sequence places **3.2 Builder Interview** immediately after 3.1B.  
Company DNA and commercial assemblies (3.3/3.4/Later) remain later.

PERF-FUTURE-01 is a **parallel measured optimisation track**, not a substitute for 3.2 product work, and is **not** a release blocker for starting 3.2 planning or 3.2.1 after owner decisions.

---

## 3.2.0 deliverables (complete)

| Document | Path |
| --- | --- |
| Capture audit | `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md` |
| Architecture | `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md` |
| Question contract | `docs/specifications/QUOTR_BUILDER_INTERVIEW_QUESTION_CONTRACT.md` |
| Constraint taxonomy | `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md` |
| Estimate readiness | `docs/specifications/QUOTR_ESTIMATE_READINESS_MODEL.md` |
| Implementation plan | `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md` |
| Owner decisions | `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` |

---

## Next action

1. Owner reviews and approves `STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` (D1–D10).  
2. Only then begin **3.2.1** (deterministic candidate engine — no UI).

**Do not** implement interview UI, migrations, Fact changes, formula changes, Production Scope Discovery, or Company DNA until authorised.

---

## Explicit non-goals (still)

- Company DNA  
- Production Scope Discovery enablement  
- Commercial formula changes  
- Broad Assistant redesign  
- Implementing PERF-FUTURE-01 as a substitute for 3.2  
- Beginning 3.2.1 before owner decisions  
