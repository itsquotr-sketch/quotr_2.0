# Stage 3.1C.3-R2E — First-Run Completion

**Status:** Complete Local — Owner Preview Sign-off Pending  
**Date:** 2026-08-10

## Objective

Validate and polish the coherent first-run journey (Basics → Dashboard → optional Setup → Rates → Calibrate → first Project) without new architecture.

## Deployment / version gate

| Check | Result |
| --- | --- |
| Linked remote | `quotr_2.0` / `lxvnylhsbvudzzupxeqr` ACTIVE_HEALTHY |
| Migrations | Local + remote **001–033** aligned |
| Branch HEAD (committed) | Includes R2A–R2D.1 calibration persistence |
| Working tree | R2E polish + R2D.2 docs — **must deploy before Owner E2E** |
| Production Scope Discovery | Disabled |
| Company DNA / Stage 3.2 | Not started |
| Migration 034 | Not created |

**Owner must not run Preview E2E against an old Preview commit** missing R2D.1 Save + R2E polish.

## Local polish delivered

- Dashboard empty-state secondary CTA no longer duplicates Improve card title  
- Estimate rate-source labels aligned with R2C authority vocabulary  
- Calibration hub fallback copy for prefs without scenarios  
- Subtle “Calibrate another work type” after first calibration  
- Setup Rates component starter cap reduced (3 per work type)  

## Automated verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-r2e-first-run-e2e.ts
```

**Result (2026-08-10):** ALL PASSED.

## Regression (local)

| Suite | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass (via build TS) |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| 3.1C.1A–2B + 3.1C.3 + R2A–R2E | Pass |
| Stage 2A.1–2A.5 | Pass |
| RLS coverage | Pass |
| 2B.10 / 2B.7 / 2B.3B / 2B.3C | Pass |
| 3.1B.1 / .2 / .4A / .5A / .5C / .6R1 / .6R3 / .7E | Pass |

**Note:** `verify-stage-3-1b5c` migration gate updated (R2E-07) so unrelated 030–033 do not false-fail.

## Stage status

| Item | Status |
| --- | --- |
| Stage 3.1C.3-R2E local | **Complete Local** |
| Stage 3.1C.3 | **Ready to Close after Owner Preview Sign-off** |
| Stage 3.1C | Ready to Close after that sign-off |
| Stage 3.1B | **Not** auto-closed |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## Docs

- Defect register: `docs/audits/STAGE_3_1C3_R2E_PREVIEW_DEFECT_REGISTER.md`  
- Sign-off: `docs/runbooks/STAGE_3_1C3_R2E_FINAL_PREVIEW_SIGNOFF.md`  
- Performance: `docs/performance/STAGE_3_1C3_R2E_FIRST_RUN_PERFORMANCE.md`
