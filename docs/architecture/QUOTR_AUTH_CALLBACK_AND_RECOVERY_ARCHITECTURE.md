# Quotr Auth Callback & Account Recovery Architecture

**Status:** Active (Stage 3.1C.2B)  
**Packages:** `@supabase/ssr` 0.12.0 (PKCE), `@supabase/supabase-js` 2.108.2, Next.js 16.2.9

## Flows

### Signup confirmation

1. `signUp` with `emailRedirectTo` → `/auth/callback?next=/app/dashboard`
2. If session exists immediately → transactional provision RPC → dashboard
3. If no session (`CONFIRMATION_PENDING`) → Check your email UX (optional resend)
4. User opens email link → `/auth/callback` → `exchangeCodeForSession(code)`
5. Profile/org present → safe `next` (default dashboard)
6. Profile/org missing → `/app/setup-required` → Finish setup RPC (3.1C.1B)

### Password recovery

1. Login → Forgot password → `/forgot-password`
2. `resetPasswordForEmail` with `redirectTo` → `/auth/callback?next=/reset-password`
3. Non-enumerating ack always on success path
4. Callback exchanges code → `/reset-password` with session
5. `updateUser({ password })` (no current password)
6. Session remains valid → redirect `/app/dashboard` (layout may send setup-required)

### Safe return (`next`)

Central helper: `lib/auth/safe-redirect.ts` (`getSafeInternalPath`).

- Middleware stores `?next=` when redirecting unauthenticated `/app/*` to login
- Login posts `next` and redirects via the same helper
- Callback uses the same helper for `next` query param

Rejects absolute URLs, `//…`, `javascript:`, `data:`, etc. Fallback: `/app/dashboard`.

## Email change decision (3.1C.2B)

**Deferred.** Profile email stays read-only.

Rationale: Supabase email change typically requires confirmation to the new address (and often re-auth / dual-inbox semantics). Shipping a partial change without that confirmation path would be unsafe. Revisit after callback/recovery is Preview-passed, as a later account-management item (not 3.1C.3 Company Setup).

## Rate limiting

Primary protection is Supabase Auth provider rate limits. Map to `RATE_LIMITED` safe copy. No in-memory Vercel limiter.

## Redirect URL configuration

See owner runbook: `docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md` (3.1C.2B-R1).

### `NEXT_PUBLIC_SITE_URL` (canonical email origin)

| Environment | Value |
| --- | --- |
| Local | `http://localhost:3000` |
| Preview | Stable branch alias `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| Production | Set only when live domain approved — do not invent |

Resolution order in `lib/auth/site-url.ts`: validated env → request origin fallback → localhost.

**Prefer env on Preview** so confirmation/reset emails do not bake commit-specific Vercel hosts.

Supabase Auth redirect allow-list must include:

- `http://localhost:3000/auth/callback`
- `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback`
- Production callback when the live domain exists

## Password policy

Shared module `lib/auth/password.ts`: minimum 8 characters, trim not whitespace-only, new/confirm match. Used by signup, logged-in change, and recovery reset.
