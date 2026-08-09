# Stage 3.1C.3-R2A — First-Run Gating Completion

**Status:** Complete — Local  
**Date:** 2026-08-09  
**Migration:** None (Zod limit fixed; ISO codes in existing `text` columns)

## Delivered

1. Hard first-run gate in `app/(protected)/app/layout.tsx` → `/app/setup?mode=basics` when `needsCompanyBasics()`  
2. `/app/setup?mode=basics` | `improve` — Basics vs optional Improve Quotr  
3. Controlled country/currency catalogue (`lib/setup/locale-catalogue.ts`) — NZ/AU + NZD/AUD  
4. GST suggestions from country; user confirms; 0% allowed  
5. Company Basics save: basics mode → Dashboard; optional mode → stay in Setup  
6. Dashboard: Create project primary; Improve card secondary; no Finish Setup framing  
7. Sidebar Incomplete = basics missing only (not Review complete)  
8. Review/Mark complete removed from normal Setup navigation  
9. Owner decisions recorded as Approved  

## Basics authority

`onboarding_status === not_started` (or missing settings) → basics required.  
`saveCompanyBasics` → `in_progress` unlocks Dashboard.  
`completed` is legacy only — not badge/Dashboard authority.

## Compatibility

Legacy `"New Zealand"` / `"nz"` / `"New Zealand Dollar"` normalize for forms; established `in_progress`/`completed` orgs are not re-gated.

## Boundaries

- No rates redesign, calibration, Company DNA, Stage 3.2, Scope Discovery  
- Generic `scope.*` starters retained  
- Work-area capability lock unchanged (R2B)  

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c3-r2a-first-run-gating.ts
```

**Local results (2026-08-09):** PASSED — R2A verify, 3.1C.3, 3.1C.1A/1B/2A/2B(+R1), `tsc`, lint, build, Stage 2A.1–2A.5, env-safety, RLS, 3.1B.7F-R3, 2B.10.

## Preview

`docs/runbooks/STAGE_3_1C3_R2A_FIRST_RUN_PREVIEW_TEST.md` — Pending owner.

## Status board

| Item | Status |
| --- | --- |
| 3.1C.3-R1 | Complete — Planning |
| 3.1C.3-R2A | Complete — Local |
| 3.1C.3-R2B | Ready Next |
| 3.1C.3-R2C–R2E | Planned |
| Stage 3.2 | Not Started |
| Production Scope Discovery | Disabled |
