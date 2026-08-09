# Stage 3.1C.3-R2B — Work Area Preferences Completion

**Status:** Complete — Local  
**Date:** 2026-08-09  
**Migration:** None

## Root cause

`loadAllowedWorkAreaTypes` (duplicated in Analyse Job + note analysis) treated `organisation_work_areas.enabled` as an AI capability allow-list. Once Setup saved any preferences, other catalogue types were filtered out of extraction.

## Delivered

1. Authority model: capability (`lib/scopes/capability.ts`) vs preferences (`lib/setup/work-area-preferences.ts`) vs project `work_areas`
2. Analyse Job + note analysis use `getAnalysisCapableWorkAreaTypes()` (full catalogue)
3. Setup Work Types UX: preference framing, Save / Skip, no silent `defaultEnabled` claims
4. Estimate-ready badge noise removed from preference cards
5. Improve tip: Choose common work types → Change work types after preferences
6. Rates starter rows personalise from preferences only (no invented defaults)
7. Add Work Area copy clarifies preferences do not limit capability
8. Domain ownership + architecture docs updated

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-r2b-work-area-preferences.ts
```

**Local results (2026-08-09):** PASSED — R2B, R2A, 3.1C.3, 3.1C.1A/1B/2A/2B, Scope Discovery 3.1B.2/4A, `tsc`, lint, build, Stage 2A.1–2A.5, env-safety, RLS, 2B.10.

## Preview

`docs/runbooks/STAGE_3_1C3_R2B_WORK_AREA_PREFERENCES_PREVIEW_TEST.md` — Pending owner.
## Status board

| Item | Status |
| --- | --- |
| 3.1C.3-R2A | Complete — Local |
| 3.1C.3-R2B | Complete — Local |
| 3.1C.3-R2C | Ready Next |
| 3.1C.3-R2D–R2E | Planned |
| Stage 3.2 | Not Started |
| Production Scope Discovery | Disabled |
