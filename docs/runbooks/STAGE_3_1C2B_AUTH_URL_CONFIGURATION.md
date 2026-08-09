# Stage 3.1C.2B-R1 — Auth URL Configuration (Owner)

**Status:** Active  
**Branch:** `hardening/stage-2a-security`  
**Do not:** put secrets in this file; invent a Production domain; use commit-specific Vercel URLs as canonical Preview origin.

## Canonical origins

| Environment | Site origin | Callback |
| --- | --- | --- |
| **Local** | `http://localhost:3000` | `http://localhost:3000/auth/callback` |
| **Preview (stable branch)** | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback` |
| **Production** | `https://<production-domain-when-approved>` | `https://<production-domain-when-approved>/auth/callback` |

### Stable branch vs commit Preview URL

Vercel exposes:

- **Branch alias (preferred):** `…-git-hardening-stage-2a-security-….vercel.app` — stays useful across new commits.
- **Commit deployment URL (avoid for auth emails):** `…-<hash>-….vercel.app` — breaks when that deployment ages out.

Set Preview `NEXT_PUBLIC_SITE_URL` to the **branch alias** so confirmation/reset emails keep working after later deploys.

---

## A. Vercel Preview environment

In Vercel → Project → Settings → Environment Variables → **Preview**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | (existing Preview Supabase project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (existing anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | only if admin/ops paths need it (optional for normal signup) |
| Other existing app vars | unchanged |

**Do not** set Production `NEXT_PUBLIC_SITE_URL` to the Preview branch alias.

After changing Preview env vars → **redeploy** the Preview for `hardening/stage-2a-security` (env changes do not apply to an already-built deployment).

---

## B. Local `.env.local`

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
```

See `.env.local.example`. Restart `next dev` after changes.

---

## C. Supabase Site URL

Dashboard → **Authentication** → **URL Configuration** → **Site URL**

| When | Recommendation |
| --- | --- |
| Production domain **not** live yet | Keep Site URL on the **stable Preview** origin (or Local for pure local work). Do **not** pretend Preview is Production forever. |
| Production domain approved | Set Site URL to the **Production** origin. |

Site URL is Supabase’s default “home” for some redirects — keep it as the primary long-lived environment, not a disposable commit URL.

---

## D. Supabase Redirect URLs

Add **exact** allow-list entries:

```
http://localhost:3000/auth/callback
https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback
```

When Production exists, also add:

```
https://<production-domain-when-approved>/auth/callback
```

### Wildcards

Supabase may allow patterns such as `https://*-quotr1.vercel.app/auth/callback`. Prefer **exact** stable + local (+ production) entries first. If a wildcard is required for ephemeral Preview smoke, keep it as narrow as possible (team project suffix only) and still set `NEXT_PUBLIC_SITE_URL` to the **stable** branch origin so emails do not point at ephemeral hosts.

**Do not** allow arbitrary external origins.

---

## E. What NOT to configure

- Do not put service-role keys in `NEXT_PUBLIC_*`.
- Do not set Preview site URL to a commit-hash Vercel URL.
- Do not invent or hard-code a Production domain in app code.
- Do not add `javascript:` / `//evil.com` / credentialed origins as Site URL.
- Do not start Stage 3.1C.3 / 3.2 / Production Scope Discovery from this runbook.

---

## F. When to redeploy

Redeploy Preview whenever you change:

- `NEXT_PUBLIC_SITE_URL`
- Supabase public URL/anon key (rare)
- Auth callback code

Supabase Redirect URL allow-list changes apply immediately (no Vercel redeploy), but emails already sent keep their old links.

---

## G. How to verify

1. Login shows **Forgot password?** → `/forgot-password`.
2. Local signup/reset with confirmation enabled: email link host is `localhost:3000`.
3. Preview (after env + redeploy): email link host is the **stable branch** origin; path `/auth/callback`.
4. Forgot password email: `…/auth/callback?next=/reset-password` → reset form.
5. Logged-out deep link `/app/projects/…` → login `?next=` → returns internally (no absolute `next`).

Owner E2E pack: `docs/runbooks/STAGE_3_1C2B_ACCOUNT_RECOVERY_PREVIEW_TEST.md`.
