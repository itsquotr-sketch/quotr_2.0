# Stage 3.1C.2B-R1 — Auth Entry Links & URL Configuration

**Status:** Complete — Local; Owner config + Preview E2E still required  
**Date:** 2026-08-09  
**Does not start:** 3.1C.3, Stage 3.2, Production Scope Discovery

## Forgot password on Login

Login already linked `/forgot-password` beside the Password label. R1 keeps that placement and strengthens:

- secondary muted styling (not dominant vs Sign in);
- `min-h-9` tap target;
- focus-visible ring;
- `href="/forgot-password"`.

## Site URL contract

`lib/auth/site-url.ts`:

1. **Prefer** validated `NEXT_PUBLIC_SITE_URL` (origin only).
2. Else request Origin / forwarded host (documented fallback — avoid relying on this for Preview emails).
3. Else `http://localhost:3000`.

`normalizeAuthSiteOrigin` rejects `javascript:`, `data:`, `//…`, credentials, non-http(s), paths/query/hash.

`buildAuthCallbackUrl` always appends `/auth/callback` and forces `next` through `getSafeInternalPath`.

### Origins

| Env | Origin |
| --- | --- |
| Local | `http://localhost:3000` |
| Preview stable | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| Production | placeholder until approved — not hard-coded |

## Owner runbook

`docs/runbooks/STAGE_3_1C2B_AUTH_URL_CONFIGURATION.md`

## Verify

```bash
npx --yes tsx scripts/verify-stage-3-1c2b-r1-auth-entry-and-urls.ts
```

## Status

| Item | Status |
| --- | --- |
| 3.1C.2B | Complete — Local |
| 3.1C.2B-R1 | Complete — Local; Owner URL config + Preview E2E Pending |
| 3.1C.3 | **NOT STARTED** |
| Production Scope Discovery | Disabled |
| Stage 3.2 | Not Started |
