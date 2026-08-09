# Stage 3.1C.2A-R2 — Account Menu Trigger Preview Retest

**Status:** Pending owner after Preview deploy  
**Prerequisite:** Deploy includes `components/layout/account-menu.tsx` with `DropdownMenuGroup` wrapping the identity label.

## DESKTOP HEADER

1. Click top-right initials/avatar → menu visibly opens.
2. Profile → `/app/profile`.
3. Company settings → `/app/settings/company`.
4. Escape closes.
5. Click outside closes.
6. Enter/Space on focused trigger opens.

## SIDEBAR

7. Click bottom-left account row (not only the tiny avatar) → same menu opens.
8. Profile works.
9. Log out → `/login` (session cleared).

## PROFILE NAME

10. Edit full name → Save.
11. Return to Dashboard → account displays updated identity (no re-login).

## MOBILE (~390px)

12. Open Menu sheet → account control responds.
13. Profile / Company settings / Log out work.
14. Menu not clipped off-screen.

## Pass criteria

- [ ] All items pass
- [ ] No “dead” avatar/sidebar clicks
- [ ] 3.1C.2B still not started
- [ ] Production Scope Discovery still disabled

Only after this passes may Stage 3.1C.2A be marked Preview-passed.
