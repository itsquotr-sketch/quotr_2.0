# Stage 3.1C.3-R2D.1 — Remote Migration 033 Readiness

**Status:** Remote apply **COMPLETE** — see `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`  
**Migration:** `supabase/migrations/033_calibration_responses.sql`

## Dry-run checklist (completed in R2D.2)

- [x] Local `npx supabase db reset` succeeds through 033
- [x] `npx --yes tsx scripts/verify-stage-3-1c3-r2d1-calibration-persistence.ts` passes (incl. live section)
- [x] `npx --yes tsx scripts/verify-rls-coverage.ts` passes
- [x] Confirm additive only (no ALTER on rates/estimates/quotes/projects/facts)
- [x] Confirm anon has no grants on `calibration_responses`
- [x] Confirm authenticated has SELECT/INSERT/UPDATE only (no DELETE)
- [x] Confirm `save_calibration_response` is SECURITY INVOKER + auth-derived org
- [x] Owner explicitly authorised **remote** apply of **033 only** (R2D.2)
- [x] Dry-run showed 033 only
- [x] Remote apply + object verification completed

## What remote apply unlocked

- Persistent Save on Preview (once app with R2D.1 is deployed)
- Dashboard tip “has calibration” detection against real DB

## Boundaries (unchanged)

- No Company DNA
- Production Scope Discovery remains Disabled
- No auto-apply calibration to rates
- No commercial formula changes

**Owner remote authorisation:** Approved (R2D.2) **Date:** 2026-08-10  
**Apply completion:** `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`
