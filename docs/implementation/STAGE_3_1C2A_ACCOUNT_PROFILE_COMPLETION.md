# Stage 3.1C.2A — Account Menu, Logout, Profile — Completion

**Status:** Complete — Local; **not Preview-passed** (see 3.1C.2A-R1)  
**Date:** 2026-08-09  
**Verify:** `npx --yes tsx scripts/verify-stage-3-1c2a-account-profile.ts`

> **Preview defect (3.1C.2A-R1):** Commit `59bc1f7` shipped AccountMenu + Profile UI/actions but **omitted** `app/(protected)/app/profile/page.tsx` from git. Preview therefore had no `/app/profile` route. Remediation: `docs/implementation/STAGE_3_1C2A_R1_PROFILE_ROUTE_REMEDIATION.md`.

## Root cause

1. **Top-right `UserMenu`** used Base UI-incompatible `onSelect` handlers for navigation (working menus elsewhere use `onClick`), so Profile/Company/Rates items appeared dead.
2. **Sidebar / mobile `SidebarAccount`** was a **non-interactive display stub** — the most visible “account” chrome did nothing when clicked.
3. **No `/app/profile` route** and no Profile entry in the intended product menu.
4. Logout existed (`logout` server action + flaky form submit) but was not an obvious, reliable path from the broken menu.

## Account menu architecture

Reusable `components/layout/account-menu.tsx` (`AccountMenu`):

- Header variant (avatar) on page headers
- Sidebar / panel variants for desktop sidebar + mobile sheet
- Items: Profile, Company settings, Log out
- `UserMenu` re-export for existing imports

## Logout

`logout` server action: `supabase.auth.signOut()` → structured `logout` event → `/login`. Invoked via `startTransition` from the menu (pending “Signing out…”). Middleware still blocks unauthenticated `/app/*`.

## Profile

Route: `/app/profile`

| Field | Source | Editable |
| --- | --- | --- |
| Full name | `profiles.full_name` | Yes |
| Email | auth `user.email` | Read-only (change deferred to 3.1C.2B) |
| Role | `profiles.role` | Read-only |
| Organisation | `organisations.name` | Read-only + Company settings link |

Actions: `lib/auth/profile-actions.ts` — `updateProfileFullName`, `changePassword`.

## Password change

Logged-in flow: current → new → confirm. Reauth via `signInWithPassword`, then `updateUser({ password })`. No password logging. Forgot-password email flow remains **3.1C.2B**.

## Migration

**None.** Existing schema sufficient.

## Status board

| Item | Status |
| --- | --- |
| Stage 3.1C.2A | Complete — Local; Preview Test Pending |
| Stage 3.1C.2B | Ready Next (callback / forgot password / redirect-back) |
| Stage 3.1C.3 | Planned (first-run / company setup UX) |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## Files created

- `components/layout/account-menu.tsx`
- `components/profile/ProfilePageContent.tsx`
- `app/(protected)/app/profile/page.tsx`
- `lib/auth/profile-actions.ts`
- `scripts/verify-stage-3-1c2a-account-profile.ts`
- `docs/architecture/QUOTR_ACCOUNT_PROFILE_AND_COMPANY_BOUNDARY.md`
- `docs/implementation/STAGE_3_1C2A_ACCOUNT_PROFILE_COMPLETION.md`
- `docs/runbooks/STAGE_3_1C2A_ACCOUNT_PROFILE_PREVIEW_TEST.md`

## Files modified

- `components/layout/user-menu.tsx` (re-export)
- `components/layout/sidebar-account.tsx`
- `components/layout/mobile-menu-sheet.tsx`
- `app/(auth)/actions.ts` (logout logging)
- `lib/auth/errors.ts`, `lib/auth/logging.ts`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`
- `docs/PRODUCTION_READINESS.md`
