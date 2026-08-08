# Stage 3.1C.1A — Auth Safety, Configuration & Diagnostics — Completion

**Status:** Complete — Local  
**Date:** 2026-08-09  
**Verify:** `npx --yes tsx scripts/verify-stage-3-1c1a-auth-safety.ts`

## Intent

First auth remediation batch after independent Claude audit cross-check. Fix user-facing error leaks, signup runtime configuration fail-closed behaviour, structured auth logging, and login enumeration-safe messages — **without** changing provisioning architecture, password reset, or auth callback.

## Verified current-state map

See `docs/audits/STAGE_3_1C_AUTH_AUDIT_CROSSCHECK.md`.

Short map:

- Entry: `(auth)/signup` + `(auth)/login` → `actions.ts`
- Privileged bootstrap: `lib/supabase/admin.ts` (server-only) during signup org/profile
- Env: public required at boot; service-role optional at boot; signup asserts at runtime
- Zero-org: protected layout → `/app/setup-required` (sign-out only)
- Stage 2A: `getAuthOrgContext` / `requireAuthOrgContext` unchanged

## Signup architecture after 1A

**Unchanged (still AUTH-001):**

`auth.signUp` → runtime config assert → service-role org insert → service-role profile insert → session/sign-in fallback → redirect

Transactional RPC deferred to **3.1C.1B** (`docs/architecture/STAGE_3_1C_TRANSACTIONAL_SIGNUP_PROVISIONING_DESIGN.md`).

## Error taxonomy

Module: `lib/auth/errors.ts`

Internal categories: `CONFIGURATION`, `INVALID_CREDENTIALS`, `EMAIL_NOT_CONFIRMED`, `RATE_LIMITED`, `EMAIL_ALREADY_REGISTERED`, `SIGNUP_FAILED`, `ORG_PROVISION_FAILED`, `PROFILE_PROVISION_FAILED`, `UNKNOWN`

UI messages are category-mapped only. No env names, SQL, RLS, stacks, or raw provider objects.

### Login confirmation tradeoff

`EMAIL_NOT_CONFIRMED` is classified for **server logs**, but `presentLoginError` maps it to the same UI string as invalid credentials so login does not reveal whether an email exists / is unconfirmed. Signup’s post-provision “check your email” path remains a **usability** message after successful account+org+profile creation (not a raw GoTrue string).

## Environment validation

- `lib/env.ts`: service-role stays `required: false` (Preview buildability).
- `lib/auth/config.ts`: `assertSignupServerConfiguration()` / `evaluateSignupServerConfiguration()` — server runtime fail-closed before privileged provisioning.
- `.env.local.example` + `docs/PRODUCTION_READINESS.md` clarify runtime requirement.
- No `NEXT_PUBLIC` service-role alias.

## Logging

`lib/auth/logging.ts` — events: `signup_started`, `auth_user_created`, `organisation_provisioned`, `profile_linked`, `signup_completed`, `signup_failed`, `login_failed`.

Allowed: event, category, userId, orgId, elapsedMs, correlationId.  
Forbidden: password, tokens, service-role, email, raw payloads.  
`logAuthEvent` never throws into the auth flow.

## UI

Signup/login error regions use `role="alert"`. Pending/disabled submit unchanged. No mobile redesign.

## Security boundary

- Admin client remains `server-only`
- No service-role in props/client imports
- `org_id` still server-generated on insert; auth-org helpers untouched
- RLS not modified; no migration in this batch

## Password reset / callback

Confirmed absent → Stage **3.1C.2**.

## Setup-required

Still sign-out-first. Finish-setup design in transactional doc → **3.1C.1B**.

## Files created

- `lib/auth/errors.ts`
- `lib/auth/config.ts`
- `lib/auth/logging.ts`
- `scripts/verify-stage-3-1c1a-auth-safety.ts`
- `docs/audits/STAGE_3_1C_AUTH_AUDIT_CROSSCHECK.md`
- `docs/architecture/STAGE_3_1C_TRANSACTIONAL_SIGNUP_PROVISIONING_DESIGN.md`
- `docs/implementation/STAGE_3_1C1A_AUTH_SAFETY_COMPLETION.md` (this file)
- `docs/runbooks/STAGE_3_1C1A_PREVIEW_AUTH_SMOKE.md`

## Files modified

- `app/(auth)/actions.ts`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/login/page.tsx`
- `lib/env.ts`
- `.env.local.example`
- `docs/PRODUCTION_READINESS.md`
- `docs/product/QUOTR_PRODUCT_BACKLOG.md`
- `docs/plans/STAGE_3_PRODUCT_ROADMAP.md`
- `docs/MVP_HARDENING_GUIDE.md`

## Migration status

No migration. **032 not created.**

## Verification results

- `npx --yes tsx scripts/verify-stage-3-1c1a-auth-safety.ts` — **PASSED**
- `npx tsc --noEmit` — **PASSED**
- `npm run lint` — **PASSED**
- `npm run build` — **PASSED**

## Regression results

| Suite | Result |
| --- | --- |
| 2A.1 auth-org | PASSED |
| 2A.2 validation | PASSED |
| 2A.3A pricing actions | PASSED |
| 2A.3B quote actions | PASSED |
| 2A.4 database integrity | PASSED |
| 2A.5 tenant isolation | PASSED |
| env-safety | PASSED |
| RLS coverage | PASSED |
| Stage 3.1A | PASSED |
| Stage 3.1A-R1 | PASSED |
| Stage 3.1D | PASSED |
| Stage 3.1B.7F-R3 | PASSED |
| 2B.10 commercial authority | PASSED |

## Final status

| Item | Status |
| --- | --- |
| Stage 3.1C.0 Audit cross-check | Complete |
| Stage 3.1C.1A | Complete — Local |
| Preview external signup retest | Ready for LIMITED retest after deploy |
| Stage 3.1C.1B | Ready (transactional provisioning) |
| Stage 3.1C.2 | Planned (callback / password reset / routing) |
| Stage 3.1B Owner E2E | Open |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |
