# Stage 3.2 — Builder Interview Owner Decisions

**Status:** OWNER APPROVED (D1–D16) — 2026-08-12  
**Stage:** 3.2.0-R1 Complete → **3.2.1 Unblocked**  
**Plan:** `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`  
**Architecture:** `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`  
**Reconciliation audit:** `docs/audits/STAGE_3_2_0_R1_ARCHITECTURE_RECONCILIATION.md`  
**Candidate engine:** `docs/architecture/STAGE_3_2_1_CANDIDATE_ENGINE_ARCHITECTURE.md`

---

## Canonical ownership model (approved)

| Layer | Owns |
| --- | --- |
| **Project capture** | Brief, raw notes, initial user project context |
| **Analyse Job** | AI/extracted structured evidence and Work Area recommendations |
| **Scope Review** | Scope inclusion / exclusion |
| **Scope Details** | Granular Work Area / component information |
| **Site Constraints** | Canonical project-wide site / logistics condition **values** |
| **Builder Interview** | **Nothing** as an independent persistence domain — orchestration / ranking / ask layer only |
| **Interview answers (later writes)** | Constraints (project/site) · Facts (genuine WA overrides) · assumption paths (explicit assumptions) |
| **Rates / Calibration / Company DNA** | Outside Stage 3.2 |

---

## Decision register

### D1 — Interview placement

| Field | Value |
| --- | --- |
| **Issue** | Where does Builder Interview live in the flow? |
| **Approved** | **Hybrid** — progressive Assistant surface + soft pre-estimate prompt when important information is missing. **Not** a standalone mandatory wizard. |
| **Status** | **OWNER APPROVED** |

### D2 — Mandatory vs progressive

| Field | Value |
| --- | --- |
| **Issue** | Must users complete the interview before estimating? |
| **Approved** | **Progressive.** Allow builders to continue where an honest estimate can be made. Do not require completion of every interview question. |
| **Status** | **OWNER APPROVED** |

### D3 — Blocking behaviour

| Field | Value |
| --- | --- |
| **Issue** | How hard should P0 block Quick Estimate? |
| **Approved** | Only **P0** may **soft-block Quick Estimate readiness** (Stage 3.2 scope). Do **not** hard-block Final Pricing, Quote issue, or unrelated workflows. Pricing/Quote assumption resurfacing deferred separately. |
| **Status** | **OWNER APPROVED** |

### D4 — Constraint taxonomy

| Field | Value |
| --- | --- |
| **Issue** | How far to expand FEAT-003 / DEF-7E-004? |
| **Approved** | Use current **CORE** taxonomy first. Phase stairs / lift / loading / noise / storage / live services only when justified. No migration required to add allowlisted keys (`constraints.key` is free text). **Do not expand taxonomy in 3.2.1.** |
| **Status** | **OWNER APPROVED** |

### D5 — Assumption behaviour

| Field | Value |
| --- | --- |
| **Issue** | What happens on “Use reasonable assumption”? |
| **Approved** | Must be **explicit**. Evidence carries question identity, assumed value, reason/source, confidence/readiness impact, reversible/supersedable semantics. Assumptions must not masquerade as user-confirmed Facts. Contradicting authoritative info → invalid/superseded + readiness recompute (visible later in UI). No silent long-lived contradictory assumption. |
| **Status** | **OWNER APPROVED** |

### D6 — AI vs deterministic

| Field | Value |
| --- | --- |
| **Issue** | Who generates interview questions in MVP? |
| **Approved** | **Deterministic MVP.** No AI call per answer. No AI-generated arbitrary commercial questions. Future AI may rank/phrase/interpret against canonical targets only — **not in 3.2.1**. |
| **Status** | **OWNER APPROVED** |

### D7 — Fact authority

| Field | Value |
| --- | --- |
| **Issue** | How do interview answers interact with existing Facts/Constraints? |
| **Approved** | Use the **actual repository authority model**. Do not restate precedence independently. Import/reuse canonical definition: user=100, ai_extracted=60, default=40, assumption=30, system=20, derived=10. Explicit user data remains authoritative. |
| **Status** | **OWNER APPROVED** |

### D8 — Project vs Work Area deduplication

