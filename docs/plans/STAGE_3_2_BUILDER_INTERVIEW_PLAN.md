# Stage 3.2 — Builder Interview Implementation Plan

**Status:** Stage 3.2.1 Complete Local (engine); 3.2.2 Not Started  
**Date:** 2026-08-12  
**Prerequisite:** Stage 3.1B Complete — Preview Validated (`441f36c`)  
**Architecture:** `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`  
**Owner decisions:** `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` (D1–D16 **OWNER APPROVED**)  
**Audit:** `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md`  
**Reconciliation:** `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`  
**3.2.1 engine:** `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`  

**Hard stops until Owner approves decisions:** ~~no 3.2.1 code~~ — **D1–D16 OWNER APPROVED; 3.2.1 Complete Local.** Still: no migrations in 3.2.1 (done); no UI until 3.2.2; no Fact/formula changes; Production Scope Discovery remains Disabled; Company DNA remains Not Started; **do not start 3.2.2 until authorised.**

---

## 1. Stage goal

Make Quotr substantially better at understanding a real construction job before pricing it — via a progressive, Fact/Constraint-aware Builder Interview — without duplicating Scope Details, replacing Scope Discovery, or implementing Company DNA.

---

## 2. Batch structure

### 3.2.0 — Audit & Specification

| Field | Value |
| --- | --- |
| **Status** | **Complete Planning** (2026-08-11) |
| **Purpose** | Document current capture pipeline, Fact/constraint gaps, question contract, taxonomy, readiness, placement, examples, owner decisions |
| **Migrations** | None |

### 3.2.0-R1 — Architecture reconciliation & owner decision gate

| Field | Value |
| --- | --- |
| **Status** | **Complete — Docs only** (2026-08-12) |
| **Purpose** | Verify Claude findings against repo; reconcile Fact/Constraint direction, authority, conflict, invalidation, recompute, provenance, schema; expand D11–D16; lock 3.2.1 contract on paper |
| **Migrations** | None |
| **Code** | None (behaviour unchanged) |

### 3.2.1 — Deterministic Candidate Engine

| Field | Value |
| --- | --- |
| **Status** | **Complete — Local** (2026-08-12) |
| **Purpose** | Encode versioned interview registry + pure candidate generation (trigger/suppress/rank) + readiness derivation; **no UI** |
| **Modules** | `lib/builder-interview/**` (pure); verify `scripts/verify-stage-3-2-1-builder-interview-candidate-engine.ts` |
| **Migrations** | **None** |
| **Docs** | `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`; completion + performance baseline |
| **Owner decisions** | D1–D16 **OWNER APPROVED** |

#### 3.2.1 implementation contract (proposed boundary)

**Inputs (project snapshot, read-only):**

- Confirmed Work Areas (`id`, `type`, `status`)
- `project_facts` records (key, work_area_id, value, source)
- `constraints` records (key, value, source)
- Project quality_level (for inheritance suppress only)
- Optional: excluded scope item types (when ISD data present)
- Optional: calculator `missingInfo` key mappings (static map; no live estimate required)
- Registry version constant

**Outputs:**

- Ordered list of `InterviewCandidate` objects (ephemeral; not persisted in 3.2.1)
- Aggregate counts by priority class
- Derived readiness hints: open P0 count, open P1 count, assumption-cleared flags (pure; no DB writes)

**Candidate structure (minimum):**

| Field | Meaning |
| --- | --- |
| `question_key` | Stable registry id |
| `domain` | Contract domain enum |
| `scope` | `project` \| `work_area` |
| `work_area_id` / `work_area_type` | When WA-scoped |
| `write_target` | `constraint` \| `fact` \| `assumption_only` |
| `target_key` | Constraint key or Fact key |
| `priority_class` | P0–P3 |
| `ask_policy` | ASK \| ASSUME \| BENCHMARK \| DEFER \| FLAG |
| `input_type` / `options` | For later UI |
| `question` / `reason_for_asking` | Copy |
| `suppress_reasons` | Why siblings closed (debug/test) |
| `registry_version` | Version string |

