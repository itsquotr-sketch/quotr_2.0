# Stage 3.1B.7G — Preview Retest

**Status:** Ready for owner Preview smoke  
**Prerequisite:** Deploy containing 3.1B.7G presentation changes  
**Does not close:** DEF-7E-003 / Stage 3.1B.7F owner E2E gate  

Use alongside `docs/runbooks/STAGE_3_1B7F_OWNER_E2E_TEST_PACK.md`.

---

## Desktop 1440 / 1280 / 1024

1. Generate a Quick Estimate on a known project.  
2. Confirm hierarchy: **Recommended sell** dominates; range; confidence; Cost /
   Margin / GP; then concise status.  
3. Confirm **Prepare final pricing** sits above collapsible secondary sections.  
4. Expand Project readiness / Scope / Assumptions / Rate sources — details
   present; no duplicate blocks saying the same thing twice.  
5. **View full breakdown** remains secondary and opens the existing modal.  
6. Scroll the centre column — Quick Estimate **sticks** under the header and
   does not overlap nav; no fixed floating overlay.  
7. Completed centre stages show one–two line summaries; expand restores full body.  
8. Active stage is visually heavier than completed/locked stages.

## Tablet 768 / Mobile 390

1. Side rail is **not** sticky.  
2. Compact Quick Estimate summary shows sell · confidence (or ready state) and
   **View estimate**.  
3. Expanding reveals the same commercial + CTA content.  
4. No simultaneous desktop header + mobile summary chrome.  
5. No horizontal scroll; primary actions fit.

## Accessibility smoke

1. Tab into Quick Estimate disclosures — `aria-expanded` toggles.  
2. Collapsed section contents not announced while closed.  
3. Status text readable without colour alone.  
4. Focus order follows DOM (centre then estimate or mobile estimate-first).

## Boundaries

- Money values match pre-change authority (no formula change expected).  
- Analyse Job / Scope Discovery behaviour unchanged.  
- Production remains disabled.