| Field | Value |
| --- | --- |
| **Issue** | How should multi-WA projects present questions? |
| **Approved** | Project-wide information suppresses equivalent Work Area questions. WA-specific questions survive only when the condition genuinely differs **or** a deterministic trigger requires a local override. Override predicates must be encoded explicitly. |
| **Status** | **OWNER APPROVED** |

### D9 — Performance sequencing

| Field | Value |
| --- | --- |
| **Issue** | Must latency pass finish before Builder Interview? |
| **Approved** | PERF-FUTURE-01 remains a separate measured pass. Stage 3.2 must avoid AI-per-answer, full router refresh per answer, unnecessary Assistant remounts, repeated full-project DB loads, redundant recomputation. Candidate recompute design belongs in 3.2.1. |
| **Status** | **OWNER APPROVED** |

### D10 — First interview domains

| Field | Value |
| --- | --- |
| **Issue** | Which domains ship first? |
| **Approved** | (1) project/site logistics (2) demolition/renovation risk (3) Deck / Bathroom / Commercial Fitout validation packs. Do not expand into every construction Work Area during MVP. |
| **Status** | **OWNER APPROVED** |

### D11 — Fact ↔ Constraint direction

| Field | Value |
| --- | --- |
| **Issue** | Write direction and sync model |
| **Approved** | **No bidirectional sync.** PROJECT/SITE CONDITION → Constraint. GENUINE WORK AREA OVERRIDE → `project_fact` scoped to that WA. Do not revive `inferConstraintsFromFacts` as canonical synchronisation. Document as dead/unconsumed when audit confirms. |
| **Status** | **OWNER APPROVED** |

### D12 — Full precedence

| Field | Value |
| --- | --- |
| **Issue** | Full authority hierarchy |
| **Approved** | user > ai_extracted > default > assumption > system > derived. Do not maintain a second precedence table in Builder Interview. |
| **Status** | **OWNER APPROVED** |

### D13 — Conflict policy

| Field | Value |
| --- | --- |
| **Issue** | Conflict when answering against existing evidence |
| **Approved** | Lower-authority → user may replace/supersede. User + identical answer → no conflict. User + materially different answer → explicit conflict/confirmation required before later write integration. **3.2.1 models this; does not write.** |
| **Status** | **OWNER APPROVED** |

### D14 — Assumption invalidation

| Field | Value |
| --- | --- |
| **Issue** | When assumptions become invalid |
| **Approved** | Invalid/not-current when: superseded by more authoritative evidence; trigger ceases; WA excluded/removed; accepted scope that required it excluded; project-wide suppresses local unknown; conditional parent makes question irrelevant. **3.2.1 returns invalidation/relevance state deterministically.** |
| **Status** | **OWNER APPROVED** |

### D15 — Recompute timing

| Field | Value |
| --- | --- |
| **Issue** | When to recompute candidates |
| **Approved** | **Not** every keystroke. Boundaries: initial Builder Interview load; after confirmed batch save; after relevant WA/scope change; after relevant project constraint change; entering presentation/stage boundary needing fresh readiness. Full in-memory recompute OK if inexpensive. No premature incremental caching. Measure before optimising. |
| **Status** | **OWNER APPROVED** |

### D16 — Provenance / schema

| Field | Value |
| --- | --- |
| **Issue** | Evidence persistence and migrations |
| **Approved** | MVP provenance: canonical question registry metadata + existing Fact/Constraint source + existing estimate assumption structures where applicable. **No** evidence graph. **No** `interview_answers` table. **No** migration in 3.2.1. |
| **Status** | **OWNER APPROVED** |

---

## Already settled (do not re-litigate)

| Topic | Settlement |
| --- | --- |
| Production Scope Discovery | Remains **Disabled** |
| Analyse Job | Preserved / unchanged |
| Commercial formulas | Frozen |
| Company DNA | **Not Started** |
| Stage 3.1B / 3.1C | Complete — Preview Validated |

---

## Gate status

| Gate | State |
| --- | --- |
| 3.2.0 Planning | Complete |
| 3.2.0-R1 reconciliation | Complete |
| Owner decisions D1–D16 | **OWNER APPROVED** |
| 3.2.1 Deterministic candidate engine | Unblocked for implementation |
| 3.2.2 | **In Owner Preview / R3 Complete Local** (Owner Demo Preview Pending) |
| 3.2.3 | Not started until Owner authorises |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` |
| Decision count | D1–D16 |
| Approved | 2026-08-12 |
