# Stage 3.1C.3-R2D.1 — Remote Migration 033 Readiness

**Status:** Local complete — **STOP before remote apply**  
**Migration:** `supabase/migrations/033_calibration_responses.sql`

## Dry-run checklist

- [ ] Local `npx supabase db reset` succeeds through 033
- [ ] `npx --yes tsx scripts/verify-stage-3-1c3-r2d1-calibration-persistence.ts` passes (incl. live section)
- [ ] `npx --yes tsx scripts/verify-rls-coverage.ts` passes
- [ ] Confirm additive only (no ALTER on rates/estimates/quotes/projects/facts)
- [ ] Confirm anon has no grants on `calibration_responses`
- [ ] Confirm authenticated has SELECT/INSERT/UPDATE only (no DELETE)
- [ ] Confirm `save_calibration_response` is SECURITY INVOKER + auth-derived org
- [ ] Preview backup / point-in-time recovery known
- [ ] Owner explicitly authorises **remote** apply of **033 only**

## What remote apply unlocks

- Persistent Save on Preview
- Dashboard tip “has calibration” detection against real DB

## What remote apply must NOT do

- Enable Company DNA
- Enable Production Scope Discovery
- Auto-apply calibration to rates
- Change commercial formulas

## Apply command (owner-authorised only)

Do not run until signed below.

```bash
# Example — use the project’s established remote migration process
npx supabase db push
# or linked migration apply for 033 only per ops runbook
```

**Owner remote authorisation:** _________________ **Date:** ________
