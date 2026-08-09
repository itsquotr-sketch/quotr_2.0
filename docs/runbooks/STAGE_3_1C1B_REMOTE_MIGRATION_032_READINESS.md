# Stage 3.1C.1B — Remote Migration 032 Readiness

**Status:** Remote Pending Owner Gate  
**Date:** 2026-08-09  
**Do not apply remotely until separately authorised.**

## Local history

- Local `supabase db reset` applies migrations **001–032** successfully.
- Function `public.provision_organisation_for_new_user(text, text)` present.
- Verify script passed: grants, idempotency, atomicity, RLS still enabled.

## Remote history (expected before apply)

| Check | Expected |
| --- | --- |
| Latest remote migration | **031** (manual scope ACL) on Preview project used for 3.1B |
| Migration **032** remotely | **Absent** |
| Dry-run | `supabase db push --dry-run` (or equivalent) should show only 032 additive SQL |

Confirm live remote history with owner-operated CLI against the intended project before apply. Do not use this doc as a substitute for that check.

## Destructive-risk assessment

| Factor | Assessment |
| --- | --- |
| Data rewrite | **None** — create function + grants only |
| Table/RLS changes | **None** |
| Downtime | Negligible (function create + notify pgrst) |
| Rollback | `DROP FUNCTION public.provision_organisation_for_new_user(text, text);` (app must not be deployed expecting RPC if rolled back) |
| Coupling | App 3.1C.1B **requires** 032; deploy order: migrate then deploy (or simultaneous) |

## Security review summary

See `docs/security/STAGE_3_1C1B_PROVISIONING_SECURITY_REVIEW.md`.

- SECURITY DEFINER + `search_path = public`
- `auth.uid()` only; no user/org id args
- anon EXECUTE denied; authenticated granted

## Recommended owner apply sequence

1. Snapshot / confirm Preview project identity
2. Dry-run 032
3. Apply 032
4. Confirm function + grants
5. Deploy app
6. Run `docs/runbooks/STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md`

## Marking

**Migration 032 — Complete — Local, Remote Pending Owner Gate**
