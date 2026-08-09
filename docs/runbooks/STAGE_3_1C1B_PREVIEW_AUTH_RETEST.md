# Stage 3.1C.1B — Preview Auth Retest

**Status:** Blocked until migration **032** is applied remotely and the app is deployed  
**Depends on:** Owner gate for `032_transactional_signup_provisioning.sql`

## Preconditions

- [ ] 032 applied on Preview Supabase (owner-authorised)
- [ ] Preview deploy includes 3.1C.1B app code
- [ ] Confirm whether Preview Auth has email confirmation enabled

## A. Immediate-session signup (confirmation off or auto-confirm)

1. Private window → `/signup`
2. New email + password + full name + organisation
3. Expect redirect to dashboard (not setup-required)
4. Confirm one org / one profile in DB for that user (admin tooling)
5. Retry signup with same email → already registered safe message

## B. Confirmation-pending path (if confirmation enabled)

1. Signup with new email
2. Expect honest confirmation-pending message (company setup **not** claimed complete)
3. Confirm email via provider
4. Sign in → expect `/app/setup-required` if profile missing
5. Finish account setup → dashboard
6. Repeat Finish click → idempotent (no second org)

## C. Repair path

1. Create confirmed auth user without profile (local/admin only) **or** use B.4 state
2. Open `/app/setup-required`
3. Submit Finish account setup
4. Expect dashboard; no service-role errors; no SQL in UI

## D. Regression smoke

- Login invalid password → generic incorrect credentials
- Authenticated visit to `/signup` → dashboard or setup-required (no loop)
- Scope Discovery Production remains disabled

## Pass criteria

- [ ] No orphan organisation from failed provision attempts observed in happy path
- [ ] Idempotent repair
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` / SQL / function names in UI
- [ ] No password reset / auth callback claimed complete (still 3.1C.2)