**Suppression rules:**

- `suppress_if_known`: target key already has meaningful value (not empty / Not sure where configured)
- Project constraint answer suppresses WA semantic clones (access, carry, occupied, …)
- Scope Details ownership: DEFER disposition keys never become ASK candidates
- ISD / Scope Review existence topics → FLAG only (not interview ASK)
- Conditional `depends_on` / trigger failure → omit child
- Excluded WA / excluded scope item → omit

**Ranking:**

```
base priority_class
  × relevance (WA/scope match)
  × unknown severity
  − already_partially_known
  + calculator_missingInfo_match
```

Return stable sort: P0 → P1 → P2 → P3, then domain, then registry order.

**P0–P3 behaviour (engine-only in 3.2.1):**

| Class | Engine behaviour |
| --- | --- |
| P0 | Included when unknown + triggered; counted as estimate-blocking for readiness hint |
| P1 | Included when unknown + triggered; high impact; not hard-blocking in hints |
| P2 | Included up to soft cap; skippable |
| P3 | Optional; may be omitted when batch budget exceeded |

**Ask / assume / defer / flag semantics:**

| Policy | 3.2.1 meaning |
| --- | --- |
| ASK | Emitted as candidate when unknown + relevant |
| ASSUME | Not emitted as ask; may contribute to “system may assume” metadata for later |
| BENCHMARK | Not emitted; catalogue default implied |
| DEFER | Not emitted; owned by Scope Details / Constraints UI |
| FLAG | Not emitted as ask; may appear in separate flag list for attention routing tests |

**Project-vs-WA deduplication:**

- One candidate per semantic topic at project scope when project target unknown
- WA clone candidates only if registry allows override and project target unknown or `differs` trigger
- Fitout: project logistics pack preferred; no per-WA access fan-out when project answered

**Write targets (declared only — no writes in 3.2.1):**

- Site topics → constraint keys in `RESERVED_CONSTRAINT_KEYS` / approved taxonomy
- WA overrides → Fact keys
- Engine must refuse candidates whose `target_key` violates namespace rules (`canWriteKeyToFacts` / `canWriteKeyToConstraints`)

**Performance requirements:**

- Pure CPU on in-memory snapshot; target well under interactive budget (no I/O)
- No AI
- Idempotent: same snapshot → same candidate list
- Cooperate with PERF-FUTURE-01: do not introduce refresh/remount in this batch (no UI)

**Tests (verify script + unit fixtures):**

- Deck: access/carry known → those candidates suppressed
- Bathroom: occupied/services/hazmat candidacy when unknown
- Fitout multi-WA: single project access candidate; no N× `*.access` ASK clones when project `site_access` set
- Conditional child omitted when parent false
- Reserved constraint keys never proposed as Fact write targets
- Ranking stable / P0 before P2
- Registry version stamped on outputs

**Explicit non-goals for 3.2.1:**

- No UI / Assistant card
- No server actions / persistence / migrations
- No Scope Details template edits (suppression hooks deferred to 3.2.2+)
- No soft-block generate UX (3.2.4)
- No formula / rate / DNA / ISD production enablement
- No revival/delete of dead `buildScopeDrivenConstraints` unless needed for shared helpers (prefer not in 3.2.1)
- No fix of `project_constraints` / `site_occupied` defects in this batch unless required for pure fixture inputs (prefer document; fix in 3.2.2 wiring)

---

### 3.2.2 — Core project/site constraint interview

| Field | Value |
| --- | --- |
| **Purpose** | Wire ask-layer for CORE project site topics into Assistant (small batch UX); write Constraints |
| **Migrations** | Taxonomy key additions only if D4 approves (app allowlist; DB migration still not required) |
| **Prereq fixes** | Correct constraint load table name; occupied key mismatch — so suppression works |

### 3.2.3 — Work-Area-aware interview

| Field | Value |
| --- | --- |
| **Purpose** | WA overrides + conditional WA questions; suppress project-known topics in Scope Details generation |

