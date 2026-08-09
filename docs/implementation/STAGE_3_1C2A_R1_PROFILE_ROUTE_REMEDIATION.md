# Stage 3.1C.2A-R1 — Profile Route Runtime Remediation

**Status:** Complete — Local; Preview Retest Pending  
**Date:** 2026-08-09  
**Does not start:** 3.1C.2B, 3.1C.3, Stage 3.2, Production Scope Discovery

## Exact root cause

Commit `59bc1f7` (`feat(auth): add account menu, profile page, and secure password change`) shipped:

- `components/layout/account-menu.tsx` → navigates to `/app/profile`
- `components/profile/ProfilePageContent.tsx`
- `lib/auth/profile-actions.ts`
- docs + 2A verify script

It **did not** include the Next.js App Router page:

- `app/(protected)/app/profile/page.tsx`

That file existed only as an **untracked local file**. Preview deploys from git → **no `/app/profile` route**.

Owner observation (menu Profile and direct `/app/profile` fail with application error UI) is therefore a **deployment omission**, not a Supabase/RLS/runtime query bug in a deployed page.

### Classification

| Question | Answer |
| --- | --- |
| Did deployed Preview contain the profile page? | **No** |
| Failure type | **Deployment / missing route** (AccountMenu pointed at a route that was never shipped) |
| Runtime exception category | Soft/client navigation + missing App Router segment for `/app/profile` (not a profile `.single()` / RLS crash on a real page) |
| Owner UI copy | “This page couldn't load” / “Reload to try again, or go back.” — **not** present in Quotr source; treated as the host/framework failure surface for the missing segment. No SQL, tokens, or raw Supabase errors were exposed by Quotr profile code. |

## Fix

1. Add and track `app/(protected)/app/profile/page.tsx`.
2. Harden loader states A–E (login / render / setup-required / org integrity / null-safe fields).
3. Extend 2A verify with **git-tracked** guard; add `scripts/verify-stage-3-1c2a-r1-profile-route.ts`.

## Profile data-loading (after fix)

Same authority as 2A design:

| Field | Source |
| --- | --- |
| Full name | `profiles.full_name` |
| Email | Auth `user.email` |
| Role | `profiles.role` (default label “Member” if empty) |
| Organisation | `organisations.name` for `profiles.org_id` |

Missing profile / missing `org_id` / unresolvable organisation → `/app/setup-required` (not a generic 500).

## AccountMenu / Company settings / Logout

- Profile → `/app/profile` (canonical)
- Company settings → `/app/settings/company` (**exists**; not a dead link)
- Logout → server `signOut` → `/login` (unchanged)

## Status board

| Item | Status |
| --- | --- |
| Stage 3.1C.2A | Complete — Local (**not** Preview-passed) |
| Stage 3.1C.2A-R1 | Complete — Local; Preview Retest Pending |
| Stage 3.1C.2B | **NOT STARTED** |
| Stage 3.1C.3 | **NOT STARTED** |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c2a-r1-profile-route.ts
npx --yes tsx scripts/verify-stage-3-1c2a-account-profile.ts
```

## Preview retest

See `docs/runbooks/STAGE_3_1C2A_R1_PROFILE_ROUTE_PREVIEW_RETEST.md`.

**Do not mark 3.1C.2A Preview-passed until owner retest succeeds after deploying the tracked profile page.**
