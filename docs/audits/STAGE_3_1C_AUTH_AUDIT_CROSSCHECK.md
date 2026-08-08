# Stage 3.1C — Auth Audit Cross-check

**Status:** Complete  
**Date:** 2026-08-09  
**Source:** Independent Claude auth/signup audit (treated as claims, not truth)  
**Remediation batch:** Stage 3.1C.1A (safety / config / diagnostics only)

## Method

Each Claude claim was verified against repository HEAD before remediation, then re-checked after 3.1C.1A changes where applicable.

## Verified current-state map (pre-1A)

| Surface | Role |
| --- | --- |
| `app/(auth)/actions.ts` | Server actions: `signup`, `login`, `logout` |
| `app/(auth)/signup/page.tsx` | Client form → `signup` action |
| `app/(auth)/login/page.tsx` | Client form → `login` action |
| `lib/supabase/admin.ts` | Server-only service-role client (`import "server-only"`) |
| `lib/supabase/server.ts` | Cookie SSR anon client |
| `lib/env.ts` | Public env required; service-role **optional** at boot |
| `lib/errors/user-message.ts` | Generic app error mapper (not used by auth actions) |
| `middleware.ts` | Session refresh; `/app` requires user; auth routes redirect if signed in |
| `app/(protected)/app/layout.tsx` | Second auth check; zero-org → `/app/setup-required` |
| `app/(protected)/app/setup-required/page.tsx` | Sign-out-first recovery copy only (no provision writes) |
| `lib/security/auth-org-context.ts` | Stage 2A org from profile; never client `org_id` |
| Verify scripts | Stage 2A auth-org / env safety; **no signup path coverage** |

## Claim register

| ID | Claude claim | Verdict | Evidence |
| --- | --- | --- | --- |
| **AUTH-001** | Signup provisioning is non-transactional: `auth.signUp` → service-role org insert → service-role profile insert | **Confirmed** | Pre-1A `actions.ts` sequential inserts; unchanged architecture in 1A (safety only). Design for transactional RPC deferred to 3.1C.1B. |
| **AUTH-002** | Catch-all turns unrelated failures into “Ensure SUPABASE_SERVICE_ROLE_KEY is set.” | **Confirmed (pre-1A)** | Catch returned that literal string. **Remediated in 1A** — safe `CONFIGURATION` / provision categories; literal removed. |
| **AUTH-005** | Raw Postgres/PostgREST errors can reach anonymous signup users | **Confirmed (pre-1A)** | `orgError?.message` and `profileError.message` returned. **Remediated in 1A**. |
| **AUTH-006** | Signup/login provisioning has effectively no useful structured logging | **Confirmed (pre-1A)** | No auth event logger. **Remediated in 1A** via `lib/auth/logging.ts`. |
| **AUTH-007** | `SUPABASE_SERVICE_ROLE_KEY` optional in env validation → Preview can deploy with broken signup | **Confirmed** | `lib/env.ts` `required: false` intentional for builds. **Partially remediated:** runtime `assertSignupServerConfiguration()` fails closed on signup without making the key a build-time requirement. |
| **AUTH-009** | Login forwards raw GoTrue errors, including distinguishable email-not-confirmed | **Confirmed (pre-1A)** | `return { error: error.message }`. **Remediated in 1A** — classified + enumeration-safe login presentation. |
| **AUTH-016** | Existing verification does not exercise signup | **Confirmed** | No prior `verify-*` script covered signup error/config paths. **Remediated in 1A** with `scripts/verify-stage-3-1c1a-auth-safety.ts`. |

### Related status (not numbered AUTH-00x in the batch prompt, but confirmed)

| Topic | Verdict |
| --- | --- |
| Password reset absent | **Confirmed** — no `resetPasswordForEmail` / reset UI / routes |
| Auth callback absent | **Confirmed** — no `/auth/callback` (or equivalent) route |
| Setup-required cannot finish orphan accounts while authenticated | **Confirmed** — middleware blocks `/signup` for signed-in users; page only offers sign-out |

## Inaccurate / overstated Claude claims

None of the numbered AUTH-001 / 002 / 005 / 006 / 007 / 009 / 016 claims were false against HEAD. Nuance:

- **AUTH-007** is accurate that optional boot validation allows broken signup **at runtime**; it is **not** accurate to treat “optional in `assertRequiredEnv`” as a bug by itself — Preview buildability is intentional. The defect is missing **signup-path** runtime assertion (now added).
- Catch-all (AUTH-002) primarily masked `createAdminClient()` throws; org/profile failures already returned earlier via `.message` (AUTH-005), so not every failure hit the catch-all.

## Post-1A status

| Claim | After 3.1C.1A |
| --- | --- |
| AUTH-001 | Still true (by design this batch) — tracked for 3.1C.1B |
| AUTH-002 | Fixed |
| AUTH-005 | Fixed |
| AUTH-006 | Fixed |
| AUTH-007 | Runtime fail-closed on signup; boot still optional |
| AUTH-009 | Fixed (login normalized) |
| AUTH-016 | Fixed (verify script added) |

## Out of scope for 1A (documented only)

- Transactional provisioning RPC / migration 032 → **3.1C.1B**
- Setup-required finish-setup action → **3.1C.1B** (needs RPC)
- Password reset + auth callback + redirect-back → **3.1C.2**
- Stage 3.2 / Production Scope Discovery enablement / commercial formula changes — not started / not enabled
