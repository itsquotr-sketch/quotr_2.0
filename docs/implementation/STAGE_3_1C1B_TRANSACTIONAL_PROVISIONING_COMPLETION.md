# Stage 3.1C.1B — Transactional Signup Provisioning — Completion

**Status:** Complete — Local; Migration **032 Applied and Verified Remote**; Application wiring **Ready to Commit/Deploy** (3.1C.1B.2)  
**Date:** 2026-08-09  
**Migration 032:** Applied and Verified Remote on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`) — `docs/implementation/STAGE_3_1C1B1_REMOTE_032_APPLY_COMPLETION.md`  
**Preview authentication test:** Pending owner (`docs/runbooks/STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md`)  
**Verify:** `npx --yes tsx scripts/verify-stage-3-1c1b-transactional-provisioning.ts`  
**Do not mark Preview-verified until owner retest is signed off.**

## Summary

Replaced non-atomic service-role org/profile inserts with authenticated RPC `provision_organisation_for_new_user`. Added setup-required Finish account setup using the same idempotent RPC. Preserved 1A safe errors + structured logging.

## Architecture

See `docs/architecture/STAGE_3_1C_TRANSACTIONAL_PROVISIONING_IMPLEMENTATION.md`.

## Email confirmation

No session after signup → `CONFIRMATION_PENDING` (honest; provisioning not claimed). Repair after confirm+login via setup-required. Auth callback → **3.1C.2**.

## Historic orphans

No bulk delete. Legitimate auth users without profiles can self-heal via repair. Orphan organisations are not auto-claimed — document for separate cleanup if discovered remotely.

## Admin client

Retained (`server-only`). Signup no longer calls it. Service-role optional for signup; still used by local verify scripts / admin tooling.

## Verification (local)

- Migration 032 applied via `supabase db reset`
- Idempotency + atomicity + grants + RLS proven in verify script
- 3.1C.1A verify still passes (updated for post-1B signup path)

## Remote

Migration **032 Applied and Verified Remote** (2026-08-09). See `STAGE_3_1C1B1_REMOTE_032_APPLY_COMPLETION.md`.

## Application wiring (3.1C.1B.2)

Uncommitted-at-gate app surfaces that must ship with Preview:

- `app/(auth)/actions.ts` — RPC signup + `finishAccountSetup` (no `createAdminClient` inserts)
- `app/(auth)/signup/page.tsx`, `login/page.tsx`
- `app/(protected)/app/setup-required/page.tsx` — Finish account setup

Committed already (HEAD `3ba35ff`): migration 032, `lib/auth/provisioning.ts`, verify scripts, architecture docs.

## Status board

| Item | Status |
| --- | --- |
| Migration 032 | **Remote Applied** |
| Application wiring | **Ready to Commit/Deploy** |
| Preview authentication test | **Pending** |
| Stage 3.1C.1B | Complete — Local; Preview Retest Pending |
| Stage 3.1C.2 | **Not Started** |
| Stage 3.1B Owner E2E | Open |
| Production Scope Discovery | **Disabled** |
| Stage 3.2 | **Not Started** |

## Files created

- `supabase/migrations/032_transactional_signup_provisioning.sql`
- `lib/auth/provisioning.ts`
- `scripts/verify-stage-3-1c1b-transactional-provisioning.ts`
- `docs/architecture/STAGE_3_1C_TRANSACTIONAL_PROVISIONING_IMPLEMENTATION.md`
- `docs/implementation/STAGE_3_1C1B_TRANSACTIONAL_PROVISIONING_COMPLETION.md`
- `docs/runbooks/STAGE_3_1C1B_PREVIEW_AUTH_RETEST.md`
- `docs/security/STAGE_3_1C1B_PROVISIONING_SECURITY_REVIEW.md`
- `docs/runbooks/STAGE_3_1C1B_REMOTE_MIGRATION_032_READINESS.md`

## Files modified

- `app/(auth)/actions.ts`
- `app/(auth)/signup/page.tsx`
- `app/(protected)/app/setup-required/page.tsx`
- `lib/auth/errors.ts`, `logging.ts`, `config.ts`
- `lib/supabase/admin.ts`, `lib/env.ts`
- `.env.local.example`, `docs/PRODUCTION_READINESS.md`
- `docs/audits/STAGE_3_1C_AUTH_AUDIT_CROSSCHECK.md`
- `docs/architecture/STAGE_3_1C_TRANSACTIONAL_SIGNUP_PROVISIONING_DESIGN.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`
- `scripts/verify-stage-3-1c1a-auth-safety.ts`
