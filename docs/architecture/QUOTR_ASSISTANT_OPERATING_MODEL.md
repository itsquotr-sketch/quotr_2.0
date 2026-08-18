# Quotr Assistant Operating Model

**Classification:** CANONICAL — next-generation Assistant UX operating model  
**Status:** COMPLETE / OWNER ASSISTANT ARCHITECTURE VALIDATED  
**Date:** 2026-08-19  
**HEAD:** `2b4055c316c404dcf3cc183dad47c9408c3634e4`  
**Owner gate:** `docs/runbooks/RECOVERY_2_OWNER_ASSISTANT_GATE.md`  
**Mode:** Architecture locked. Job Plan implementation is RECOVERY-3 (projection only; no new table).  
**Companions:**
- Work Area ports: `docs/architecture/QUOTR_WORK_AREA_ASSISTANT_CONTRACT.md`
- Estimate presentation: `docs/architecture/QUOTR_ESTIMATE_PRESENTATION_CONTRACT.md`
- Migration: `docs/plans/QUOTR_WORK_AREA_MIGRATION_PLAN.md`
- Domain audit: `docs/audits/RECOVERY_2_ASSISTANT_DOMAIN_AUDIT.md`
- Commercial sell: `docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md`
- Assisted estimate (DECK-2A, still valid product levels): `docs/architecture/QUOTR_ASSISTED_ESTIMATE_EXPERIENCE_CONTRACT.md`

This file is the **user-facing Assistant SoT**. It does not replace estimating, commercial, or requirement contracts.

---

## 1. Product objective

Quotr is an **estimating Assistant**.

The builder provides what they know. Quotr carries the complexity.

Target journey:

```
BRIEF → JOB PLAN → CLARIFY → ESTIMATE → BUILDER REVIEW → PRICING → QUOTE
```

Must support:

- one Work Area
- many Work Areas
- different estimating maturity per Work Area

**Lock:** simplify **interaction**, not delete **estimating information**. Work Areas, Facts, constraints, requirements, snapshots, rate authority, and commercial authority remain.

---

## 2. Target user-facing stages (locked names)

Existing product language is kept. Do not rename Pricing or Quote.

| Stage | User purpose | Internal domains (not new stores) |
| --- | --- | --- |
| **1. Brief** | Capture what the builder already knows | `projects.brief_text`, notes, Analyse Job extraction |
| **2. Job Plan** | Confirm work packages + in/out scope + lightweight spec | `work_areas`, scope items, Facts |
| **3. Clarify** | One ranked set of useful questions | Scope templates + Project Conditions + attention |
| **4. Estimate** | Generate / show current money | calculators + commercial engine + persist |
| **5. Builder Review** | Explain and confirm the estimate | presentation projection over estimate lines |
| **6. Pricing** | Deliberate commercial editing | pricing documents (RECOVERY-1) |
| **7. Quote** | Customer-facing document | quote snapshot of Pricing |

Rejected names: “Scope Review” (collides with ISD), “Estimate Review” (collides with breakdown), “Specification” as a mandatory full-page stage, “Scope Details” as a mandatory wizard step.

**Owner lock (2026-08-19):** this journey is approved. Work Areas remain internal estimating parents. Work Areas + user-facing scope merge into **Job Plan presentation**. Specification is contextual. Scope Details become clarification/refinement. Project Conditions participate in Clarify (not implemented in RECOVERY-3). Builder Review is RECOVERY-5. DECK-2C is superseded. No new Job Plan table. Hybrid estimate architecture is permanent. REAL-JOB `$13,000` remains evidence only.

---

## 2.1 Job Plan is a projection (locked)

Job Plan is **not** a source of truth.

It composes:

- `work_areas`
- scope decisions / `work_area_scope_items`
- `project_facts`
- relevant constraints (for boundary only — not as WA scope)
- specification facts (`quality_level` + quick spec Facts)

Writes go through existing canonical actions. No parallel Job Plan store. No new table.

### User-facing scope vs estimate component (locked)

| User-facing scope (Job Plan toggles) | Estimate components (never Job Plan toggles) |
| --- | --- |
| Decking, new substructure, demolition, fascia, steps, balustrade | Joists, bearers, rim, concrete, fixings, decking surface material line |

Selecting **New substructure** may imply multiple internal estimate components. Job Plan is **what work is included**. Calculators decide **how that work is priced**.

### Unknown is not excluded (locked)

```
ABSENT FROM BRIEF  ≠  NOT_REQUIRED
```

Presentation states (no new persisted enum):

