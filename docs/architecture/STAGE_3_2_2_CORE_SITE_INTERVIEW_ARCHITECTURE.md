# Stage 3.2.2 — Core Project/Site Interview Architecture

**Status:** Complete Local  
**Date:** 2026-08-12  
**Depends on:** Stage 3.2.1 candidate engine (`e00624f`)

---

## Purpose

Wire the deterministic Builder Interview candidate engine into Project Assistant for **PROJECT / site-condition** questions only.

Builder-facing name: **Project Conditions**

Answers the question: *What important project/site information does Quotr still need to know?*

---

## Live Constraint architecture audit

Verified live path:

1. AssistantShell → ConstraintBlock / ProjectConditionsBlock
2. Server actions → `upsertProjectConstraintRecord`
3. Table: **`constraints`** (not `project_constraints`)
4. Read model: `lib/assistant/state.ts` + mappers → `ConstraintRow` (+ `source`)
5. Estimate context consumes constraints via existing loaders

Canonical occupied key: **`occupied_site`** (not `site_occupied`).

Builder Interview owns **no** persistence domain. PROJECT answers write through existing Constraint authority only.

---

## Placement decision

After:

- Work Areas confirmed
- Scope Review (when enabled)
- Specification / Scope Details (`questionsSubmitted`)

Before Quick Estimate is considered fully informed.

Card order:

1. Scope Details / Estimate Review editors
2. **Project Conditions** (ASK)
3. **Site Constraints** (summary / edit)
4. Quick Estimate rail

Not a mandatory wizard. Generate Estimate continues to work as before (stage unlock to `ready_to_estimate` when Project Conditions layer is active).

---

## Project Conditions vs Site Constraints

| Surface | Role |
| --- | --- |
| **Project Conditions** | Primary ASK + known review/edit (3.2.2-R1) |
| **Site Constraints** | Legacy questionnaire only when Project Conditions engine is unavailable |

When the candidate engine is usable, the separate Site Constraints primary stage is **suppressed**. Canonical persistence remains `constraints`.

---

## Input read model

`lib/assistant/builder-interview-live.ts` builds a narrow `BuilderInterviewInput` from:

- project id / quality
- work areas
- `interviewFacts`
- live `constraints` (incl. source)

`lib/builder-interview/project-filter.ts` filters engine output to:

`scope === PROJECT && askPolicy === ASK && writeTarget === CONSTRAINT`

Batch size: max **6**.

---

## Batch save

`saveBuilderInterviewProjectAnswers` (`lib/assistant/builder-interview-actions.ts`):

- Auth + org ownership server-side
- Allowlist via `isReservedConstraintKey`
- Per-item results (partial failure honest)
- Conflict confirm (D13) for user-vs-user replace
- `not_sure` / `skip` write nothing
- `assume` → `assumption_deferred` (3.2.4 owns durable assumptions)
- One candidate recompute after batch
- Source on write: **`user`** (Builder Interview is capture provenance, not a new authority tier)

**Migration verdict:** none required.

---

## Completion semantics

**Complete** = no currently-applicable PROJECT ASK candidates remain in the MVP registry for this project state.

It does **not** mean Scope Details complete, estimate final, or quote ready.

---

## Out of scope (STOP)

- Work Area interview (3.2.3)
- Soft-block Generate (3.2.4)
- Company DNA
- Production Scope Discovery enablement
- Formula changes
- New AI calls
- `interview_answers` table
- Taxonomy expansion beyond reserved CORE keys
