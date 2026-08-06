/**
 * Stage 3.1B.7A — Progressive Disclosure & Assistant Simplification.
 *
 * **Status:** Complete — Local
 * **Stage 3.1B.7B:** Not Started
 * **Stage 3.1B.7 (missing-scope):** Not Started
 * **UI/UX Overhaul:** Planned (7A is a focused disclosure batch)
 * **Production:** Disabled
 */

# Stage 3.1B.7A — Progressive Disclosure Completion

**Status:** Complete — Local  
**Date:** 2026-08-06  
**Verify:** `scripts/verify-stage-3-1b7a-progressive-disclosure.ts`  

---

## Intent

Reduce perceived Assistant complexity without removing capability.
Completed stages collapse to informative summaries; only the current
incomplete stage prefers expanded body space.

**Pure UX.** No Fact, Scope Discovery, commercial, AI, migration, or
persistence changes.

## Behaviour

1. **Progressive disclosure** — `resolveActiveDisclosureStage` selects one
   active incomplete stage; `CollapsibleStageCard.preferredExpanded` follows it.
2. **Manual expansion** — users may reopen any prior stage; override clears
   when the active stage advances; no AI rerun; no completion change.
3. **Completion summaries** — compact dashboards for Capture, Work Areas,
   Scope Review, Specification, Questions, Estimate Review, Site Constraints.
4. **Active highlight** — stronger border/elevation on the active stage;
   quieter completed cards.
5. **Quick Estimate** — not redesigned; aligns elevation when generate is next.
6. **Animations** — 200ms height/opacity transitions only.

## Boundaries

No Production enablement; no commercial formula; no Company DNA;
no Builder Interview; Analyse Job preserved; **no migration**.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_3_1B7A_PROGRESSIVE_DISCLOSURE_COMPLETION.md` |
| Created | 2026-08-06 |
| Status | Complete — Local |
