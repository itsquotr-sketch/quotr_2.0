# Quotr billing architecture

**Classification:** CANONICAL organisation subscription authority (BILLING-1) plus entitlement evaluation (BILLING-2) plus trial / Checkout / Portal (BILLING-3 local).  
**Status:** Preview 046/047 applied. Corrected 048 is local / unapplied (environment-neutral; no hardcoded `test`). Stripe TEST foundation verified. BILLING-2 entitlement authority is compatibility on Preview until bootstrap + strict gate. BILLING-3 local architecture complete pending owner commit gate. Do not apply 048 until that gate.  
**BILLING-2 evaluates and can enforce capabilities. BILLING-3 initializes trials at organisation provision.** Estimating, Pricing, Quote money, delivery, and acceptance evidence are unchanged.

Related:

- Owner decisions: `docs/decisions/BILLING_OWNER_DECISIONS.md`
- Environment topology: `docs/architecture/QUOTR_ENVIRONMENT_ARCHITECTURE.md`
- Owner setup / future reconcile: `docs/runbooks/BILLING_1_SUBSCRIPTION_FOUNDATION.md`

---

## What BILLING-1 is

Durable organisation subscription authority:

- Stripe server SDK + webhook signature verification
- Organisation ↔ Stripe customer mapping
- Organisation subscription mirror
- Billing environment isolation (`test` | `live`)
- Event idempotency and out-of-order protection
- Override storage foundation
- RLS: members may **read** their org summary; they may **not** write billing state
- `getOrgBillingState(orgId)` read helper for BILLING-2

BILLING-1 does **not** build: Checkout, Customer Portal, trial UX, pricing page, invitations, seat UI, Voice/Concept Visual ledgers, paywalls, or feature-denial UI.

---

## Packaging invariant

Builder and Business use **identical estimating correctness**. Billing later gates **access only**. Never change Work Area calculators, facts, Project Conditions, quantities, labour, requirement generation, rate resolution, commercial formulas, Pricing money, Quote totals, or delivery/acceptance evidence in billing work.

---

## Plans (product semantics)

Internal plan keys: `builder` | `business` | `custom`.

| Plan | Users | Notes |
| --- | --- | --- |
| Builder | 1 included, max 1 | NZD $65 + GST / month (config/docs only; not hardcoded in transaction logic) |
| Business | 1 included, max 5 self-service | NZD $79 + GST / month including first user; +$35 + GST per additional full user |
| Custom | ops/configurable | Admin override / contract. Not a self-service Price |

Trial (BILLING-3 starts it; BILLING-1 only makes it representable):

- 14 days, **no credit card**
- No permanent free plan
- Entitlement basis = Business
- 1 user during initial trial
- Payment required on conversion

Price IDs are configuration, never guessed from Product display names:

- `STRIPE_PRICE_BUILDER_MONTHLY`
- `STRIPE_PRICE_BUSINESS_BASE_MONTHLY`
- `STRIPE_PRICE_BUSINESS_SEAT_MONTHLY`

---

## Billing environment authority

`BILLING_ENVIRONMENT` is explicit: `test` | `live`. Unknown values fail closed.

| Deployment | Required value |
| --- | --- |
| Local | unset → `test`. `live` is forbidden. |
| Vercel Preview | **must** be `test`. Not inferred from `VERCEL_ENV` alone. |
| Vercel Production | **must** be `live`. Not inferred from `VERCEL_ENV` alone. |

`VERCEL_ENV` is a mismatch guard only.

Stripe event `livemode` must match:

- Preview/`test` → `livemode=false`
- Production/`live` → `livemode=true`

Mismatch → ignore the event.

Preview Stripe = TEST only (BILLING-1-R2 verified). Production Stripe = LIVE only (later; **not configured in BILLING-1**).

Every billing row carries `billing_environment` even though Preview (`shhpjsoldmqtkdbgrbtm` / `quotr_preview`) and Production (`lxvnylhsbvudzzupxeqr` / `quotr_2.0`) are separate databases.

---

## Source model (exact)

`org_subscriptions.source`:

