# Beta / Production release runbook

**Do not run this against Production until the owner approves a dated release.**  
This file is the order of operations. It is not authorisation.

Preview today: `shhpjsoldmqtkdbgrbtm`, migration **053**, Stripe **TEST**, `BILLING_ENVIRONMENT=test`.  
Production today: `lxvnylhsbvudzzupxeqr`, migration **045**. **Do not deploy. Do not migrate.**

There is **no migration 037** (001–036, 038–053). That gap is historical and documented.

Related: `docs/BETA_LAUNCH_CHECKLIST.md`, `docs/BETA_SMOKE_TEST.md`, `docs/runbooks/MIGRATION_053_ROLE_RLS_PROPOSAL.md`, `docs/architecture/QUOTR_RLS_ROLE_MATRIX.md`, `docs/architecture/QUOTR_ENVIRONMENT_ARCHITECTURE.md`.

---

## 0. Owner gates (must all be yes)

1. 053 RLS applied on Preview and proven (Estimator company-admin deny, Viewer read-only)
2. Production backup / PITR confirmed in Supabase dashboard (do not assume from this repo)
3. LIVE Stripe products/prices/webhook/portal created (separate approval)
4. Production Auth Site URL, redirects, custom SMTP
5. Production Resend domain + from address
6. Production Vercel env (names below) — never paste secrets into chat/git
7. Go/No-Go is not NO-GO

---

## 1. Pre-checks (Production, read-only)

```
npm run db:production:status
```

Expect latest remote migration **045**. If it is not 045, **stop**.

Confirm:

- No Preview ref in Production Vercel env
- `BILLING_ENVIRONMENT` is unset or will be set to `live` only at cutover
- `SCOPE_DISCOVERY_ENABLED` is not `true` unless separately gated

---

## 2. Production migration sequence (046 → 053)

Apply **one file at a time** with `npm run db:production:push` only after owner confirmation of **this** runbook. Prefer applying the numbered files in order on a maintenance window.

| File | Purpose | Depends on | Risk | Tables / columns | Backfill | Stripe | Auth | Prod data failure modes | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **046** `046_billing_foundation.sql` | Billing tables | orgs/profiles | Low–med | `org_billing_customers`, `org_subscriptions`, `stripe_processed_events`, `org_billing_overrides` | None | Schema only | Member SELECT; writes service_role | Unlikely | Drop tables (loses any later Stripe mirrors) |
| **047** `047_past_due_authority.sql` | `past_due_since` | 046 | Low | column on `org_subscriptions` | None (NULL) | Webhook must set/clear | None | Missing clock → grace fails closed | Drop column |
| **048** `048_billing_checkout_trial.sql` | Trial + `billing_runtime_config` + provision hook | 046 | **High ops** | singleton config; rewrite `provision_organisation_for_new_user` | Preview bootstrap helper is **test-only** — do not run on live | Must seed config `live` | Signup provision | **Missing singleton → signup fail-closed `BILLING:RUNTIME_ENV_UNCONFIGURED`** | Function replace not clean; do not drop after trials exist |
| **049** `049_organisation_memberships.sql` | Memberships, invites, seats, Viewer RLS | 046/048 | **Highest** | `organisation_memberships`, invitations, seat ops, assignments; `profiles.org_id` nullable | Bound profiles → active memberships; `member`→`estimator` | Paid seats need Business Stripe | Tenant bind delayed until activation | **>1 owner-role profile** fails unique owner index; restrictive policies without membership rows block writes | Not safely reversible |
| **050** `050_unbind_removed_membership.sql` | Clear `org_id` on remove | 049 | Med | trigger replace | Unbind leftover removed | None | Immediate RLS revoke | Assumes one-org users | Reverting reopens leak |
| **051** `051_organisation_timezone.sql` | `organisation_settings.timezone` | settings | Low | column + CHECK | NZ → Auckland/Chatham; non-NZ NULL | None | None | Heuristic region match | Drop column |
| **052** `052_company_productivity_calibration.sql` | DNA catalogue + evidence | **049** (RPC membership checks) | Med–high | catalogue, responses; `rates.source` | `rates.source='explicit_company'`; seed catalogue | None | RPCs owner/admin/estimator | Apply before 049 → RPC role failures; unique rate upsert | Evidence FK `ON DELETE RESTRICT` |
| **053** `053_role_aware_rls_hardening.sql` | Role-aware RLS | **049** helpers; apply after 052 | Med | policies + `auth_can_manage_company`; profile tenant trigger; branding storage | None | None | Restrictive writes | Estimator JWT can no longer PATCH company settings/rates; Viewer cannot DML work tables | Recreate 049 work-role policies on settings/rates; drop company-role policies |