| Presentation | Meaning | Persist |
| --- | --- | --- |
| **INCLUDED** | Confirmed or deterministically included | INCLUDE / true Fact / deterministic rule |
| **NOT_INCLUDED** | Explicitly out | EXCLUDE / false Fact **only** when user chose it, an authoritative Fact says no, or a deterministic rule |
| **NOT_CONFIRMED** | Unstated / unknown | **Do not persist exclusion.** Reconstruct as unknown on reload |

`NOT_REQUIRED` may be persisted only when supported by an explicit user decision, an authoritative project fact, or a deterministic scope rule. Missing/unstated remains **NOT_CONFIRMED**.

Job Plan shows only: confidently included items, commercially meaningful unresolved checks, and useful explicit exclusions. It is not an exhaustive checklist.

---

## 3. Future Assistant mode machine

Overlay on existing `projects.stage`. Do **not** add a DB enum in RECOVERY-3.

| Mode | Shows | Maps from today |
| --- | --- | --- |
| **PLANNING** | Brief, Job Plan, Clarify, Estimate now | `brief` … `ready_to_estimate` |
| **ESTIMATE_READY** | Estimate, Review estimate, Edit job, Continue to Pricing | `estimate_ready` and estimate not stale |
| **EDIT_JOB** | Job Plan, conditions, advanced/refinement | local disclosure today (`setupReviewOpen`); not a DB stage |

Save / regenerate from EDIT_JOB returns to ESTIMATE_READY.

Stale estimate leaves ESTIMATE_READY visually but forces regenerate before Pricing (existing `is_stale` rule).

---

## 4. Clarify — one project-wide question stage

Clarify may **draw** candidates from:

- Work Area templates
- scope ambiguity
- specification / Scope Details
- Project Conditions
- attention rules

The user experiences **one ranked list**.

No subsystem may independently run a full interview.

### Canonical question metadata (design — do not implement yet)

Unify overlapping P0/P1/P2/P3, `level1BlockingClass`, BI ranking, Level 1 score maps, and PC applicability into **one** planning record per candidate:

| Field | Meaning | Compatible with today |
| --- | --- | --- |
| `askClass` | `HARD_MINIMUM` · `ASK_NOW` · `ASSUME_IF_SKIPPED` · `REFINEMENT` · `ADVANCED` · `DERIVED_NEVER_ASK` | `level1BlockingClass` + `estimatePriorityClass` |
| `valueScore` | commercial / scope / confidence impact (rank only) | `level1-question-plan.ts` scores |
| `blocksEstimate` | independent of ask class | PC required vs Deck ASSUMABLE P0 |
| `assumable` | safe default exists | `ASSUMABLE` + PC assumable keys |
| `scope` | `PROJECT` or `WORK_AREA` | PC vs Scope Details |
| `workAreaId` / `factKey` / `constraintKey` | write target | existing SoT |

**Do not tie P0 to blocking.** Deck demolition is P0 and ASSUMABLE today; that split is correct.

Suggested mapping:

| Today | Future `askClass` |
| --- | --- |
| P3 / derived area | `DERIVED_NEVER_ASK` |
| P0 + HARD_MINIMUM | `HARD_MINIMUM` |
| P0 + ASSUMABLE | `ASSUME_IF_SKIPPED` (ask if unknown and budget remains) |
| P1 / high-value unknown | `ASK_NOW` or `REFINEMENT` by valueScore |
| P2 structural/spec | `ADVANCED` |
| PC required unresolved | `HARD_MINIMUM` or `ASK_NOW` by applicability |
| PC assumable leftover (Deck-only today) | `ASSUME_IF_SKIPPED` |

Live templates stay the persistence of questions. This metadata is a **planner overlay**, not a new question table.

### Question budget

Keep the **principle**: a normal small job should need about **0–3** meaningful interruptions before first estimate.

Do **not** enforce a hard 3 when the project has several major unknowns (multi-WA, missing geometry, missing access).

Stop strategy (rank, then stop):

1. Unresolved `HARD_MINIMUM` that `blocksEstimate`
2. Highest `valueScore` among `ASK_NOW`
3. `ASSUME_IF_SKIPPED` — assume and disclose rather than ask
4. `REFINEMENT` / `ADVANCED` — after first estimate (EDIT_JOB / Builder Review)

Multi-WA: rank **across** Work Areas. Prefer one access question over three fascia questions. Scale the budget with included Work Areas only when remaining items are non-assumable and commercially material.

---

## 5. Assumption contract

Assumptions are first-class estimate evidence.

Hierarchy (unchanged):

1. Explicit user Fact / constraint
2. Approved company preference
3. Deterministic inference
4. Quotr estimating assumption
5. Unresolved / pricing required

