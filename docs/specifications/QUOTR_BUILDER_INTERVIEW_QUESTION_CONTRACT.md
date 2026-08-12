# Quotr Builder Interview — Question Contract

**Status:** Conceptual contract (Stage 3.2.0-R1); encoded in 3.2.1 registry; **PROJECT ask-layer live in 3.2.2** (Project Conditions) — WA UI deferred to 3.2.3  
**Date:** 2026-08-12  
**Authority companions:**  
- `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`  
- `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`  
- `docs/specifications/QUOTR_CONSTRAINT_TAXONOMY.md`  
- `docs/architecture/STAGE_3_1D_DOMAIN_MODEL_REFINED.md`  
- `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`  

3.2.1 encodes a minimal deterministic registry from this contract in **application code** (no DB migration). Priority, estimate/scope/confidence impact, and answerability are **separate fields**.

---

## 1. Purpose

Every Builder Interview question must have a durable identity, a canonical write target, clear triggers/suppressors, and an explicit commercial/estimate rationale — so Quotr never asks the same thing three ways and never invents unanswered commercial fields.

---

## 2. Question record (conceptual fields)

| Field | Description |
| --- | --- |
| `question_key` | Stable id, e.g. `interview.site.material_carry_distance` |
| `domain` | One of: PROJECT_IDENTITY, SITE_ACCESS, EXISTING_CONDITIONS, DIMENSIONS, SCOPE_CONTEXT, SPECIFICATION_CONTEXT, LOGISTICS, COMPLIANCE_RISK, TRADE_INTERFACES, COMMERCIAL_DELIVERY (rare) |
| `scope` | `project` \| `work_area` |
| `work_area_type` | Optional; required when scope=work_area |
| `fact_key` | Canonical Fact key **or** reserved constraint key |
| `write_target` | `fact` \| `constraint` \| `assumption_only` |
| `question` | Short contractor-facing text |
| `input_type` | `select` \| `boolean` \| `number` \| `text` \| `multi_select` (prefer select/boolean/number) |
| `options` | For select/boolean |
| `requiredness` | `critical` \| `recommended` \| `optional` |
| `priority_class` | `P0` \| `P1` \| `P2` \| `P3` (static default; runtime may elevate/demote) |
| `trigger` | Rules for candidacy (WA types, scope flags, missing keys, calculator missingInfo) |
| `depends_on` | Optional parent question_key / fact conditions (generation-time; no DB parent_id required) |
| `suppress_if_known` | Keys / semantic aliases that hide this question |
| `suppresses` | Other question_keys or Fact aliases this answer closes |
| `commercial_impact` | none \| low \| medium \| high (must not imply formula ownership) |
| `scope_impact` | none \| low \| medium \| high |
| `estimate_impact` | none \| quantity \| labour \| material \| risk \| confidence |
| `ask_policy` | `ASK` \| `ASSUME` \| `BENCHMARK` \| `DEFER` \| `FLAG` |
| `reason_for_asking` | Short “why” for UI (optional display) |
| `source_priority` | Relative to Scope Details / Constraints / ISD clarifications |
| `disposition` | A–G codes from audit |
| `version` | Contract version string |

---

## 3. Priority model

| Class | Name | Behaviour |
| --- | --- | --- |
| **P0** | ESTIMATE BLOCKING | Cannot sensibly estimate without answer or explicit assumption |
| **P1** | HIGH IMPACT | Could materially alter cost/scope/labour |
| **P2** | USEFUL | Improves accuracy; skippable with mild confidence hit |
| **P3** | OPTIONAL | Helpful context; safe to assume/defer |

Dynamic ranking:

```
base priority_class
  × relevance (WA/scope match)
  × unknown severity
  − already_partially_known
  + calculator_missingInfo_match
```

Example: “How far must demolition waste be carried?”

- P1 for demolition / bathroom reno with stripout / commercial stripout  
- Irrelevant / suppressed for simple painting with no waste scope

---

## 4. Ask vs Assume vs Benchmark vs Defer vs Flag

| Policy | Meaning | Example |
| --- | --- | --- |
| **ASK** | Present in interview when unknown and relevant | Carry distance with demolition; occupied site on reno |
| **ASSUME** | System applies default; may record assumption without forcing UI | Paint brand; screw spacing; standard coat count |
| **BENCHMARK** | Use catalogue/system benchmark silently | Typical joist centres when not specified |
| **DEFER** | Leave to Scope Details / Constraints / later | Fixture counts already in bathroom template |
| **FLAG** | Show in attention / missing_info without blocking ask | Nice-to-have interface notes |