### 048 Production ops (mandatory, immediately after 048)

```sql
-- service_role / postgres on Production only
insert into public.billing_runtime_config (id, billing_environment)
values (true, 'live')
on conflict (id) do nothing;
```

Never insert `test` on Production. Never run `bootstrap_missing_preview_internal_trials` on Production (function refuses non-test).

### 049 Production pre-check

Count profiles with role owner per org. If any org has **more than one**, fix data before 049.

### Post-checks after 052

- `organisation_memberships` row for every previously bound profile
- `billing_runtime_config.billing_environment = 'live'`
- Catalogue row count matches 052 seed
- RLS still enabled on billing + quotes + settings
- Signup provision creates `internal_trial` without Stripe

### Post-checks after 053 (do not skip)

- Preview/Production latest migration is **053** only after this file is applied
- Direct PostgREST: Estimator `organisation_settings` / commercial `rates` UPDATE denied
- Direct PostgREST: Estimator project / work_area / fact / estimate margin UPDATE allowed
- Direct PostgREST: Viewer DML denied on settings, org work areas, projects, work_areas, facts, estimates/quotes
- Owner/Admin company settings and commercial rates UPDATE still allowed
- Estimator `save_productivity_calibration` still allowed
- Cross-org SELECT/mutation still denied
- Team invite/remove RPCs unchanged (Owner-only paid seats)
- Public quote token RPCs unchanged

### 053

Role-aware RLS. Aligns database mutation authority with Owner/Admin company administration, Estimator project workflow, and Viewer read-only. Apply **after** 052. Preview-first. **Do not apply Production until 046–052 are already on Production.**

### Rehearsal

Preview already contains 046–053 after SECURITY-053. That is the coherence proof. Do not clone Production into Preview. Static chain: 046 additive → 047 column → 048 config/provision → 049 memberships → 050 unbind → 051 tz → 052 DNA using memberships → 053 role RLS.

---

## 3. Production Vercel env (names only)

Set on **Production** environment. Never put Preview secrets here.

| Name | Required at Production cutover | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://lxvnylhsbvudzzupxeqr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Production anon |
| `NEXT_PUBLIC_SITE_URL` | Yes | Approved Production origin (not Preview alias, not localhost) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (webhooks/admin) | Production service role |
| `ANTHROPIC_API_KEY` | Yes | |
| `ANTHROPIC_MODEL` | Optional | Default `claude-sonnet-4-6` |
| `NEXT_PUBLIC_FEEDBACK_EMAIL` | Yes for beta support | Public by design |
| `BILLING_ENVIRONMENT` | Yes | **`live`** |
| `BILLING_ENFORCEMENT_MODE` | Yes | `strict` after billing rows exist |
| `STRIPE_SECRET_KEY` | Yes | **`sk_live_…` only** |
| `STRIPE_WEBHOOK_SECRET` | Yes | LIVE endpoint |
| `STRIPE_PRICE_BUILDER_MONTHLY` | Yes | LIVE price |
| `STRIPE_PRICE_BUSINESS_BASE_MONTHLY` | Yes | LIVE price |
| `STRIPE_PRICE_BUSINESS_SEAT_MONTHLY` | Yes | LIVE additional user |
| `STRIPE_TAX_RATE_NZ_GST` | Recommended | LIVE `txr_…` 15% |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Recommended | No plan/seat switching if that remains policy |
| `RESEND_API_KEY` | Yes | Production sending |
| `RESEND_FROM_EMAIL` | Yes | Verified domain |
| `RESEND_REPLY_TO_EMAIL` | Recommended | |
| `RESEND_WEBHOOK_SECRET` | If using delivery webhooks | |
| `QUOTE_DELIVERY_PROVIDER` | Optional | Omit or non-`mock` in Production |
| `SCOPE_DISCOVERY_ENABLED` | Must not be `true` unless gated | |

Do **not** set `NEXT_PUBLIC_STRIPE_*` secrets. Do **not** set Preview project URL on Production.

Hosted production **throws** if `BILLING_ENVIRONMENT` is not `live` (`lib/billing/environment.ts`).

---

## 4. Production Auth plan (do not apply now)

On Supabase project `lxvnylhsbvudzzupxeqr`:

