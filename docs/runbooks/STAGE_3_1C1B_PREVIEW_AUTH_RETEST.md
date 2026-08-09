# Stage 3.1C.1B — Preview Auth Retest

**Status:** Ready after Preview deploy of full 3.1C.1B app wiring  
**Migration 032:** Applied and Verified Remote on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**App wiring:** Ready to Commit/Deploy (Stage 3.1C.1B.2)  
**Preview authentication test:** Pending owner  
**Completion / apply records:**  
- `docs/implementation/STAGE_3_1C1B_TRANSACTIONAL_PROVISIONING_COMPLETION.md`  
- `docs/implementation/STAGE_3_1C1B1_REMOTE_032_APPLY_COMPLETION.md`

## Preconditions (owner)

1. Commit + push recommended 1B.2 app wiring (see 1B.2 gate report).
2. Preview redeploy from that commit.
3. Confirm Preview `NEXT_PUBLIC_SUPABASE_URL` → `lxvnylhsbvudzzupxeqr`.
4. Confirm whether Preview Auth has **email confirmation** enabled.
5. Production `SCOPE_DISCOVERY_ENABLED` remains absent/false.

---

## TEST A — Clean signup

1. Private window → `/signup`.
2. New unused email, full name, organisation name, password (≥8).
3. Submit once (do not double-click).
4. **If session returned:** land on dashboard (or setup wizard if company setup incomplete — not setup-required).
5. **If confirmation required:** see confirmation-pending message; company setup **not** claimed complete.
6. In admin/DB: exactly **one** organisation and **one** profile for that user when provisioning ran.

## TEST B — Logout / login

1. Sign out.
2. `/login` with same credentials (after confirm if required).
3. Dashboard (or setup-required only if profile still missing).

## TEST C — Incorrect password

1. `/login` with valid email + wrong password.
2. Expect only: **Email or password is incorrect.**
3. No GoTrue/SQL/env text.

## TEST D — Provisioning repair

1. Use a safe test auth user **without** profile (local seed or confirmation-pending after confirm+login).
2. Expect `/app/setup-required` with **Finish account setup**.
3. Submit full name + organisation → dashboard.
4. Submit again (or revisit): **no second organisation**.

## TEST E — Mobile (~390px)

1. Signup and login at ~390px width.
2. No horizontal clipping/overflow; primary CTA usable; error alert readable.

## TEST F — Config / error safety

1. Force one failed login and (if possible) one failed signup validation.
2. UI must not show: `SUPABASE_SERVICE_ROLE_KEY`, RPC/function names, SQLSTATE, table/constraint names, RLS, stacks, raw Supabase errors.

---

## Pass criteria

- [ ] A–F completed
- [ ] No orphan org on happy-path signup
- [ ] Repair idempotent
- [ ] Production Scope Discovery still disabled
- [ ] Password reset / auth callback still absent (3.1C.2)

**Do not mark Stage 3.1C.1B Preview-verified until this pack is signed off.**
