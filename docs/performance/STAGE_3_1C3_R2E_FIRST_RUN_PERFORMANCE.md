# Stage 3.1C.3-R2E — First-Run Performance Notes

**Status:** Observed locally / code-path notes — **no SLO claimed**  
**Date:** 2026-08-10

## Measured (local automated)

No formal timing harness in R2E. Owner Preview should capture:

| Action | How to observe | Notes |
| --- | --- | --- |
| Basics save | Network + UI feedback | Single settings write + redirect Dashboard |
| Work type save | Stay in Setup | Revalidates setup/dashboard |
| Rate save | Stay → Calibrate section | Starter upsert only |
| Calibration Compare | One `calculateEstimate` | No per-keystroke engine |
| Calibration Save | RPC supersede+insert | Org-scoped |
| Dashboard load | `measureServerLoad("dashboard")` | Parallel projects + summary + readiness |

## Code observations (not SLOs)

- Dashboard readiness query includes active calibration rows (bounded select).  
- Calibration Compare intentionally runs once on Compare CTA.  
- Layout basics gate uses `needsCompanyBasics` only (no rates catalogue).  
- Avoid claiming p95 targets until Owner Preview records timings.

## Local toolchain timings (not product SLOs)

| Step | Approx |
| --- | --- |
| R2E verify script | ~2s |
| Full 3.1C suite batch | ~28s |
| `npm run lint` | ~17s |
| `npm run build` | ~24s |

## R2E-R1 first-run transition

| Step | Observation |
| --- | --- |
| Signup soft redirect | Root cause of blank Basics (R2E-R1-01) |
| Fix | Document `location.assign` to `/app/setup?mode=basics` after cookie mutation |
| Expected | One hard navigation; setup `loading.tsx` skeleton may flash briefly — not a blank white page |

Owner Preview should still record Basics/Rates/Calibrate UX timings separately.

## Follow-ups if Owner sees lag

1. Duplicate readiness fetches on Dashboard  
2. Unnecessary `router.refresh()` storms after optional Setup saves  
3. Over-fetching rates on Compare  

Fix only meaningful causes; no architecture rewrite in R2E.