| Setting | Production value |
| --- | --- |
| Site URL | `https://<production-domain-when-approved>` |
| Redirect allowlist | that origin `/auth/callback` (keep localhost only if still needed for ops) |
| Confirm email | **required** |
| Custom SMTP | Production Resend (or approved SMTP). Separate key from Preview Auth SMTP |
| Sender | Production branded from-address |
| Rate limit | Keep conservative; do not copy experimental Preview limits blindly |

PKCE callback stays `/auth/callback`. Password reset uses the same callback.

---

## 5. Production Stripe plan (do not create LIVE resources in this programme)

Display catalogue (not Price ID authority): Builder **$65 + GST**, Business **$79 + GST**, additional user **$35 + GST**, 14-day trial, no card upfront.

LIVE Dashboard:

1. Products: Quotr Builder, Quotr Business
2. Prices: three monthly exclusive NZD prices → env names above
3. Tax: NZ GST 15% rate → `STRIPE_TAX_RATE_NZ_GST`
4. Customer Portal config (cancel-at-period-end; no self-serve plan switch unless product says so)
5. Coupons/promos: none required for launch; if used, document IDs separately
6. Webhook (next section)

Trial: `internal_trial` is DB-authoritative until Checkout. Do not invent a Stripe trial that disagrees with `org_subscriptions`.

---

## 6. Webhook plan (do not create Production webhook yet)

| | Preview | Production |
| --- | --- | --- |
| Endpoint | `https://<preview-origin>/api/webhooks/stripe` | `https://<production-origin>/api/webhooks/stripe` |
| Secret | TEST `whsec_` | LIVE `whsec_` |
| Events | `customer.subscription.created/updated/deleted`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed` | same |
| Idempotency | `stripe_processed_events` | same table after 046 |
| Env match | `livemode=false` + `BILLING_ENVIRONMENT=test` | `livemode=true` + `live` |

Mismatch is ignored (HTTP 200), not applied.

Resend webhook: `/api/webhooks/resend` if delivery tracking is enabled.

---

## 7. Resend Production plan

Auth SMTP and app email **may** use separate Resend keys.

Minimum:

- Verified sending domain (SPF/DKIM/DMARC)
- `RESEND_FROM_EMAIL` for quotes/invites
- Auth SMTP from-address for confirm/reset (Supabase Auth settings, not Vercel)
- Scope keys to sending only; never commit them

---

## 8. App deploy order (when approved)

1. Migrations 046→052 (+ 053 if approved) **succeed**
2. Seed `billing_runtime_config=live`
3. Set Production env (Stripe LIVE, Site URL, Resend)
4. Deploy **app** to Production (never before DB)
5. Configure Stripe + Auth + SMTP
6. Smoke `docs/BETA_SMOKE_TEST.md` against Production with a throwaway org
7. Only then invite real customers

---

## 9. Rollback

| Layer | Action | Notes |
| --- | --- | --- |
| App | Redeploy previous SHA on Vercel | Instant. Does not undo SQL. |
| DB | Restore PITR / backup taken **before** 046 | Do not “revert commits” for migrations. Down-migrations are not supported. |
| 046–047 | Drop additive objects only if **no** billing rows matter | After live Stripe mirrors exist, prefer restore. |
| 048 | Missing config fails signup closed — re-insert `live` row rather than drop | |
| 049–050 | Restore backup | Do not hand-undo memberships. |
| Billing | Disable Stripe webhook; set `BILLING_ENFORCEMENT_MODE=off` or `compatibility` | Existing public Quotes remain valid. |
| Auth | Restore Site URL / redirect list / SMTP | |
| Email | Disable Resend key or swap from-address | Quote send fails closed with user-safe copy |

---

## 10. Backup / recovery (must confirm in dashboard)

This repo **does not prove** PITR is enabled on `lxvnylhsbvudzzupxeqr`.

Before Production migration, owner must confirm in Supabase:

- Backups enabled
- PITR window long enough to cover the migration window
- Restore tested or at least restore procedure known
- Preview is not a restore target for Production data

---

## 11. Monitoring (minimum beta)

- Vercel function logs (signup, analyse, send, webhooks)
- Supabase logs (Auth, Postgres errors, RPC)
- `stripe_processed_events` + billing log helper
- Quote delivery events / Resend dashboard
- `ai_usage_events` for Analyse failures

No extra observability platform required for controlled beta.

---

## 12. Explicit non-actions

- Do not deploy Production from this programme
- Do not apply 046–052 to Production from this programme
- Do not create LIVE Stripe resources from this programme
- Do not create migration 053 SQL until owner approval