### 3.2.4 — Assumption / readiness integration

| Field | Value |
| --- | --- |
| **Purpose** | READY / READY WITH ASSUMPTIONS / NEEDS IMPORTANT INFORMATION derived view; assumption records; QE soft-block + attention routing to interview |

### 3.2.5 — Multi-WA + mobile UX

| Field | Value |
| --- | --- |
| **Purpose** | Grouped batches, thumb-friendly controls, interruption-safe resume |

### 3.2.6 — Preview E2E

| Field | Value |
| --- | --- |
| **Purpose** | Owner Preview validation Deck / Bathroom / Fitout; close 3.2 Preview gate |

---

## 3. Sequencing vs PERF-FUTURE-01

- PERF-FUTURE-01 remains a **parallel measured optimisation track**.
- 3.2 must not worsen latency (deterministic candidates; batch writes; no per-answer AI; no remount).
- Do not block 3.2.1 on PERF-FUTURE-01 completion.
- Share measurement hooks where practical.

---

## 4. Worked examples

### A. Deck

**KNOWN BEFORE INTERVIEW** (typical after Analyse Job + Constraints recognition):

- WA: Deck (+ maybe demolition/removal flags)
- Facts: length/width/area or partial; existing removal; balustrade excluded
- Constraints: site_access, material_carry_distance often inferred

**QUESTIONS GENERATED** (if still unknown):

- P0/P1: primary dimensions if missing  
- P1: substructure condition if removal/rebuild ambiguous  
- P1: carry/access only if not already constrained  

**SUPPRESSED:**

- Per-WA access clones  
- Screw spacing / brand  
- Paint questions  

### B. Bathroom renovation

**KNOWN:** bathroom WA; area; renovation_type; some fixture flags  

**GENERATED:** occupied_site; services_isolated; hazmat if age unknown; carry if demolition_required  

**SUPPRESSED:** tile brand; duplicate access if project answered; Scope Review existence items  

### C. Commercial Fitout

**KNOWN:** 7+ WAs; many Scope Details; project brief commercial  

**GENERATED (project):** site_access, material_carry_distance, floor_level, occupied_site, working_hours, parking_loading / loading_zone  

**GENERATED (WA):** demolition services/hazmat only if unknown  

**SUPPRESSED:** access questions on walls, ceilings, flooring, painting, doors once project answered  

---

## 5. Migration expectations

| Batch | Expectation |
| --- | --- |
| 3.2.0 / 3.2.0-R1 | None |
| 3.2.1 | **None** |
| 3.2.2+ | Optional constraint key allowlist expansion (D4) — app code; optional assumption provenance table only if D16 later upgraded |
| Any migration | Explicit owner approval; RLS required; no commercial formula columns |

---

## 6. Security implications (stage-wide)

- Interview writes go through existing org-scoped server actions / RLS.
- Allowlist question → fact/constraint keys (no arbitrary key writes).
- No client-authored AI commercial questions.
- Minimise data sent if AI ranking added later (reuse ISD minimisation principles).
- Do not expose raw question_keys as primary UI copy.

---

## 7. Regression gates (stage-wide)

- Stage 2A/2B commercial goldens unchanged  
- Fact SoT / constraint reserved key tests  
- Scope Discovery production remains Disabled  
- Analyse Job unchanged  
- Multi-WA Fitout: no duplicate access interrogation  
- Assistant latency smoke vs PERF baseline notes  

---

## 8. First implementation domains (recommendation for D10)

1. Project SITE_ACCESS / LOGISTICS (existing 14 constraints)  
2. Demolition / reno risk overlays  
3. Deck + Bathroom + Fitout relevance packs  
4. Defer deep trade-interface interview beyond existing Facts  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md` |
| Supersedes for execution planning | `STAGE_3_2_BUILDER_INTERVIEW_HANDOFF.md` (handoff retained as pointer) |
| 3.2.1 | **Complete — Local** |
| 3.2.2 | **Not Started** |
