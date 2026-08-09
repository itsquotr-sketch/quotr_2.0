# Stage 3.1C — Transactional Signup Provisioning Design

**Status:** Design only (Stage 3.1C.1B ready)  
**Date:** 2026-08-09  
**Batch:** Authored during 3.1C.1A — **do not implement migration 032 in 1A**

## Problem (AUTH-001 — verified)

Current signup in `app/(auth)/actions.ts`:

1. `supabase.auth.signUp({ email, password })` — creates `auth.users` (and may create a session)
2. Service-role `organisations` insert
3. Service-role `profiles` insert linking `auth.users.id` → `org_id`

Properties of current design:

| Property | Current |
| --- | --- |
| Atomic org+profile | **No** |
| Idempotent for same auth user | **No** |
| Orphan `auth.users` if org/profile fails | **Yes** |
| Orphan `organisations` if profile fails | **Yes** |
| Requires `SUPABASE_SERVICE_ROLE_KEY` for normal signup | **Yes** |
| Client-supplied user/org ids | **No** (ids server/DB generated) — keep this |

3.1C.1A remediates error leakage, config fail-closed, and logging. It **does not** change this architecture.

## Target flow (3.1C.1B)

```
auth.signUp (or existing authenticated session for recovery)
  → authenticated call to narrowly scoped
      provision_organisation_for_new_user(organisation_name, full_name)
  → DB transaction creates organisation + profile atomically
  → redirect / dashboard or setup complete
```

**Normal signup after 1B should not need the service-role client** for org/profile creation.

## RPC sketch (not implemented)

Suggested name: `provision_organisation_for_new_user`

Parameters (example):

- `p_organisation_name text`
- `p_full_name text`

**Must not accept:**

- arbitrary `user_id`
- arbitrary `org_id`
- role elevation inputs from the client

### Required properties

1. **SECURITY DEFINER** only if required to insert organisation under RLS; prefer least privilege. If DEFINER: explicit `SET search_path = public` (or locked schema list).
2. Derive subject as `auth.uid()` inside the function — never trust client user id.
3. **Idempotent:** if a profile already exists for `auth.uid()`, return existing `org_id` / profile; **do not** create another organisation.
4. Create organisation + profile in **one transaction**.
5. Preserve **one-user-one-org** product model (owner role on first provision).
6. Cross-org claim impossible (cannot attach to another org; cannot pass foreign org id).
7. Safe error return to the app (map to auth error taxonomy; no raw SQL to UI).
8. **Recovery-callable** for a legitimate authenticated user with no profile (setup-required “Finish account setup”).

### Pseudocode

```sql
-- DESIGN ONLY — not migration 032
CREATE OR REPLACE FUNCTION public.provision_organisation_for_new_user(
  p_organisation_name text,
  p_full_name text
)
RETURNS TABLE (org_id uuid, profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_org uuid;
  v_org_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT p.org_id INTO v_existing_org
  FROM profiles p WHERE p.id = v_uid;

  IF v_existing_org IS NOT NULL THEN
    -- idempotent: already provisioned
    RETURN QUERY SELECT v_existing_org, v_uid;
    RETURN;
  END IF;

  INSERT INTO organisations (name)
  VALUES (trim(p_organisation_name))
  RETURNING id INTO v_org_id;

  INSERT INTO profiles (id, org_id, full_name, role)
  VALUES (v_uid, v_org_id, trim(p_full_name), 'owner');

  RETURN QUERY SELECT v_org_id, v_uid;
END;
$$;
```

Grants: `authenticated` EXECUTE only; revoke from `anon` / `public` as appropriate. Review with Stage 2A least-privilege style (cf. migrations 026/031).

## Application changes (1B)

- Replace admin org/profile inserts in `signup()` with authenticated RPC after `signUp` / session available.
- Add setup-required “Finish account setup” server action calling the same RPC.
- Keep `createAdminClient` for other trusted ops only if still needed; remove signup dependency.
- Extend verify script for idempotency + orphan absence.

## Setup-required recovery (design for 1B)

### Why current recovery fails

| State | Behaviour today |
| --- | --- |
| Auth user exists, profile missing, org missing | Layout sends user to `/app/setup-required` |
| On setup-required | Copy asks user to **sign out**, then use Sign up |
| Authenticated `/signup` | Middleware redirects to `/app/dashboard` → layout → setup-required (**loop** if they stay signed in) |
| Re-signup after sign-out | May fail with “already registered”; orphan auth user remains |

So auth-user-without-profile cannot complete company linking without either deleting the auth user or a recovery provision path.

### Target recovery UX

```
authenticated user lacking profile/org
  → /app/setup-required
  → “Finish account setup” (name + organisation fields)
  → same idempotent provision RPC
  → /app/dashboard
```

Do **not** implement in 1A without the transactional RPC (would still risk orphans via service-role).

## Explicit non-goals for 1B (unless separately authorised)

- Multi-org membership / invites
- Password reset / auth callback (3.1C.2)
- Weakening Stage 2A tenant isolation
- Production Scope Discovery enablement

## Migration status

| Artifact | Status |
| --- | --- |
| This design doc | Created in 3.1C.1A |
| Migration 032 | **Implemented locally** in 3.1C.1B — Remote Pending Owner Gate |
| RPC implementation | **Complete — Local** — see `STAGE_3_1C_TRANSACTIONAL_PROVISIONING_IMPLEMENTATION.md` |
