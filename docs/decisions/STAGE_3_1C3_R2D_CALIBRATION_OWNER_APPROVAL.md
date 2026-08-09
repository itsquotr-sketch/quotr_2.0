# Stage 3.1C.3-R2D — Calibration Owner Approval

**Status:** Approved — Local 033 implemented; **remote applied in R2D.2**  
**Batch:** Calibration Scenario MVP + R2D.1 persistence + R2D.2 remote apply

## Approved defaults (A–J)

| # | Decision | Status |
| --- | --- | --- |
| A | Dedicated `calibration_responses` | Approved |
| B | Scoped by `org_id` | Approved |
| C | `scenario_id` + `scenario_version` + `work_area_type` | Approved |
| D | Append/supersede history | Approved |
| E | One active per org + scenario id | Approved |
| F | Historical rows preserved | Approved |
| G | Scenario catalogue static in code | Approved |
| H | No raw project data stored for calibration | Approved |
| I | Calibration not in live rate resolution | Approved |
| J | No anonymous access | Approved |

## Checklist

- [x] Persistence model accepted (columns + JSONB snapshots)
- [x] RLS / grants accepted
- [x] Append/supersede history accepted
- [x] Confirm: calibration must never auto-write company rates
- [x] Approve creating migration **033** (local)
- [x] Approve **remote** apply of migration **033** (R2D.2)

## Completed

1. `supabase/migrations/033_calibration_responses.sql` created  
2. `saveCalibrationResponse` enabled via RPC  
3. Dashboard tip detects active calibration  
4. Remote apply + verification: `docs/implementation/STAGE_3_1C3_R2D2_REMOTE_033_APPLY_COMPLETION.md`

**Owner sign-off (local create):** Approved in principle **Date:** 2026-08-10  
**Owner sign-off (remote apply):** Approved (R2D.2) **Date:** 2026-08-10
