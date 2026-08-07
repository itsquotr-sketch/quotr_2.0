/**
 * Stage 3.1B.7G — Assistant Density, Sticky Quick Estimate and Mobile Architecture.
 *
 * **Status:** Complete — Local  
 * **Stage 3.1B.7F Owner E2E:** Pending (DEF-7E-003 open)  
 * **Stage 3.1B release status:** BLOCKED BY PREVIEW DEFECTS  
 * **Production:** Disabled  
 * **Stage 3.2:** Not Started  
 */

# Stage 3.1B.7G — Assistant Density / Sticky Estimate Completion

**Status:** Complete — Local  
**Date:** 2026-08-07  
**Verify:** `scripts/verify-stage-3-1b7g-assistant-density-sticky-estimate.ts`  
**Preview retest:** `docs/runbooks/STAGE_3_1B7G_PREVIEW_RETEST.md`  
**Architecture:** `docs/architecture/QUOTR_ASSISTANT_RESPONSIVE_AND_MOBILE_PRESENTATION.md`

---

## Intent

Presentation-only refinement so each desktop region has one job:

| Region | Responsibility |
| --- | --- |
| Left Stepper | Where am I? |
| Centre workflow | What do I need to review or change? |
| Right Quick Estimate | What does this mean commercially? |

Avoid repeating the same project status in all three columns. Preserve every
existing information surface via compression and progressive disclosure.

## Delivered

1. **Quick Estimate commercial hierarchy** — Recommended sell (primary) → range →
   confidence → Cost / Margin / GP → concise status → blockers → **Prepare final
   pricing** → collapsible Project readiness / Scope / Assumptions / Rate sources →
   **View full breakdown** (secondary).
2. **Collapsible secondary content** — keyboard accessible, `aria-expanded`,
   no new API/DB calls; Project health detail retained inside Project readiness.
3. **Sticky desktop rail** — CSS `lg:sticky lg:top-6 lg:self-start` (1024px+);
   no JS scroll listeners; no fixed overlay; card stops at column bottom.
4. **Mobile compact summary** — below `lg`: sell · confidence + “View estimate”
   accordion; desktop header/`CardContent` not simultaneously exposed.
5. **Presentation view-model** —
   `lib/assistant/presentation/quick-estimate-view-model.ts` shared by rail /
   mobile / future sheets (no separate business logic).
6. **Centre density** — completed stages collapse to one–two line outcomes;
   expanded bodies unchanged; active stage stronger spacing/elevation.
7. **7F E2E pack updated** with sticky / hierarchy / mobile checks (gate still open).

## Sticky behaviour (selected)

- Applies from Tailwind `lg` (1024px) upward — covers 1024 / 1280 / 1440 audits.
- Offset `top-6` below app chrome (matches Stepper sticky).
- No internal scrollbar under normal card height.
- If the card is taller than the viewport, native sticky behaviour applies:
  the rail sticks until the column ends, then scrolls with the page so the CTA
  remains reachable without a trapped overlay.

## Duplication reduced

| Datum | Primary home |
| --- | --- |
| Stage completion counts | Stepper |
| Compact “what happened” | Centre collapsed summary |
| Full scope lists / answers | Centre expanded body |
| Commercial totals / confidence | Quick Estimate |
| Readiness drivers / assumptions detail | Quick Estimate disclosures / breakdown |

Removed always-visible Project health block above money; chips no longer
compete with commercial metrics.

## Explicit non-changes

- Commercial / estimate / confidence formulas  
- Scope Discovery / AI prompts / Facts / persistence / migrations / RLS  
- Production feature flag  
- Stage 3.1B.7F owner gate (DEF-7E-003 remains open)  
- Stage 3.2 / Company DNA / Builder Interview  

## Verification

- `npx tsx scripts/verify-stage-3-1b7g-assistant-density-sticky-estimate.ts` — **41/41**
- `npx tsc --noEmit` / `npm run lint` / `npm run build`
- Stage 3.1A → 3.1B.7F regressions + RLS + 2B.10

### Intentional verify updates

- `verify-stage-3-1b7b-information-hierarchy.ts` — collapsed Scope/Constraints
  assertions updated for one-line compact summaries (7G density); limit constant
  still asserted.

### Known pre-existing

- `verify-stage-3-1b6r3-workflow-coherence.ts` — DEF-7E-006 brief constraint
  heuristics (2 checks); observe in owner E2E; not changed in 7G.

## Remaining UX limitations

- No native bottom sheet yet (compact accordion only).
- Sticky rail does not shrink itself when taller than the viewport (page scroll).
- Tablet 768 uses mobile/non-sticky stack (intentional — no shrunken desktop rail).
