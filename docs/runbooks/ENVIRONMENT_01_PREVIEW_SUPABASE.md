# ENVIRONMENT-01 — Separate Preview Supabase

**Status:** ENVIRONMENT-01-R2 — Preview schema **001–045 applied**. Vercel Preview env **cut over** to `shhpjsoldmqtkdbgrbtm`. Production remains `lxvnylhsbvudzzupxeqr`.  
**Production:** `quotr_2.0` / `lxvnylhsbvudzzupxeqr` — **do not migrate, do not reconfigure Auth, do not change Resend, do not deploy.**  
**Canonical architecture:** `docs/architecture/QUOTR_ENVIRONMENT_ARCHITECTURE.md`

This runbook creates a **new empty** Preview database from repository migrations 001–036, 038–045. It does **not** clone Production customer data.

---

## Why this is blocked on the owner

Hosted project creation needs the Supabase org account, a database password, and billing on that org. The CLI on this machine **is logged in** (`npx supabase projects list` works) but ENVIRONMENT-01 must **not** invent credentials or create the project automatically.

Existing hosted projects:

| Name | Ref | Status | Use |
| --- | --- | --- | --- |
| `quotr_2.0` | `lxvnylhsbvudzzupxeqr` | ACTIVE | **Production only** |
| `quotr` | `vwejrzdguuzxdgrvcnox` | INACTIVE | **Do not revive as Preview** |

There is **no** Preview project yet.

Optional CLI create (owner only, owner-chosen password — do not paste the password into chat or git):

```powershell
npx supabase projects create quotr_preview --org-id <same-org-as-quotr_2.0> --region ap-northeast-1 --db-password <owner-password-manager>
```

Prefer the Dashboard so the password never appears in a terminal history.

---

## A. Owner — create Preview project (Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → New project.
2. Organisation: **same org as `quotr_2.0`**.
3. Name: `quotr_preview`.
4. Region: `ap-northeast-1` (match Production) unless you explicitly choose Sydney (`ap-southeast-2`) for NZ latency. Record the choice.
5. Generate a strong database password. Store it in the password manager. **Not in the repo.**
6. Do **not** restore/clone from `quotr_2.0`. Empty project.
7. Wait until status is `ACTIVE_HEALTHY`.
8. Settings → General: copy **Project ID** (20-character ref).
9. Settings → API: copy Project URL, `anon` `public` key, `service_role` `secret` key.

Give the developer:

- Preview project ref
- Preview URL
- Preview anon key
- Preview service-role key (for Vercel Preview + webhook/admin only)

Do not send Production keys again. Do not commit keys.

---

## B. Owner — Preview Auth (this project only)

Dashboard → **Preview project** → Authentication → URL Configuration.

**Site URL**

```
https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app
```

**Redirect URLs** (exact):

```
http://localhost:3000/auth/callback
https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/auth/callback
```

Enable Email provider (signup / magic-link unused; password + confirm as today). Mirror Production **email confirmation** on/off so Preview signup behaviour matches current product — do this by **reading** Production Auth settings, not by changing Production.

Do **not** edit Production Auth URLs.

---

## C. Developer — record Preview ref (no secrets)

```powershell
# supabase/.preview-project-ref is gitignored
Set-Content -NoNewline supabase/.preview-project-ref "<PREVIEW_REF>"
```

Or set session env:

```powershell
$env:QUOTR_SUPABASE_PREVIEW_PROJECT_REF = "<PREVIEW_REF>"
```

Confirm it is **not** `lxvnylhsbvudzzupxeqr`.

---

## D. Apply schema (Preview only)

From repo root:

```powershell
npm run db:preview:status
npm run db:preview:push-dry
npm run db:preview:push
npm run db:preview:status
```

Expected: remote history **001–036, 038–045**. No 037.

The wrapper:

- refuses `--linked`
- passes `--project-ref` and `--skip-vault`
- refuses Preview ref = Production ref
- does not dump data

If `db:preview:status` says Preview ref is not set, stop — owner has not finished section A.

### Forbidden

```text
npx supabase db push --linked
npx supabase db push
npm run db:production:push
```

Production push additionally requires `CONFIRM_PRODUCTION_DB=lxvnylhsbvudzzupxeqr` and is **out of scope** for ENVIRONMENT-01.

---

## E. Owner — Vercel Preview env (do not touch Production)

Vercel → Project → Settings → Environment Variables → **Preview** only:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview service role |
| `NEXT_PUBLIC_SITE_URL` | `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` |

Leave Production copies of those names pointing at `lxvnylhsbvudzzupxeqr`.

Keep existing Preview `ANTHROPIC_*`, `RESEND_*`, `SCOPE_DISCOVERY_ENABLED` unless a var currently embeds the Production Supabase URL (it should not).

**Redeploy** the `hardening/stage-2a-security` Preview after env changes.

---

## F. Resend (Preview only)

After the DB switch, Quote tokens live in Preview.

- App origin for links = `NEXT_PUBLIC_SITE_URL` (Preview alias)
- Webhook URL should remain the Preview deployment (`/api/webhooks/resend`)
- Webhook uses Preview `SUPABASE_SERVICE_ROLE_KEY` after redeploy
- Do not change Production Resend

If Resend still points at a host that used the shared DB, old Production-shared delivery rows stay on Production; new Preview sends write Preview rows. That is the intended split.

---

## G. Seed strategy (no Production dump)

1. Open Preview URL after redeploy.
2. Sign up a **new** email (not a Production user — Auth directories are separate).
3. Complete Company Basics.
4. Optionally add a couple of rates, create a Project, Analyse (fair-use / skip paid suite if desired), Estimate, Pricing, Quote.
5. Send/accept only if Preview Resend is configured; otherwise exercise the secure link path with a Preview-issued token.

No SQL seed file. No customer PII copy. Logos: upload a synthetic file on Preview if branding is tested.

---

## H. Isolation proof

1. Preview `/app/health` shows Deployment **Preview** and a Supabase ref **other than** `lxvnylhsbvudzzupxeqr`.
2. Create org/project on Preview.
3. Confirm that org **does not** appear in Production Table Editor (`quotr_2.0`).
4. Confirm Production Auth users list does not gain the new Preview email.

Owner smoke: `docs/runbooks/ENVIRONMENT_01_OWNER_SMOKE.md`.

---

## I. Local `.env.local`

This machine currently had `NEXT_PUBLIC_SUPABASE_URL` on Production. After Preview exists, point **local** at:

- `supabase start` (preferred for schema work), or
- Preview keys (for hosted Preview-parity)

Do not keep day-to-day local development on Production.

---

## J. CLI link safety

`supabase link` writes `supabase/.temp/project-ref` and makes `db push --linked` target that project. ENVIRONMENT-01 unlinks the default so Production is not the implicit target.

If someone re-links, they must still use `npm run db:preview:*` / `db:production:*`.
