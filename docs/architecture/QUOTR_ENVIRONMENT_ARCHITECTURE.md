# Quotr environment architecture

**Classification:** CANONICAL environment authority (ENVIRONMENT-01).  
**Status:** ENVIRONMENT-01-R2 — Preview hosted project **cut over**. Vercel Preview env points at `quotr_preview` / `shhpjsoldmqtkdbgrbtm`. Production remains `quotr_2.0` / `lxvnylhsbvudzzupxeqr`.  
**Do not commit secrets.**

This document supersedes any runbook that assumed Preview and Production share Supabase project `lxvnylhsbvudzzupxeqr`.

---

## Topology

| Environment | Application | Database | Stripe |
| --- | --- | --- | --- |
| **Local** | `next dev` at `http://localhost:3000` | Preferred: local Docker (`supabase start`). Interim on this machine: hosted Preview `shhpjsoldmqtkdbgrbtm`. Never Production. | Stripe **TEST** only. `BILLING_ENVIRONMENT` unset → `test`. Never live keys. |
| **Preview** | Stable branch alias `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app` | Hosted `quotr_preview` / `shhpjsoldmqtkdbgrbtm` (Sydney) | Explicit `BILLING_ENVIRONMENT=test` + Stripe **TEST** only |
| **Production** | Production domain when approved. **No Production app deploy in BILLING-1.** | Existing `quotr_2.0` / `lxvnylhsbvudzzupxeqr` | Explicit `BILLING_ENVIRONMENT=live` + Stripe **LIVE** only (not configured in BILLING-1) |

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

**Cut over (ENVIRONMENT-01-R2):** Preview Vercel `NEXT_PUBLIC_SUPABASE_URL` resolves to `shhpjsoldmqtkdbgrbtm`. Production remains `lxvnylhsbvudzzupxeqr`.

Keep Preview-only:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://shhpjsoldmqtkdbgrbtm.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (quotr_preview)
- `SUPABASE_SERVICE_ROLE_KEY` (quotr_preview; required for Resend webhook / admin)
- `NEXT_PUBLIC_SITE_URL=https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`

Do **not** point Preview Vercel vars at `lxvnylhsbvudzzupxeqr`.

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
| Stripe | BILLING-1-R2: Preview TEST keys configured and verified. Production LIVE keys not in BILLING-1. | LIVE keys later; not configured in BILLING-1 |

Do not rotate keys in ENVIRONMENT-01.

---

## Stripe contract (BILLING-1)

Authority is explicit `BILLING_ENVIRONMENT`. Do not infer test/live from `VERCEL_ENV` alone.

```
# Preview
BILLING_ENVIRONMENT=test
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# STRIPE_PRICE_BUILDER_MONTHLY=price_...
# STRIPE_PRICE_BUSINESS_BASE_MONTHLY=price_...
# STRIPE_PRICE_BUSINESS_SEAT_MONTHLY=price_...

# Production (later; not BILLING-1)
BILLING_ENVIRONMENT=live
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

Publishable key is not required until BILLING-3 Checkout.

Preview must never receive live Stripe keys. Production must never receive test Stripe keys.

Even after databases are separate, billing rows still carry `billing_environment` (`test` \| `live`) as defence in depth (BILLING-0). Preview DB stores test only. Production DB stores live only.

Migration 046 is Preview-first after owner review. See `docs/architecture/QUOTR_BILLING_ARCHITECTURE.md`.

---

## Local development

Ordinary `next dev` must **not** use Production (`lxvnylhsbvudzzupxeqr`). `lib/env.ts` fails closed if it does.

Preferred: `npx supabase start` → `http://127.0.0.1:54321`.  
This machine did not have Docker running during ENVIRONMENT-01-R1, so `.env.local` was pointed at **hosted Preview** (`shhpjsoldmqtkdbgrbtm`) instead. Previous Production values were copied to gitignored `.env.production.local` (ops only; not for `next dev`).

---

## Vercel Preview cutover

**Done (ENVIRONMENT-01-R2).** Preview and Production Supabase URL/keys are split. `hardening/stage-2a-security` Preview was redeployed. Production application was not deployed.

Hosted Preview URLs are behind Vercel Deployment Protection (SSO). `/app/health` on the stable alias requires a Vercel login or a Protection Bypass for Automation. Unauthenticated fetches show `Login - Vercel`, not Quotr.

Preview Auth rejects some synthetic TLDs (`email_address_invalid` for `.test`). Email confirmation is on; signup can rate-limit (`over_email_send_rate_limit`).

Trial policy (do not implement in ENVIRONMENT-01): 14 days, no card at signup, payment required on conversion, no permanent free plan.

---
