# Stage 3.1C.2B — Account Recovery Completion

**Status:** Complete — Local; Preview Auth E2E Pending Owner Test  
**Date:** 2026-08-09  
**Verify:** `npx --yes tsx scripts/verify-stage-3-1c2b-account-recovery.ts`

## Summary

Completes the account access/recovery lifecycle on top of transactional signup (1B) and account menu/profile (2A):

- `/auth/callback` PKCE `exchangeCodeForSession`
- Safe `next` redirect helper + middleware/login wiring
- Signup confirmation-pending UX + resend
- Forgot password + reset password
- Shared password policy
- Auth mobile polish (compact layout, `h-11` targets, `inputMode`, safe-area)

## Email-change decision

**Not implemented** in 2B — Profile email remains read-only. Dual-confirmation semantics deferred.

## Reset success behaviour

After `updateUser({ password })` the recovery session remains authenticated → redirect `/app/dashboard` (layout routes missing org to setup-required).

## Migration

**None.**

## Status board

| Item | Status |
| --- | --- |
| Stage 3.1C.2B | Complete — Local |
| Account access/recovery lifecycle | Complete — Local |
| Preview Auth E2E | Pending Owner Test |
| Stage 3.1C.3 | Ready Next |
| Stage 3.1B Owner E2E | Open |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

Stage 3.1C is **not** marked complete until Preview E2E and 3.1C.3 are done.

## Files created (high level)

- `app/auth/callback/route.ts`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `components/auth/ResetPasswordClient.tsx`
- `lib/auth/safe-redirect.ts`, `password.ts`, `site-url.ts`, `recovery-actions.ts`
- Docs + `scripts/verify-stage-3-1c2b-account-recovery.ts`
