# Stage 3.1C.2A-R1 — Profile Route Preview Retest

**Status:** Pending owner after Preview deploy that includes `app/(protected)/app/profile/page.tsx`  
**Prerequisite:** Confirm deploy commit contains the profile page (`git ls-files` / GitHub tree / Vercel source).

## Preflight

1. Open Preview deployment source / commit SHA.
2. Confirm file present: `app/(protected)/app/profile/page.tsx`.
3. If missing → **do not proceed**; redeploy R1 commit.

## Owner checklist

1. Login normally.
2. Click top-right account avatar.
3. Click Profile → Profile page renders (not error boundary).
4. Refresh Profile → still renders.
5. Direct URL `/app/profile` → renders.
6. Edit full name → Save → refresh → name persists; menu reflects name after refresh.
7. Wrong current password → safe failure message (no raw errors).
8. Valid current + new (≥8) + confirm → success; can log in with new password.
9. Log out → `/login`.
10. Logged-out `/app/profile` → login (protected routing).
11. Login again → Profile still loads.
12. Mobile (~390px): same menu → Profile path.
13. Company settings from menu → `/app/settings/company` loads (not dead).

## Pass criteria

- [ ] All checklist items pass
- [ ] No raw Supabase / SQL / env / stack traces in UI
- [ ] 3.1C.2B still not started
- [ ] Production Scope Discovery still disabled

Only after this passes may Stage 3.1C.2A be marked Preview-passed.
