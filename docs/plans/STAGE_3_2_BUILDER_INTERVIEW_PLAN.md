# Stage 3.2 — Builder Interview Implementation Plan

**Status:** Stage 3.2.0 Complete Planning  
**Date:** 2026-08-11  
**Prerequisite:** Stage 3.1B Complete — Preview Validated (`441f36c`)  
**Architecture:** `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`  
**Owner decisions:** `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md`  
**Audit:** `docs/audits/STAGE_3_2_CURRENT_INFORMATION_CAPTURE_AUDIT.md`  

**Hard stops until Owner approves decisions:** no 3.2.1 code; no migrations; no UI; no Fact/formula changes; Production Scope Discovery remains Disabled; Company DNA remains Not Started.

---

## 1. Stage goal

Make Quotr substantially better at understanding a real construction job before pricing it — via a progressive, Fact/Constraint-aware Builder Interview — without duplicating Scope Details, replacing Scope Discovery, or implementing Company DNA.

---

## 2. Batch structure

### 3.2.0 — Audit & Specification

| Field | Value |
| --- | --- |
| **Status** | **Complete Planning** |
| **Purpose** | Document current capture pipeline, Fact/constraint gaps, question contract, taxonomy, readiness, placement, examples, owner decisions |
| **Files** | Docs under `docs/audits`, `docs/architecture`, `docs/specifications`, `docs/plans`, `docs/decisions`; roadmap/backlog/hardening updates |
| **Migrations** | None |
| **Security** | Docs only |
| **Regression** | Document consistency review |
| **Owner test** | Review docs + approve owner decision register |

### 3.2.1 — Question/Fact contract + deterministic candidate engine

| Field | Value |
| --- | --- |
| **Status** | **Awaiting Owner Decisions** |
| **Purpose** | Encode versioned interview registry + pure candidate generation (trigger/suppress/rank); no UI |
| **Likely modules** | New `lib/builder-interview/**` (pure); reuse `domain-ownership`, fact lookup, constraint keys; verify scripts |
| **Migrations** | Prefer none; only if provenance table explicitly approved (default: reuse Facts/Constraints + estimate assumptions) |
| **Security** | Pure functions; no new public endpoints |
| **Regression** | Unit tests: suppress duplicates, multi-WA, deck/bath/fitout fixtures |
| **Owner test** | Review fixture outputs for three example jobs |

### 3.2.2 — Core project/site constraint interview

| Field | Value |
| --- | --- |
| **Purpose** | Wire ask-layer for CORE project site topics into Assistant (small batch UX); write Constraints |
| **Likely modules** | Assistant components; constraint save paths; interview actions |
| **Migrations** | Taxonomy key additions only if D4 approves (owner-gated) |
| **Security** | Org RLS; server actions only; validate keys against allowlist |
| **Regression** | Constraint save + suppress; no formula drift suites |
| **Owner test** | Deck + Bathroom: access/carry asked once; Constraints reflect answers |

### 3.2.3 — Work-Area-aware interview

| Field | Value |
| --- | --- |
| **Purpose** | WA overrides + conditional WA questions; suppress project-known topics |
| **Likely modules** | Registry triggers; Scope Details suppress hooks (careful, minimal) |
| **Migrations** | None expected |
| **Security** | WA ownership checks on writes |
| **Regression** | Fitout multi-WA: no triple access asks |
| **Owner test** | Commercial Fitout interview batch |

### 3.2.4 — Assumption / readiness integration

| Field | Value |
| --- | --- |
| **Purpose** | Implement READY / READY WITH ASSUMPTIONS / NEEDS IMPORTANT INFORMATION; assumption records; QE attention routing to interview |
| **Likely modules** | Readiness helper; EstimatePanel attention; assumption presentation |
| **Migrations** | Only if dedicated assumption store approved; else estimate assumptions jsonb + Fact source=assumption |
| **Security** | No leakage of internal keys in UI |
| **Regression** | Soft-block P0; assumptions listed; Details attention unchanged for component gaps |
| **Owner test** | Skip vs assume vs answer paths |

### 3.2.5 — Multi-WA + mobile UX

| Field | Value |
| --- | --- |
| **Purpose** | Grouped batches, thumb-friendly controls, interruption-safe resume, density with 7G Assistant |
| **Likely modules** | Interview UI; responsive layout |
| **Migrations** | None |
| **Security** | Same as prior |
| **Regression** | Mobile viewport smoke; no remount regressions |
| **Owner test** | Phone on-site simulation |

### 3.2.6 — Preview E2E

| Field | Value |
| --- | --- |
| **Purpose** | Owner Preview validation Deck / Bathroom / Fitout; defect register; close 3.2 Preview gate |
| **Migrations** | None (unless prior approved leftovers) |
| **Security** | Reconfirm RLS on any new tables |
| **Regression** | Full stage verify + commercial goldens unchanged |
| **Owner test** | Formal E2E pack |

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

**ANSWERS → FACTS/CONSTRAINTS → ASSUMPTIONS → ESTIMATE UNDERSTANDING**

- Access/carry constraint confirms labour logistics band  
- No formula change; confidence and assumption list improve  

### B. Bathroom renovation

**KNOWN:** bathroom WA; area; renovation_type; some fixture flags  

**GENERATED:** occupied_site; services_isolated; hazmat if age unknown; carry if demolition_required  

**SUPPRESSED:** tile brand; duplicate access if project answered; Scope Review existence items  

**EFFECT:** logistics/risk clarity; waterproofing remains Scope Details  

### C. Commercial Fitout

**KNOWN:** 7+ WAs; many Scope Details; project brief commercial  

**GENERATED (project):** site_access, material_carry_distance, floor_level, occupied_site, working_hours, parking_loading / loading_zone  

**GENERATED (WA):** demolition services/hazmat only if unknown  

**SUPPRESSED:** access questions on walls, ceilings, flooring, painting, doors once project answered  

**EFFECT:** estimator-like single site interview; Details remain component-deep  

---

## 5. Migration expectations

| Batch | Expectation |
| --- | --- |
| 3.2.0 | None |
| 3.2.1 | None preferred |
| 3.2.2+ | Optional constraint key allowlist expansion (D4); optional assumption provenance table only if dual-write to estimate assumptions proves insufficient |
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
