# Quotr — Account Profile vs Company Settings Boundary

**Status:** Active (Stage 3.1C.2A)  
**Date:** 2026-08-09

## Purpose

Keep personal account security separate from organisation commercial identity.

## PROFILE (`/app/profile`)

Personal user / account / security:

| Field | Authority | Editable in Profile |
| --- | --- | --- |
| Full name | `profiles.full_name` | Yes |
| Email | `auth.users` via session `user.email` | No — email change deferred (dual-confirm; see 3.1C.2B architecture) |
| Role | `profiles.role` | No |
| Organisation name | `organisations.name` via `profiles.org_id` | No (link to Company settings) |
| Password | Supabase Auth | Yes (logged-in change); recovery via Forgot Password (3.1C.2B) |

Account menu entry point: reusable `AccountMenu` (header + sidebar + mobile).

Auth recovery: `/auth/callback`, `/forgot-password`, `/reset-password` — see `QUOTR_AUTH_CALLBACK_AND_RECOVERY_ARCHITECTURE.md`.

## COMPANY SETTINGS (`/app/settings/company`)

Organisation / company defaults and commercial identity:

- company / trading identity
- rates defaults (also `/app/rates`)
- GST / currency
- quote branding / terms
- organisation settings

Profile must **not** duplicate these.

## Future batches

| Batch | Scope |
| --- | --- |
| **3.1C.2A** | Account menu, logout, Profile, logged-in password change |
| **3.1C.2B** | Email confirmation callback, Forgot Password / reset, redirect-back (**Preview-passed**) |
| **3.1C.3** | First-run company basics + Company Settings IA + readiness (**Complete — Local**) |
| Later | Profile email change (deferred from 2B) |

## Security rules

- Profile updates use `auth.getUser()` id only — never client-supplied user/org/role.
- No service-role required for profile or password change.
- Stage 2A org isolation unchanged.
