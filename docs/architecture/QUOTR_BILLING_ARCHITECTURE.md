# Quotr billing architecture

**Classification:** CANONICAL organisation subscription authority (BILLING-1) plus entitlement evaluation (BILLING-2 local).  
**Status:** Preview 046 applied. 047 past_due authority is local / unapplied. Stripe TEST foundation verified. BILLING-2 entitlement authority is local / compatibility mode / not deployed.  
**BILLING-2 evaluates and can enforce capabilities. Preview orgs without billing rows stay usable until BILLING-3.** Estimating, Pricing, Quote money, delivery, and acceptance evidence are unchanged.

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
| `checkout.session.completed` | Record/ignore (`checkout_deferred_billing_3`) |
| `invoice.paid` | Record processed; **do not** force `active` |
| `invoice.payment_failed` | May set `past_due` and `past_due_since` on first transition if not stale; does **not** bump subscription event version; repeated failures do not reset `past_due_since` |

### Out-of-order protection

Mirror applies only when `event.created` ≥ `org_subscriptions.last_stripe_event_created_at`. Older events are ignored (`stale_event`). Invoice events do not advance that timestamp, so they cannot block a newer subscription object and cannot recreate past_due after a newer recovery.

`past_due_since` is the 7-day grace clock. It is set once per incident from the event that first enters past_due, preserved while still past_due, and cleared on recovery. `updated_at` / `current_period_end` / later Stripe watermarks are not grace authority.

---

## Entitlement seam / no paywall

`requireOrgEntitlement` still allows `quotes.send` and `quotes.acceptance`. Preview users can still create Projects, Estimate, Pricing, Quote, Send, and Accept. BILLING-2 connects billing state to capabilities.

---

## GST

NZ beta: 15% GST, tax **exclusive**, manual Stripe tax rate later. Do **not** mix SaaS GST with construction Quote GST. No SaaS tax implementation in BILLING-1 beyond Price/config compatibility.

---

## Reconciliation (future)

Helper: `lib/billing/reconciliation.ts` (`diffStripeAgainstMirror`).

Future command (not scheduled):

```
npx tsx scripts/reconcile-billing.ts
```

Compare Stripe vs `org_subscriptions` vs paid seats. Do not run against live charges in BILLING-1.