| Source | Meaning |
| --- | --- |
| `stripe` | Stripe subscription is authority. Stripe customer + subscription ids required. |
| `internal_trial` | Quotr-managed no-card trial. Stripe ids **nullable**. May exist **before** a Stripe Customer. |
| `override` | Administrative/custom contract row when ops writes the mirror that way. |

Do not force no-card trials or comps into Stripe `trialing`.

Recommended no-card trial representation (used):

```
org_subscriptions
  source = internal_trial
  status = trialing
  plan_code = business
  paid_seat_quantity = 1
  stripe_customer_id = null
  stripe_subscription_id = null
  trial_ends_at = now + 14 days
```

Checkout (BILLING-3) later creates the Stripe Customer/subscription and the webhook overwrites the same org+environment row with `source=stripe`.

### Expired no-card trial (derived, not persisted)

Persist:

```
source = internal_trial
status = trialing
trial_ends_at = timestamptz
stripe ids = null
```

Do **not** store `trial_expired` on `org_subscriptions.status`.

Future BILLING-2 resolver (`deriveInternalTrialAccessState`):

| Condition | Effective state |
| --- | --- |
| `source != internal_trial` | `null` (not a no-card trial) |
| `source = internal_trial` and `now < trial_ends_at` | `trialing` |
| `source = internal_trial` and `now >= trial_ends_at` | `trial_expired` |

`getOrgBillingState` exposes `effectiveTrialState` as input to BILLING-2. BILLING-1 does not enforce access.

---

## Internal status model

Quotr status is **not** raw Stripe status. Stripe `canceled` → `cancelled`.

`trialing | active | past_due | unpaid | paused | cancelled | incomplete | scheduled_to_cancel | administratively_comped | custom_contract`

Mapping from Stripe:

- `cancel_at_period_end` while still in an entitled Stripe status → `scheduled_to_cancel`
- `pause_collection` → `paused`
- `canceled` / `incomplete_expired` → `cancelled`

Unknown Stripe Price IDs fail the event; they are never guessed.

---

## Seat quantity

`paid_seat_quantity` = **total** allowed paid full users.

- Builder = 1
- Business base Price includes 1
- Stripe additional-seat item quantity = `max(0, paid_seat_quantity - 1)`

---

## Tables (migration 046)

Apply to **Preview first only**, after owner review. Do not apply to Production in BILLING-1.

| Table | Role | Authenticated | Service role |
| --- | --- | --- | --- |
| `org_billing_customers` | org ↔ Stripe customer | SELECT own org | full write |
| `org_subscriptions` | current mirror, one row per org+env | SELECT own org | full write |
| `stripe_processed_events` | webhook idempotency | none | full write |
| `org_billing_overrides` | comps / contracts / temporary access | none | full write |

`organisations.subscription_tier` (`free` \| `pro` \| `team`) is **deprecated dead legacy**. BILLING-1 does not reuse, migrate, or drop it.

Overrides: `created_by` is a **nullable** `profiles` FK. Quotr has no platform-admin user. Ops may set `operator_ref`.

---

## Write authority

Never accept `plan_code`, `status`, `stripe_customer_id`, or `stripe_subscription_id` from the browser as authority.

Writes only through:

1. Stripe webhook handlers (`app/api/webhooks/stripe`)
2. Server billing service (mapping primitives; Checkout later)
3. Future ops/service-role

Customer mapping is lazy. BILLING-1 does **not** create Stripe Customers on signup.

Future Stripe Customer/Checkout metadata (server-set): `org_id`, `billing_environment`. Webhooks resolve org from **customer mapping first**. Metadata is corroboration only.

---

## Webhook

`POST /api/webhooks/stripe`

- Raw body + `Stripe-Signature`
- `STRIPE_WEBHOOK_SECRET`
- No auth session
- Claim `stripe_processed_events` before processing (`received` → `processed` / `failed` / `ignored`)
- Duplicate event id is idempotent
- In-flight `received` is skipped (Stripe retry after failure can retry `failed`)

Events implemented:

