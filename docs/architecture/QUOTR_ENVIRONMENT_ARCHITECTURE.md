# Quotr environment architecture

**Classification:** CANONICAL environment authority (ENVIRONMENT-01).  
**Status:** Preview hosted project **created** — `quotr_preview` / `shhpjsoldmqtkdbgrbtm` (Sydney / `ap-southeast-2`).  
**Do not commit secrets.**

This document supersedes any runbook that assumed Preview and Production share Supabase project `lxvnylhsbvudzzupxeqr`.

---

## Topology

| Environment | Application | Database | Stripe (future BILLING-3) |
| --- | --- | --- | --- |
| **Local** | `next dev` at `http://localhost:3000` | Local Docker (`supabase start`) or a developer-chosen non-Production project | Not configured. Never live keys. |
| **Preview** | Stable branch alias `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | Hosted `quotr_preview` / `shhpjsoldmqtkdbgrbtm` (Sydney) | `BILLING_ENVIRONMENT=test` + Stripe **test** keys only |
| **Production** | Production domain when approved. **No Production app deploy in ENVIRONMENT-01.** | Existing `quotr_2.0` / `lxvnylhsbvudzzupxeqr` | `BILLING_ENVIRONMENT=live` + Stripe **live** keys only |

### Project refs

| Role | Name | Ref |
| --- | --- | --- |
| Production (keep) | `quotr_2.0` | `lxvnylhsbvudzzupxeqr` |
| Preview | `quotr_preview` | `shhpjsoldmqtkdbgrbtm` |
| Legacy inactive | `quotr` | `vwejrzdguuzxdgrvcnox` — **do not use** |

Local CLI `project_id` in `supabase/config.toml` is `quotr_local`. That is a Docker label, **not** a hosted ref.

---

## Vercel env ownership

### Preview

Must point at the **Preview** Supabase project after it exists:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Preview project only; optional for signup, required for Resend webhook / admin tooling)
- `NEXT_PUBLIC_SITE_URL=https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`

Do **not** leave Preview Vercel vars on `lxvnylhsbvudzzupxeqr`.

### Production

Must remain on `quotr_2.0` / `lxvnylhsbvudzzupxeqr`.

ENVIRONMENT-01: **do not change Production Vercel env. Do not deploy Production.**

---

## Auth

Each hosted Supabase project has its **own** Auth URL configuration.

| Project | Site URL | Redirect URLs |
| --- | --- | --- |
| Preview | Preview branch origin | `http://localhost:3000/auth/callback` and Preview `/auth/callback` |
| Production | Unchanged | Unchanged |

PKCE callback remains `/auth/callback`. Password reset and email confirmation stay on the same app routes. Preview emails must use Preview `NEXT_PUBLIC_SITE_URL`.

---

## Migrations

Canonical schema is repository migrations **001–036 and 038–045**. There is **no 037**.

Apply to Preview with `npm run db:preview:push` (ref `shhpjsoldmqtkdbgrbtm`).

Never `supabase db push --linked`.  
Never default the CLI link to Production.

Safe commands: `docs/runbooks/ENVIRONMENT_01_PREVIEW_SUPABASE.md`.

---

## Seed

Do **not** dump Production rows (PII, Quotes, acceptances, delivery tokens).

Preview data = fresh signup + synthetic builder activity. See the Preview runbook seed strategy.

---

## Storage

App storage is bucket `organisation-branding` from migration `034`. Applying Preview migrations creates the bucket and policies. Do not copy Production logo files.

Drawn Quote signatures are stored as SVG text in the database, not Storage.

---

## Resend / public Quotes

Public Quote links are `/q/[token]` on the **application** origin.

After the Preview DB switch:

- Preview sends and accepts against Preview `quote` / token rows
- `NEXT_PUBLIC_SITE_URL` must remain the Preview origin so email links hit Preview
- Resend webhook on the Preview deployment writes to Preview `SUPABASE_SERVICE_ROLE_KEY`
- Production Resend: **do not change**

Until a Production app exists, Resend is Preview-only in practice.

---

## External services

| Variable | Preview | Production |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | May keep existing non-billing test configuration. Live AI remains opt-in (`RUN_LIVE_AI_TESTS`, `SCOPE_DISCOVERY_ENABLED`) | Unchanged |
| Google Maps / Google generative | Not used | Not used |
| Stripe | Not implemented. Future test keys only | Future live keys only |

Do not rotate keys in ENVIRONMENT-01.

---

## Future Stripe contract (do not implement now)

```
# Preview
BILLING_ENVIRONMENT=test
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Production
BILLING_ENVIRONMENT=live
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Preview must never receive live Stripe keys. Production must never receive test Stripe keys.

Even after databases are separate, billing rows still carry `billing_environment` (`test` \| `live`) as defence in depth (BILLING-0). Preview DB stores test only. Production DB stores live only.

---

## Local development

Ordinary `next dev` must **not** use Production (`lxvnylhsbvudzzupxeqr`). `lib/env.ts` fails closed if it does.

Preferred: `npx supabase start` → `http://127.0.0.1:54321`.  
This machine did not have Docker running during ENVIRONMENT-01-R1, so `.env.local` was pointed at **hosted Preview** (`shhpjsoldmqtkdbgrbtm`) instead. Previous Production values were copied to gitignored `.env.production.local` (ops only; not for `next dev`).

---

## Vercel Preview cutover (owner)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are currently one Vercel row attached to **Preview and Production**. They must be **split**:

1. Keep **Production** values on Production only (`lxvnylhsbvudzzupxeqr`).
2. Set **Preview-only** values to `quotr_preview` (`https://shhpjsoldmqtkdbgrbtm.supabase.co` + that project's anon + service role).
3. Redeploy Preview branch `hardening/stage-2a-security` only.

Do not change Production values. Do not deploy Production.

---
