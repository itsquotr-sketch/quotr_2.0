# Stage 3.2 — Builder Interview Owner Decisions

**Status:** Awaiting Owner approval  
**Date:** 2026-08-11  
**Stage:** 3.2.0 Complete Planning → **3.2.1 blocked until decisions approved**  
**Plan:** `docs/plans/STAGE_3_2_BUILDER_INTERVIEW_PLAN.md`  
**Architecture:** `docs/architecture/QUOTR_BUILDER_INTERVIEW_ARCHITECTURE.md`  

Only decisions that genuinely require Owner approval are listed. Each includes a **recommended answer**.

---

## Decision register

### D1 — Interview placement

| Field | Value |
| --- | --- |
| **Question** | Where does Builder Interview live in the flow? |
| **Options** | A After Scope Details / before QE · B Progressive Assistant-only · C Pre-estimate-only pass · D Hybrid progressive + pre-estimate nudge |
| **Recommended** | **D Hybrid** — progressive Assistant card after WA confirm (and Scope Review when ISD on), writing the same Constraint/Fact keys; soft pre-estimate nudge for open P0/P1; **not** a mandatory wizard page |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D2 — Mandatory vs progressive

| Field | Value |
| --- | --- |
| **Question** | Must users complete the interview before estimating? |
| **Recommended** | **Progressive / skippable** — batches of 3–6; Answer / Not sure / Assume / Skip; never a full interrogation |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D3 — P0 / P1 blocking behaviour

| Field | Value |
| --- | --- |
| **Question** | How hard should P0 block Quick Estimate? |
| **Recommended** | **Soft-block P0** with CTA to 1–3 questions; allow “estimate anyway” with loud confidence warning; P1 never hard-blocks; P2/P3 never block |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D4 — Constraint taxonomy scope

| Field | Value |
| --- | --- |
| **Question** | How far to expand FEAT-003 / DEF-7E-004 in first implementation? |
| **Recommended** | Keep current **14** as CORE; phase-add `stairs_access`, `lift_available`, `loading_zone`, `noise_restrictions`, `storage_on_site`, `live_services` only after ask-layer on existing keys works; defer temporary access / delivery windows / wet weather / confined space; do not structure narrative fluff |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D5 — Assumption behaviour

| Field | Value |
| --- | --- |
| **Question** | What happens on “Use reasonable assumption”? |
| **Recommended** | Write assumption value + durable assumption record (question_key, value, reason, confidence impact); readiness → READY WITH ASSUMPTIONS; user can later supersede; “Not sure” does **not** write an assumption |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D6 — AI vs deterministic generation

| Field | Value |
| --- | --- |
| **Question** | Who generates interview questions in MVP? |
| **Recommended** | **Deterministic templates + rules only** for candidate set; AI may later rank/phrase/interpret but **must not invent** questions without canonical Fact/Constraint targets; **no AI call per answer** |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D7 — Fact / Constraint authority

| Field | Value |
| --- | --- |
| **Question** | How do interview answers interact with existing Facts/Constraints? |
| **Recommended** | Explicit user interview answer (`source=user`) wins; **never silent-overwrite** existing user values (conflict UI); may update ai_extracted/default/assumption; project constraint keys for site topics; WA Facts only for overrides / WA-owned detail; no rate writes |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D8 — Multi-WA grouping

| Field | Value |
| --- | --- |
| **Question** | How should multi-WA projects present questions? |
| **Recommended** | Project-wide first; suppress WA clones when project answered; group by domain (SITE, DEMOLITION, …); WA asks only when trigger says conditions may differ |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D9 — Sequencing vs PERF-FUTURE-01

| Field | Value |
| --- | --- |
| **Question** | Must latency pass finish before Builder Interview implementation? |
| **Recommended** | **Parallel tracks** — start 3.2.1 after these decisions; 3.2 must not worsen latency; PERF-FUTURE-01 remains Planned measured pass, not a gate |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

### D10 — First implementation domains

| Field | Value |
| --- | --- |
| **Question** | Which domains ship first? |
| **Recommended** | (1) Project site/access/logistics on existing constraints (2) Demolition/reno risk overlays (3) Relevance packs for Deck, Bathroom, Commercial Fitout (4) Defer deep trade-interface interview beyond existing Detail Facts |
| **Owner** | ☐ Approved · ☐ Modified · ☐ Deferred |

---

## Already settled (do not re-litigate)

| Topic | Settlement |
| --- | --- |
| Production Scope Discovery | Remains **Disabled** until separate enablement gate |
| Analyse Job | Preserved / unchanged |
| Commercial formulas | Frozen — interview must not change arithmetic |
| Company DNA | Not Started — project interview ≠ company knowledge |
| Stage 3.1B | Complete — Preview Validated (`441f36c`) |

---

## Approval to proceed

Implementation of **3.2.1** may begin only when Owner marks the decisions above (or records modifications).

| Gate | State |
| --- | --- |
| 3.2.0 Planning docs | Complete |
| Owner decision approval | **Awaiting** |
| 3.2.1 | Blocked |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_2_BUILDER_INTERVIEW_OWNER_DECISIONS.md` |
