# Stage 3.1C.3-R2E-R1 — Preview Remediation Completion

**Status:** Complete — Preview Validated (2026-08-10)  
**Date:** 2026-08-10

## Objective

Targeted Preview remediation after Owner R2E testing. No Setup redesign, no DNA, no Stage 3.2, no Scope Discovery enablement, no formula changes, no migration 034.

## Outcome

Owner retest passed. Stage 3.1C.3 and Stage 3.1C closed — `docs/implementation/STAGE_3_1C_CLOSURE.md`.

## 1. Blank first-run Basics (R2E-R1-01)

**Root cause (D):** After signup, session cookies were set in a Server Action, then a soft `redirect("/app/dashboard")` led the layout to soft-redirect again to `/app/setup?mode=basics`. The client URL updated, but the protected RSC tree often failed to paint until a hard refresh.

**Fix:** Signup / login / finishAccountSetup return `continueTo`. Client `AuthContinue` completes with `window.location.assign` (document navigation). Signup destination is `/app/setup?mode=basics` directly (no Dashboard flash).

Not used: `location.reload`, timeouts, polling, or fake loaders as a race cover.

## 2–5. Dashboard + deep links

- Improve card: Collapse/Expand + `localStorage` preference; default collapsed when projects exist  
- Shared `lib/setup/recommendation-destinations.ts`  
- Margin → `/app/rates?section=defaults`; labour → `section=core`; quote details → Company `section=quotes`

## 6–11. Calibration

- Desktop sticky Example job card with `referenceHighlights`  
- Mobile Show/Hide details disclosure  
- Clearer evidence-only purpose / Compare copy  
- Labour $ comparison only when labour cost provided  
- Persistence 033 unchanged (append/supersede)

## Automated verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-r2e-r1-preview-remediation.ts
```

## Stage status

| Item | Status |
| --- | --- |
| Stage 3.1C.3-R2E-R1 | **Complete — Preview Validated** |
| Stage 3.1C.3-R2E-R1.1 | **Complete** |
| Stage 3.1C.3 | **Complete** |
| Stage 3.1C | **Complete — Preview Validated** |
| Stage 3.2 / Company DNA | Not Started |
| Production Scope Discovery | Disabled |

## Docs

- Retest: `docs/runbooks/STAGE_3_1C3_R2E_R1_OWNER_RETEST.md`  
- Defect register: `docs/audits/STAGE_3_1C3_R2E_PREVIEW_DEFECT_REGISTER.md`
