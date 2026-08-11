# Stage 3.2 — Builder Interview — Planning Handoff

**Status:** Not Started — Planning recommended before implementation  
**Date:** 2026-08-11  
**Prerequisite:** Stage 3.1B Complete — Preview Validated (`docs/implementation/STAGE_3_1B_CLOSURE.md`)  
**Canonical roadmap:** `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`

---

## Intent (from roadmap)

**Stage 3.2 — Builder Interview**

Structured interview capture aligned with constraints and DNA evidence.

Related backlog: **FEAT-003** Additional site constraints taxonomy (Deferred → 3.2).

---

## Why this is next

Completed Stage 3 components:

- **3.1A / 3.1A-R1** — Product stabilisation / Preview remediation  
- **3.1D** — Domain model refinement (Fact SoT)  
- **3.1C** — Auth + first-run Setup (Preview Validated)  
- **3.1B** — Intelligent Scope Discovery (Preview Validated)

Roadmap sequence places **3.2 Builder Interview** immediately after 3.1B.  
Company DNA and commercial assemblies (3.3/3.4/Later) remain later.

PERF-FUTURE-01 is a **parallel measured optimisation track**, not a substitute for 3.2 product work, and is **not** a release blocker for starting 3.2 planning.

---

## Purpose

Extend structured capture beyond today’s fixed constraint templates so contractors can express:

- site conditions  
- access / logistics nuance  
- exclusions / assumptions  
- interview answers that feed Scope Discovery + estimating without inventing commercial formulas  

Prepare evidence shapes compatible with future Company DNA — without implementing DNA.

---

## Dependencies

| Dependency | Status |
| --- | --- |
| Scope Discovery Preview validated | Met (3.1B) |
| Constraint template model | Exists (limited taxonomy) |
| Fact SoT / Question→Fact pipeline | Met (3.1D) |
| Production Scope Discovery | Still Disabled — independent gate |
| Company DNA | Not Started — must not be smuggled into 3.2 |

---

## Owner decisions required before implementation

1. Interview scope: which domains (Deck / Bathroom / Fitout / general site) in v1?  
2. Taxonomy: expand FEAT-003 keys now vs phased?  
3. UI placement: Assistant stage vs Setup vs project capture?  
4. Authority: interview answers → Facts / constraints / assumptions — which writes are allowed?  
5. Commercial boundary: confirm no formula changes; no silent rate mutation.  
6. Production: keep Scope Discovery Preview-only until separate enablement?  
7. Sequencing vs PERF-FUTURE-01: parallel track OK?

---

## Recommended first implementation batch

**3.2.0 — Builder Interview Audit & Specification (docs only)**

Deliverables:

- Current constraint / interview surface inventory  
- Gap analysis vs Owner site-condition language  
- Proposed interview contract (questions → Facts/constraints)  
- Boundary vs Scope Discovery / Scope Details / DNA  
- Owner decision register  
- Latency/UX notes (link PERF-FUTURE-01 where relevant)  

**Do not** implement interview UI or migrations until 3.2.0 is approved.

---

## Explicit non-goals for first batch

- Company DNA  
- Production Scope Discovery enablement  
- Commercial formula changes  
- Broad Assistant redesign  
- Implementing PERF-FUTURE-01  
