# Stage 3.1C.1B — Transactional Provisioning Implementation

**Status:** Complete — Local; Migration **032 Applied and Verified Remote** (2026-08-09)  
**Date:** 2026-08-09  
**Migration:** `032_transactional_signup_provisioning.sql` — **Applied and Verified Remote** on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Remote apply record:** `docs/implementation/STAGE_3_1C1B1_REMOTE_032_APPLY_COMPLETION.md`

## Before → After

| | Before (AUTH-001) | After (3.1C.1B) |
| --- | --- | --- |
| Auth | `auth.signUp` | `auth.signUp` (unchanged) |
| Session | Optional; admin path ran regardless | Session **required** for provisioning RPC |
| Org create | Service-role insert | Inside RPC transaction |
| Profile create | Service-role insert (separate) | Same RPC transaction |
| Atomicity | No | Yes |
| Idempotency | No | Yes (`already_provisioned`) |
| Service-role for signup | Required | **Not required** |
| Recovery | Sign-out dead end | `finishAccountSetup` → same RPC |

## Function

`public.provision_organisation_for_new_user(p_organisation_name text, p_full_name text)`

Returns: `(org_id uuid, profile_id uuid, already_provisioned boolean)`

## Email confirmation strategy

**Option B with deferred repair (documented dependency on 3.1C.2):**

1. If `signUp` yields a session (or immediate `signInWithPassword` succeeds) → call RPC → dashboard.
2. If no session (confirmation required) → return `CONFIRMATION_PENDING` honestly; **do not** claim company setup completed; **do not** use service-role to provision.
3. After user confirms and signs in → protected layout routes missing profile to `/app/setup-required` → Finish account setup → same RPC.

Auth callback / deep-link confirmation routing remains **3.1C.2**.

## Application modules

- `lib/auth/provisioning.ts` — shared RPC caller
- `app/(auth)/actions.ts` — `signup`, `finishAccountSetup`, `login`, `logout`
- `app/(protected)/app/setup-required/page.tsx` — repair form

## Admin client

`lib/supabase/admin.ts` retained for local verification / privileged tooling. **No production signup call site.**
