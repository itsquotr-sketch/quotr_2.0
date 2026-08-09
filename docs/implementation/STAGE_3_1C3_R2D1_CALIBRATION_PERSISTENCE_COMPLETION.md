# Stage 3.1C.3-R2D.1 — Calibration Persistence Completion

**Status:** Complete — Local + Remote (033 Applied and Verified Remote via R2D.2)  
**Date:** 2026-08-10

## Delivered

- Additive table `calibration_responses` with commercial columns + bounded `engine_snapshot` / `response_metadata`
- Append/supersede history; one active response per `(org_id, scenario_id)`
- Evidence-immutability trigger (commercial fields not UPDATE-mutable)
- Atomic `save_calibration_response` RPC (`SECURITY INVOKER`, org/`created_by` from auth)
- Application persistence module + Save UX (gated path removed)
- Setup Calibrated / Not calibrated + View / Recalibrate
- Dashboard tip removes after first active calibration
- Verify: `scripts/verify-stage-3-1c3-r2d1-calibration-persistence.ts`
- Remote: `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`

## Authority held

Calibration remains evidence only — never writes rates, projects, facts, estimates, pricing, or quotes. Not consumed by rate resolution.

## Remote

**Migration 033 — Applied and Verified Remote** (R2D.2).

**Calibration Preview E2E — Pending Owner Test.**

## Batch status

| Batch | Status |
| --- | --- |
| R2D | Complete — Local |
| R2D.1 | **Complete** (persistence) |
| R2D.2 | **Complete** (remote 033) |
| R2E | Ready Next after Preview evidence |
