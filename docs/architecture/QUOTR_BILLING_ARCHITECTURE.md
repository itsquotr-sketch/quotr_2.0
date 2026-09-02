# Quotr billing architecture

**Classification:** CANONICAL organisation subscription authority (BILLING-1) plus entitlement evaluation (BILLING-2) plus trial / Checkout / Portal (BILLING-3) plus Business memberships / invitations / seat billing (BILLING-4 local).  
**Status:** Preview 046/047/048 applied. 049 is local / unapplied. Do not apply 049 until owner review. Never Production. Stripe TEST configured on Preview. BILLING-4-R1: pending_billing is zero-access; membership is the only post-049 role authority. BILLING-4-R2: at most one in-flight Stripe seat mutation per org/environment; later acceptances queue.  
**BILLING-4 builds organisation memberships, invitations, roles, and payment-safe additional-user Stripe items. Estimating, Pricing, and Quote money are unchanged.**

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
- Builder → Business upgrade: Stripe `subscriptions.update` with `proration_behavior=always_invoice`, `payment_behavior=pending_if_incomplete`, and `billing_cycle_anchor=unchanged`. Failed proration payment leaves the current Builder Price; `pending_update` is not plan authority. Entitlement switches only after webhook confirms current Business Price.
- Stripe Customer create uses only stable metadata (`org_id`, `billing_environment`) with a deterministic idempotency key. Company name and billing email are applied with Customer UPDATE after mapping exists.
- Strict Preview enforcement only after every Preview org has a trial, Stripe subscription, or override. Not switched in the local-only phase.

---

## BILLING-4 memberships / invitations / seats (local)

049 is **local / unapplied**. Do not apply to Preview in this phase. Never Production.

- `organisation_memberships` is team/role authority for **active** members only. `pending_billing` is durable join workflow: **zero org access**, `profiles.org_id` stays NULL until paid-seat activation. Viewer is an active paid role — not a stand-in for pending seats.
- `profiles.org_id` remains the single-org tenant binding for `auth_org_id()` **after activation**. One user, one organisation. Exactly one active Owner.
- After 049 exists: membership is canonical. Bound profile without an active membership fails closed for mutations (no `profiles.role` grant). Pre-049 local fallback to `profiles.role` remains only when the membership table is missing.
- Roles: Owner, Admin, Estimator, Viewer. **All four consume one full paid seat.** Viewer is not free.
- Legacy `profiles.role`: owner→owner, admin→admin, member→estimator. Viewer is new.
- Permissions are central (`requireOrgPermission` / `requireEntitlementAndPermission`). Plan entitlement AND **active** role must both pass. Checkout/Portal/upgrade require Owner `billing.manage`.
- Invitations: hash-only tokens, 7-day pending reservation, unique pending email per org, Owner-only create (Admin cannot add billed seats). Sending an invite is Owner consent for the future $35+GST seat charge; no second approval at accept. Capacity = active + pending_billing + pending invites against Business max 5. `accepting` invitations are not counted — the unit has moved to `pending_billing`. Custom is not capped here.
- Invite-aware signup: `provision_organisation_for_new_user` raises `PROVISION:PENDING_INVITATION` for pending/accepting invites **or** `pending_billing` memberships, including unbound profiles. `/invite/[token]` plus `/invite/continue`.
- Payment-safe seat add: membership stays `pending_billing` with unbound profile until `org_subscriptions.paid_seat_quantity` covers the resulting **active** count. Then atomic bind: membership active + `profiles.org_id` + compatibility role + invite accepted. Additional-user Price quantity = `max(0, paid users - 1)`. Add uses `always_invoice` + `pending_if_incomplete`. Failed payment does not activate. GST remains `subscription.default_tax_rates`.
- Serialized Stripe seat mutations (R2): `billing_seat_operations` insert as `queued`. In-flight is `pending` / `awaiting_payment` / `awaiting_mirror`. Partial unique index `billing_seat_operations_one_inflight_uidx` on `(org_id, billing_environment)` is the durable lock (advisory locks end with the HTTP transaction). A second accept may enter `pending_billing` but must not call Stripe. Desired quantity is recalculated at claim from canonical active count (`active+1` add, `greatest(active,1)` remove). Webhook activates oldest covered pending member, completes matching ops, claims at most one next op, then one trusted Node Stripe call.
- New paid-seat charges and new invitations require Stripe Business `status=active`. `past_due` (including BILLING-2 work grace) and `scheduled_to_cancel` cannot add users. Existing members remain usable under BILLING-2 until period end / grace policy.
- Local `next build` must not load Production Supabase. Use `npm run build:safe` (`.env.local` only). Never `.env.production.local`.
- Seat remove: access revoked immediately. Stripe quantity decreases with `create_prorations` (credit on next invoice, no cash refund); item deleted when extra quantity returns to 0. Decrement queues behind any in-flight add. Do not restore access if Stripe sync is delayed. In-flight add cannot be cancelled against Stripe; queued/failed pending_billing may be cancelled and the reservation released.
- Business → Builder: allowed only when the company is already one person with no pending invites/activations; scheduled for end of current period.
- Team page: `/app/settings/team`. Builder/trial empty states do not send invites.

---

## GST

NZ beta: 15% GST, tax **exclusive**. Optional `STRIPE_TAX_RATE_NZ_GST` attaches a Stripe Tax Rate on Checkout (`line_items.tax_rates` and `subscription_data.default_tax_rates`). Long-term SaaS GST authority is **subscription `default_tax_rates`**. Builder → Business pending updates must **not** send `items[].tax_rates` or `default_tax_rates`: Stripe rejects both when `payment_behavior=pending_if_incomplete`. Existing subscription GST continues onto the proration invoice and renewals. Missing env: exclusive price with **no** GST line (do not invent 15%). `tax_behavior=exclusive` alone does not add GST. Do **not** mix SaaS GST with construction Quote GST.

---

## Reconciliation (future)

Helper: `lib/billing/reconciliation.ts` (`diffStripeAgainstMirror`).

Future command (not scheduled):

```
npx tsx scripts/reconcile-billing.ts
```

Compare Stripe vs `org_subscriptions` vs paid seats. Do not run against live charges in BILLING-1.