| Type | BILLING-1 behaviour |
| --- | --- |
| `customer.subscription.created/updated/deleted` | Mirror |
| `checkout.session.completed` | Corroborate customer mapping / metadata (`checkout_corroborated`). Does **not** write plan/status. Subscription created/updated remains authority. |
| `invoice.paid` | Record processed; **do not** force `active` |
| `invoice.payment_failed` | May set `past_due` and `past_due_since` on first transition if not stale; does **not** bump subscription event version; repeated failures do not reset `past_due_since` |

### Out-of-order protection

Mirror applies only when `event.created` ≥ `org_subscriptions.last_stripe_event_created_at`. Older events are ignored (`stale_event`). Invoice events do not advance that timestamp, so they cannot block a newer subscription object and cannot recreate past_due after a newer recovery.

`past_due_since` is the 7-day grace clock. It is set once per incident from the event that first enters past_due, preserved while still past_due, and cleared on recovery. `updated_at` / `current_period_end` / later Stripe watermarks are not grace authority.

---

## Entitlement seam / no paywall

`requireOrgEntitlement` still allows `quotes.send` and `quotes.acceptance`. Preview users can still create Projects, Estimate, Pricing, Quote, Send, and Accept. BILLING-2 connects billing state to capabilities.

---

## BILLING-3 trial / Checkout / Portal (local)

- DB billing environment authority is singleton `billing_runtime_config` (service_role/postgres only; no authenticated writes). `billing_runtime_environment()` returns `test` or `live` and fails closed if the row is missing, duplicated, or invalid. 048 does not seed the row. Preview ops insert `test`; future Production ops insert `live`. Same SQL. Stripe Checkout mapping still uses server `BILLING_ENVIRONMENT` and must match the DB row.
- Trial starts at organisation provision (`ensure_org_internal_trial` inside `provision_organisation_for_new_user`). Environment comes from `billing_runtime_environment()` only. Missing/invalid config fails closed. First insert wins; retries cannot extend `trial_ends_at`.
- Preview bootstrap: `bootstrap_missing_preview_internal_trials()` gives existing orgs with **no** billing row a **fresh** 14-day trial from `now()`. Refuses unless runtime environment is `test`. Does not use `organisations.created_at`. Do not run on Production.
- Billing page: `/app/settings/billing`. Plan selection sends only `builder` | `business`. Server resolves Stripe Price IDs.
- Checkout success URL is not authority. The page waits for `org_subscriptions` via webhook.
- Customer Portal is hosted Stripe. Recommend TEST Portal config: payment methods, invoices, cancel — **not** plan/seat switching until BILLING-4.
- Builder → Business upgrade: Stripe `subscriptions.update` with `proration_behavior=always_invoice`, `payment_behavior=pending_if_incomplete`, and `billing_cycle_anchor=unchanged`. Failed proration payment leaves the current Builder Price; `pending_update` is not plan authority. Entitlement switches only after webhook confirms current Business Price. Business → Builder is deferred (`downgrade_deferred_billing_4`).
- Stripe Customer create uses only stable metadata (`org_id`, `billing_environment`) with a deterministic idempotency key. Company name and billing email are applied with Customer UPDATE after mapping exists.
- Strict Preview enforcement only after every Preview org has a trial, Stripe subscription, or override. Not switched in the local-only phase.

---

## GST

NZ beta: 15% GST, tax **exclusive**. Optional `STRIPE_TAX_RATE_NZ_GST` attaches a Stripe tax rate on Checkout line items and on Builder→Business item updates (including the immediate `always_invoice` proration invoice). Missing env: exclusive price with **no** GST line (do not invent 15%). Present: exclusive price + configured 15% GST. `tax_behavior=exclusive` alone does not add GST. Do **not** mix SaaS GST with construction Quote GST.

---

## Reconciliation (future)

Helper: `lib/billing/reconciliation.ts` (`diffStripeAgainstMirror`).

Future command (not scheduled):

```
npx tsx scripts/reconcile-billing.ts
```

Compare Stripe vs `org_subscriptions` vs paid seats. Do not run against live charges in BILLING-1.
