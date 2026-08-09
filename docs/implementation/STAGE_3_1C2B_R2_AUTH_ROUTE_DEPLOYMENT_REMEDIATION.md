# Stage 3.1C.2B-R2 — Forgot Password Route Deployment Remediation

**Status:** Complete — Local (commit + Preview redeploy required)  
**Date:** 2026-08-09  
**Does not start:** 3.1C.3, Stage 3.2, Production Scope Discovery  
**Does not change:** Supabase remote Auth URL config; callback/reset logic

## Root cause

Identical class to Stage 3.1C.2A-R1 (`/app/profile`):

| Check | Result |
| --- | --- |
| Login href | `/forgot-password` (correct, in HEAD) |
| Local page | `app/(auth)/forgot-password/page.tsx` **exists** |
| Git tracked (before R2) | **No** — never added |
| In HEAD / deployed Preview | **No** — Vercel 404 |
| Local `next build` | Registers `/forgot-password` because the untracked file is on disk |

`b83aeae` shipped callback, `ResetPasswordClient`, recovery helpers, and middleware — but **omitted** the App Router page files. `9d2194e` (R1) exposed the Login link, which made the missing route visible as a Preview 404.

Same omission for `app/(auth)/reset-password/page.tsx`.

## Route audit (post-R2 intent)

| Public URL | Local path | Must be tracked + committed |
| --- | --- | --- |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | yes |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | yes |
| `/auth/callback` | `app/auth/callback/route.ts` | yes (already in HEAD) |

Confirmation-pending is **signup page state**, not a dedicated route.

## Fix

1. Ensure forgot/reset pages remain in the working tree (no UX rewrite).
2. `git add` + commit the route pages (and R2 verify/docs).
3. Extend 3.1C.2B verify with **git-tracked** guards (same pattern as profile R1).
4. Add `scripts/verify-stage-3-1c2b-r2-auth-route-deployment.ts`.

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c2b-r2-auth-route-deployment.ts
npx --yes tsx scripts/verify-stage-3-1c2b-account-recovery.ts
```

## Owner Preview retest (after commit + push + redeploy)

1. `/login` → Forgot password? → **no 404**
2. Direct `/forgot-password`
3. Only then continue email / callback / `/reset-password` checks

Do not debug Supabase redirect allow-lists until step 1 passes.

## Status

| Item | Status |
| --- | --- |
| 3.1C.2B-R2 | Complete — Local; Owner commit/push/Preview retest Pending |
| 3.1C.3 | **NOT STARTED** |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |
