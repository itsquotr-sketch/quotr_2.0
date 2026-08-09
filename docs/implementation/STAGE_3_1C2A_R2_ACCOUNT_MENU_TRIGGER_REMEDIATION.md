# Stage 3.1C.2A-R2 — Account Menu Trigger Interaction Remediation

**Status:** Complete — Local; Preview Retest Pending  
**Date:** 2026-08-09  
**Does not start:** 3.1C.2B, 3.1C.3, Stage 3.2, Production Scope Discovery

## Exact root cause

`AccountMenu` rendered `DropdownMenuLabel`, which is Base UI `Menu.GroupLabel`.

`GroupLabel` **requires** a parent `Menu.Group` (`DropdownMenuGroup`). Without it, opening the menu mounts the popup and throws:

> Base UI: MenuGroupContext is missing. Menu group parts must be used within `<Menu.Group>` or `<Menu.RadioGroup>`.

Symptoms:

- Top-right header avatar click → menu fails to open (appears dead)
- Sidebar account row click → same
- Direct `/app/profile` still works (no menu open required)

Working menus (`ProjectActionsMenu`, `BusinessStatusControl`) never use `DropdownMenuLabel`, so they were unaffected.

This is **not** pointer-events, z-index, or a static stub — both surfaces already used a real `DropdownMenuTrigger`.

## Fix

1. Wrap identity `DropdownMenuLabel` in `DropdownMenuGroup`.
2. Strengthen trigger UX: `cursor-pointer`, header `size-9` tap target, sidebar/panel full-row `min-h-11` hit target, decorative Avatar `pointer-events-none`.
3. Keep one shared `AccountMenu` (header / sidebar / panel).

## Architecture result

One reusable `AccountMenu` → header / sidebar / panel variants. Same actions: Profile, Company settings, Log out.

## Logout / name refresh

- Logout still calls server `logout` → `signOut` → `/login`.
- Full-name save already `revalidatePath("/app", "layout")` so shell/menu identity updates after navigation/refresh (no polling).

## Status board

| Item | Status |
| --- | --- |
| Stage 3.1C.2A | Complete — Local; **not Preview-passed** until interaction retest |
| Stage 3.1C.2A-R1 | Complete — Local (route shipped) |
| Stage 3.1C.2A-R2 | Complete — Local; Preview Retest Pending |
| Stage 3.1C.2B | **NOT STARTED** |
| Stage 3.1C.3 | **NOT STARTED** |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c2a-r2-account-menu-trigger.ts
```

Static only — Preview owner click tests remain required (`docs/runbooks/STAGE_3_1C2A_R2_ACCOUNT_MENU_TRIGGER_PREVIEW_RETEST.md`).
