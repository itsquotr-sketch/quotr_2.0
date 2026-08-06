/**
 * Stage 3.1B.7C — Question Organisation, Estimate Presentation and Confidence Explanation.
 *
 * **Status:** Complete — Local  
 * **Stage 3.1B.7D:** Complete — Local  
 * **Scope Discovery Preview sign-off:** Pending Owner Test  
 * **UI/UX Overhaul (Assistant):** Complete — Local  
 * **Production:** Disabled  
 */

# Stage 3.1B.7C — Question / Estimate Presentation Completion

**Status:** Complete — Local  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b7c-question-estimate-presentation.ts`  
**Preview retest:** `docs/runbooks/STAGE_3_1B7C_PREVIEW_RETEST.md`

---

## Intent

Make active Assistant working surfaces easier to understand and faster to
complete — presentation and interaction only. Engine remains frozen.

Surfaces refined:

- Scope Details / questions (category grouping + context)
- Site Constraints (category grouping)
- Estimate Review (summary-first)
- Quick Estimate (confidence explanation + project health)
- Full breakdown (structured progressive disclosure)

## Delivered

1. **Question grouping** within each Work Area by presentation categories
   (Measurements, Existing Conditions, Structure, Materials and Finishes,
   Access and Logistics, Compliance and Risk, Client Requirements, Other Details).
   Empty categories hidden; unresolved required categories highlighted;
   completed categories collapsible; active incomplete expanded by default.
2. **Question / Fact row context** — Work Area, related scope item, provenance,
   “Used for” from existing consumer mappings (omit when unknown).
3. **Why this matters** — optional expandable deterministic catalogue text.
4. **Provenance labels** — From project brief / Answered by you / Calculated /
   Default assumption / Manual override / Needs confirmation.
5. **Site Constraints** grouped (Access and Movement, Site Operations, …) with
   project-wide labelling; editing unchanged.
6. **Estimate Review** summary-first per Work Area with **Review details**
   expand retaining all editors.
7. **Quick Estimate** — Estimate confidence % unchanged; qualitative Complete /
   Outstanding drivers; compact project-health strip.
8. **Full breakdown** WA sections: Overview, Confirmed scope, Quantities,
   Assumptions, Optional, Not required, Outstanding, Commercial breakdown.
9. **Terminology** — Scope Details, Specification, Site Constraints,
   Estimate Review, Quick Estimate.

## Boundaries confirmed

- No commercial / estimate formula changes
- No Scope Discovery logic / AI prompt / Fact authority changes
- No migrations / RLS / schema / persistence contract changes
- No Company DNA / Builder Interview / Production enablement
- No remount that drops optimistic answer state
- No client-side commercial arithmetic

## Key paths

| Area | Path |
| --- | --- |
| Catalogues | `lib/assistant/presentation/*` |
| Questions | `components/assistant/QuestionBlock.tsx` |
| Constraints | `components/assistant/ConstraintBlock.tsx` |
| Estimate Review | `components/assistant/ScopeSummaryBlock.tsx` |
| Fact rows | `components/assistant/ScopeReviewFactRow.tsx` |
| Quick Estimate | `components/assistant/EstimatePanel.tsx` |
| Breakdown | `components/assistant/EstimateBreakdownModal.tsx` |
| Shell / stepper | `AssistantShell.tsx`, `StepperNav.tsx` |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B7C_QUESTION_ESTIMATE_PRESENTATION_COMPLETION.md` |
| Created | 2026-08-06 |
| Status | Complete — Local |