Every assumption used to generate must be **structured, reviewable, regeneratable**, and editable through its underlying Fact/constraint where possible.

Persist today: `estimates.assumptions`, `assumption_metadata`, Fact/constraint `source`. No hidden AI state. No new assumptions table in RECOVERY-3.

---

## 6. Attention / check / blocker

Presentation only — no new DB enum.

| Term | Meaning | Today |
| --- | --- | --- |
| **ASSUMPTION** | Used a default; builder can change the Fact | `assumption_metadata`, attention kind ASSUMPTION |
| **CHECK** | Optional/unknown, not commercially blocking (fascia) | `AttentionProductSeverity` `check` |
| **ATTENTION** | Material conflict or needs a decision (elevated + no balustrade) | SCOPE / PRICING_REQUIRED |
| **BLOCKER** | Cannot generate or cannot leave to Pricing honestly | stale estimate; unresolved HARD_MINIMUM; `canGenerateQuickEstimate` false |

Optional fascia unknown → CHECK / assumption.  
Scope/compliance conflict → ATTENTION (do not auto-price).  
Critical missing commercial item before quote → BLOCKER or Pricing required.

---

## 7. Project Conditions

Canonical store remains **`constraints`**. Fourteen reserved keys. Persist once. Consume once.

Target UX: they **participate in Clarify**. They are not a separate formal questionnaire once Clarify exists.

Capture from brief when possible (`site_access`, carry). Ask only unresolved high-value conditions.

Local exceptions stay Facts when they are **distinct physical geometry**, not site logistics.

**Access audit (locked):**

| Key | Domain | Job Plan |
| --- | --- | --- |
| `site_access` | Project Conditions (`constraints`) | Never a Work Area scope item |
| `material_carry_distance` | Project Conditions | Never a Work Area scope item |
| waste / occupancy / working restrictions | Project Conditions | Never a Work Area scope item |
| `deck.access_type` | Deck-local **stairs / step-down from the deck** (not site access) | May project as user-facing **Steps** only. Do not treat as duplicate `site_access`. Do not retire the Fact in RECOVERY-3. |

Do not show duplicate access state in Job Plan. `deck.access_type` does **not** semantically equal `site_access`; do not collapse it into site logistics. Do not give it a second Job Plan meaning as “site access”.

---

## 8. Specification

Specification remains useful. It is **not** a mandatory full-page stage.

| Layer | User | Examples (Deck, not global rules) |
| --- | --- | --- |
| **Quick spec** | Job Plan summary + Clarify if unknown | material, board/profile, height/complexity |
| **Advanced spec** | EDIT_JOB / later | grade, treatment, KD/green, section/layout, footings |

Project `quality_level` (budget/standard/premium) remains a **range factor**, not the Job Plan spec summary.

---

## 9. Source of truth (locked)

| Screen | Writes |
| --- | --- |
| Brief | `projects.brief_text`, notes |
| Job Plan | `work_areas.status`; scope INCLUDE/EXCLUDE / discovery decisions; optional Fact edits for quick spec |
| Clarify | Facts (`project_facts`) and/or `constraints` — never a parallel question store as authority |
| Estimate | generation persist (estimate + lines + snapshot) |
| EDIT_JOB | same Fact/constraint/scope tables |
| Builder Review | presentation over estimate lines; Fact edits that stale+regenerate |
| Pricing | pricing documents (RECOVERY-1) |
| Quote | quotes from Pricing |

**Forbidden:** Job Plan table, Clarify table, parallel money, parallel Facts.

Facts remain SoT; question rows remain capture mirrors (3.1D).

---

## 10. Pricing and Quote boundaries

**RECOVERY-1 locked.** Entering Pricing must not change sell. Estimate / Builder Review explain and confirm. Pricing is deliberate commercial editing. Quote is customer-facing: no rate provenance, sell authority identifiers, shadow diagnostics, or internal benchmark wording.

Job Plan included/excluded scope should later help customer quote wording. That is a Quote presentation improvement, not a Job Plan persist.

---

## 11. Quality gates

Retain:

- **A. Calculation** — quantities/formulas
- **B. Commercial** — rate source, authority, margin, sell (RECOVERY-1)
- **C. Persistence** — reload matches generate
- **D. User** — faster/clearer builder flow

Every Work Area migration also proves: money invariance unless intended, question behaviour, persistence, mobile UX.

---

## 12. Non-goals

No Job Plan implementation in this batch. No AssistantShell rebuild. No Builder Review UI. No money/rate/structural promotion. No DECK-3. No migration. No Production deploy.
