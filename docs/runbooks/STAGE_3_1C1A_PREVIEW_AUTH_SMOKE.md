# Stage 3.1C.1A — Preview Auth Smoke (Limited)

**Status:** Ready after Preview deploy of 3.1C.1A  
**Scope:** Signup/login safety only — not Owner E2E, not Scope Discovery Production enablement

## Preconditions

- Preview deployment includes 3.1C.1A auth changes.
- Vercel Preview env has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and **`SUPABASE_SERVICE_ROLE_KEY`** set for the happy path.
- Do not enable `SCOPE_DISCOVERY_ENABLED` on Production as part of this test.

## A. Happy path (service role present)

1. Open `/signup` in a private window.
2. Create a **new** unused email + password (≥8 chars) + organisation name.
3. Expect: redirect to dashboard **or** safe “check your email” confirmation message (not a raw provider string).
4. Confirm no UI text contains `SUPABASE_SERVICE_ROLE_KEY`, SQL, or stack traces.
5. Sign out; sign in at `/login` with the same credentials (if email confirmation allows).
6. Invalid password: expect **“Email or password is incorrect.”** only.

## B. Config failure simulation (optional, controlled)

Only if you can temporarily remove `SUPABASE_SERVICE_ROLE_KEY` from Preview **without** committing secrets or logging them:

1. Redeploy / restart with key absent.
2. Attempt signup.
3. Expect safe message such as: “We couldn’t create your account right now. Please try again shortly.”
4. Expect **no** env var names in the UI.
5. Restore the key immediately after the test.

Prefer local verification via `npx --yes tsx scripts/verify-stage-3-1c1a-auth-safety.ts` for deterministic config coverage.

## C. Logging spot-check (server)

In Preview/server logs for a successful signup, look for structured `[auth]` events (no passwords/tokens/emails required):

- `signup_started`
- `auth_user_created`
- `organisation_provisioned`
- `profile_linked`
- `signup_completed`

On failure: `signup_failed` with a category — not raw DB text.

## Pass criteria

- [ ] Happy-path signup does not show technical diagnostics
- [ ] Login invalid credentials message is generic
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` string in any auth UI error
- [ ] Middleware still redirects authenticated users away from `/login`/`/signup`
- [ ] `/app/setup-required` still reachable for zero-org users (sign-out CTA)

## Explicitly out of scope

- Transactional provisioning / orphan recovery finish-setup (3.1C.1B)
- Password reset / auth callback (3.1C.2)
- Scope Discovery Owner E2E
- Stage 3.2
