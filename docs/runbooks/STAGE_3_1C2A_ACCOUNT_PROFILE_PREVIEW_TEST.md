# Stage 3.1C.2A — Account / Profile Preview Test

**Status:** Pending owner after Preview deploy  
**Depends on:** Stage 3.1C.2A app code deployed

## TEST 1 — Account menu (desktop)

1. Open Dashboard.
2. Click top-right avatar → menu opens with name + email.
3. Items: Profile, Company settings, Log out.
4. Escape / outside click closes menu.
5. Click sidebar account block → same menu works.

## TEST 2 — Logout

1. From menu → Log out.
2. Land on `/login`.
3. Browser Back must not show a usable authenticated dashboard (redirect to login).
4. Repeat from a project page and from Profile.

## TEST 3 — Profile

1. Menu → Profile → `/app/profile`.
2. Full name editable; Save updates header/menu name after refresh/navigation.
3. Email / role / organisation read-only.
4. Company settings link works.
5. Unauthenticated visit to `/app/profile` → login.

## TEST 4 — Password change

1. On Profile → Security.
2. Wrong current password → safe failure (no raw errors).
3. Valid current + matching new/confirm (≥8) → success.
4. Sign out / sign in with new password works.

## TEST 5 — Mobile (~390px)

1. Top-right avatar reachable; menu fits viewport; Log out obvious.
2. Mobile Menu sheet shows account control that opens menu / Profile link.
3. Profile forms usable; no clipped CTAs.

## TEST 6 — Safety

No UI text containing env var names, SQL, function names, or raw Supabase errors.

## Pass criteria

- [ ] Tests 1–6 pass
- [ ] No password reset / auth callback claimed (those are 3.1C.2B)
- [ ] Production Scope Discovery still disabled