### Decision rules (MVP)

1. If unknown value **materially changes labour or waste handling** → ASK (P0/P1).  
2. If unknown is **granular component detail** already owned by Scope Details → DEFER.  
3. If unknown is **brand / aesthetic preference** without spec mandate → ASSUME.  
4. If unknown is **engineering spacing / fixing centres** with system default → BENCHMARK.  
5. If unknown affects **scope existence** → FLAG to Scope Discovery / Scope Review, not interview.  
6. If project-wide answer exists → suppress WA ASK clones.  
7. Never ASK for company rates, GP targets, or DNA productivity.  
8. Ceiling height: ASK if height-sensitive trade (ceilings/painting high walls); else ASSUME standard.  
9. Waste distance: ASK when demolition/logistics material; else DEFER/ASSUME band.  
10. “Not sure” ≠ assumption; “Use reasonable assumption” = explicit assumption write.

---

## 5. Disposition of current question sources

| Source | Typical disposition |
| --- | --- |
| Scope Details component questions | **A** KEEP + **E** WA-specific |
| Scope Details `*.access` / carting | **C** consolidate → interview/constraint **F** |
| Site Constraint templates | **A/F** keep as write targets; interview becomes ask layer |
| ISD clarifications | **A** keep for scope; **G** conditional |
| ISD missing_information | **FLAG** / attention; not auto-Facts |
| QE attention | **A** routing; may deep-link interview for site P0 |
| Calibration / setup | **D** out of interview |
| Fitout catalogue-only signals | **B** interview candidates for project logistics; scope existence stays ISD |

---

## 6. Canonical semantic topics (anti-duplication)

One answer per semantic topic unless WA override justified.

| Semantic topic | Canonical key (MVP) | WA override allowed |
| --- | --- | --- |
| Site access difficulty | constraint `site_access` | Yes (`{wa}.access` only if differs) |
| Material / waste carry | constraint `material_carry_distance` | Yes (numeric WA carting if extreme) |
| Floor level | constraint `floor_level` | Yes |
| Occupied site | constraint `occupied_site` | Rare |
| Working hours | constraint `working_hours` | Rare |
| Parking / loading | constraint `parking_loading` | Rare |
| Services isolated | constraint `services_isolated` | Yes for demolition |
| Hazmat risk | constraint `hazardous_materials_risk` | Yes for demolition |
| Protection / dust | constraint `protection_dust_control` | Yes |
| Consent / engineering | constraint `consent_engineering` | Yes per external structure WA |

Interview `suppresses` lists must close Scope Details clones for the same topic once project answer exists (implementation in later batch; docs-only now).

---

## 7. Batch presentation contract

| Rule | Value |
| --- | --- |
| Max questions per batch | 3–6 (hard preference ≤6) |
| Grouping | Domain then WA |
| Intro copy | “Quotr has N quick questions that will improve this estimate.” |
| Per-question actions | Answer / Not sure / Use reasonable assumption / Skip for now |
| Why line | Optional ≤1 short sentence |
| After save | Recompute remaining on **batch save** / presentation boundaries (Owner D15); do not remount Assistant |
| Empty state | “No important interview questions right now.” |

### Persistence note (3.2.0-R1)

- Candidates are **ephemeral** in 3.2.1 (pure engine output).
- Existing `questions` / `question_blocks` tables are **not** required to store the interview contract fields (`priority_class`, `write_target`, etc.).
- Answers (later batches) write Facts/Constraints; provenance minimum = `source` + registry `question_key` (Owner D16).

---

## 8. Versioning

- Registry versioned (`interview_registry_version`).
- Changing question_key meaning requires new key or bump + migration notes.
- AI phrasing variants must not change `question_key` or write target.

---

## 9. Out of scope for this contract

- UI components  
- DB migrations  
- Automatic formula hooks  
- Inventing Fitout commercial assemblies (Stage 3.3)  
- Company DNA writes  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/QUOTR_BUILDER_INTERVIEW_QUESTION_CONTRACT.md` |
| Next encoding | Stage 3.2.1 deterministic registry |
