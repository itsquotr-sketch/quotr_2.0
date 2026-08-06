/**
 * Stage 3.1B.6R3 — Workflow coherence completion.
 *
 * **Status:** Complete — Local, Preview Retest Pending
 * **Follow-on:** Stage 3.1B.6R3.1 — Scope Impact Recommendation UI
 *   (`docs/implementation/STAGE_3_1B6R31_SCOPE_IMPACT_RECOMMENDATIONS_COMPLETION.md`)
 * **Stage 3.1B.7:** Not Started
 * **UI/UX Overhaul:** Planned (`docs/plans/QUOTR_UI_UX_OVERHAUL_PLAN.md`)
 * **Production:** Disabled
 */

# Stage 3.1B.6R3 — Workflow Coherence Completion

**Status:** Complete — Local, Preview Retest Pending  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b6r3-workflow-coherence.ts`  

---

## 1. Analyse Job loading

Shared `AnalysisProgressBanner` with Analyse Job–specific steps via
`analyseJobProgressLabel`. Explicit click required; duplicate requests blocked
by existing action lock; accessible `aria-live`.

## 2. Dimension derivation

`lib/scopes/dimension-derivation.ts` — reusable length×width (and related)
patterns. Deck/pergola area continue to derive via `deriveFactsForProject`.
User override of derivable results allowed (`source=user` wins). Formula text
shown in derived displays (e.g. `5 m × 3 m = 15 m²`). No migration — uses
existing `project_facts.source`.

## 3. Work Area / Fact linkage

`WorkAreaFactContext` resolves workAreaId, type, scope-item identity, source,
and downstream consumers. Facts remain scoped by `work_area_id` (schema since
002). No cross-WA leakage.

## 4–6. Scope impact + staleness

`classifyFactScopeImpact` / `isFactMaterialForDiscoveryStale`:
detail and scope-signal Facts are **excluded** from discovery-run fingerprints.
Full reanalysis only for unclassified project-level signals, brief/notes/WA
changes. Scope-adding/excluding produce recommendation helpers
(`buildScopeChangeRecommendations`) without provider calls.

**R3 limitation (addressed in R3.1):** recommendation engine existed, but
Apply / Keep current were not mounted in Scope Review UI. See
`STAGE_3_1B6R31_SCOPE_IMPACT_RECOMMENDATIONS_COMPLETION.md`.

## 7. Project Capture → Site Constraints

Expanded `extractConstraintsFromBrief` heuristics mapped onto existing
constraint template keys (access, floor level, carry distance, occupied site,
working hours, waste access). Unsupported taxonomy deferred to Stage 3.2.

## 8. Estimate Review

Collapsible via `CollapsibleStageCard` (`canCollapse`); stale estimate forces
expansion; naming remains **Estimate Review**.

## 9. Quick Estimate breakdown

Summary tab adds **Scope and quantity drivers** per Work Area (included /
not required / assumptions / unresolved). Commercial money still from server
presentation helpers only.

## 10. UI/UX overhaul

Planned programme: `docs/plans/QUOTR_UI_UX_OVERHAUL_PLAN.md` — not implemented
in R3.

## 11. Boundaries

No Production enablement; no commercial formula change; no Company DNA;
no Builder Interview; Analyse Job preserved; **no migration 030**.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B6R3_WORKFLOW_COHERENCE_COMPLETION.md` |
| Created | 2026-08-06 |
