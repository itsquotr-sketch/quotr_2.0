# Stage 3.1C.3-R2D.1 — Calibration Persistence Completion

**Status:** Complete Local — Remote Pending Owner Gate  
**Date:** 2026-08-10  
**Migration:** `033_calibration_responses.sql` (created; not remote-applied)

## Delivered

- Additive table `calibration_responses` with commercial columns + bounded `engine_snapshot` / `response_metadata`
- Append/supersede history; one active response per `(org_id, scenario_id)`
- Evidence-immutability trigger (commercial fields not UPDATE-mutable)
- Atomic `save_calibration_response` RPC (`SECURITY INVOKER`, org/`created_by` from auth)
- Application persistence module + Save UX (gated path removed)
- Setup Calibrated / Not calibrated + View / Recalibrate
- Dashboard tip removes after first active calibration
- Verify: `scripts/verify-stage-3-1c3-r2d1-calibration-persistence.ts`

## Authority held

Calibration remains evidence only — never writes rates, projects, facts, estimates, pricing, or quotes. Not consumed by rate resolution.

## Remote

Do **not** apply 033 remotely until owner signs remote readiness:

`docs/runbooks/STAGE_3_1C3_R2D1_REMOTE_033_READINESS.md`

## Batch status

| Batch | Status |
| --- | --- |
| R2D | Complete Local (observational MVP) |
| R2D.1 | Complete Local — Remote Pending |
| R2E | Planned |
