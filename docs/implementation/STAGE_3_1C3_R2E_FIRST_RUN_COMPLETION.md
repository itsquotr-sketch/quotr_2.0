# Stage 3.1C.3-R2E — First-Run Completion

**Status:** Complete — Preview Validated (Stage 3.1C closed 2026-08-10)  
**Date:** 2026-08-10

## Objective

Validate and polish the coherent first-run journey (Basics → Dashboard → optional Setup → Rates → Calibrate → first Project) without new architecture.

## Outcome

Owner Preview retest passed after R2E-R1 (+ R1.1 build fix). See:

- `docs/runbooks/STAGE_3_1C3_R2E_FINAL_PREVIEW_SIGNOFF.md`
- `docs/runbooks/STAGE_3_1C3_R2E_R1_OWNER_RETEST.md`
- `docs/implementation/STAGE_3_1C_CLOSURE.md`

## Stage status

| Item | Status |
| --- | --- |
| Stage 3.1C.3-R2E | **Complete — Preview Validated** |
| Stage 3.1C.3-R2E-R1 | **Complete — Preview Validated** |
| Stage 3.1C.3 | **Complete** |
| Stage 3.1C | **Complete — Preview Validated** |
| Stage 3.1B | **Not** closed by 3.1C — next active Owner E2E |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## Local polish delivered (R2E)

- Dashboard empty-state secondary CTA no longer duplicates Improve card title  
- Estimate rate-source labels aligned with R2C authority vocabulary  
- Calibration hub fallback copy for prefs without scenarios  
- Subtle “Calibrate another work type” after first calibration  
- Setup Rates component starter cap reduced (3 per work type)  

## Automated verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-r2e-first-run-e2e.ts
npx --yes tsx scripts/verify-stage-3-1c3-r2e-r1-preview-remediation.ts
```
