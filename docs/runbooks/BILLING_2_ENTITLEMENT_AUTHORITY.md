# BILLING-2 entitlement authority

**Status:** Local implementation. Compatibility mode. Past-due authority corrected. Owner final gate.  
**047 is local only. Do not apply. Do not deploy. Do not start BILLING-3.**

## Enforcement mode

`BILLING_ENFORCEMENT_MODE`

| Value | Behaviour |
| --- | --- |
| `off` | Evaluate/report only. Gates never deny. |
| `compatibility` | **BILLING-2 default (unset).** Enforce when `org_subscriptions` or a valid override exists. Orgs with no billing row stay usable. Summaries mark them `uninitialized` — not paid forever. |
| `strict` | Missing billing row blocks value-producing work. Use in tests and after BILLING-3 onboarding. |

Unknown values fail closed.

## Precedence

1. Valid unexpired `org_billing_overrides`
2. Internal trial (`source=internal_trial`), including derived `trial_expired`
3. Stripe (or override-written) `org_subscriptions` row
4. No paid access / uninitialized

One subscription row per org+environment, so active Stripe and a stale internal trial cannot coexist. `source=stripe` uses Stripe status policy even if `trial_ends_at` is in the past.

## Past-due grace

7-day grace starts at `org_subscriptions.past_due_since` (first transition into the current past_due incident). Window is `[past_due_since, past_due_since + 7 days)` — exclusive at the exact +7-day instant.

Do not use `last_stripe_event_created_at`, `updated_at`, or `current_period_end` as grace start.

- non-past_due → past_due: set `past_due_since` from the Stripe event `created` time
- past_due → past_due: preserve (including NULL)
- past_due → recovered: clear
- later new failure: set a new timestamp
- `past_due` with NULL `past_due_since`: fail closed (`read_export`, no grace). No historical backfill.

`invoice.payment_failed` may set past_due + `past_due_since` on first transition. It does not bump `last_stripe_event_created_at`. Stale invoice events cannot override a newer subscription recovery. `invoice.paid` does not force active or clear the clock; `customer.subscription.updated` is recovery authority.

## Public Quote acceptance

`quotes.send` is gated at send time.

Public client Accept/Decline of an already-issued Quote is **transaction completion**. It is not revalidated against contractor billing. Do not call `requireOrgEntitlement` inside the public acceptance RPC path.

## Capability overlays

`org_billing_overrides` persists plan/status/seats/expiry as in 046.

Per-capability `capabilityAllow` / `capabilityDeny` are **resolver/test-only**. They are not a persistent product/ops feature. 047 adds `past_due_since` on `org_subscriptions` only — not overlay columns.

Custom contract v1 uses its configured plan/capability basis and seat override. Persistent capability overlays need a later migration and platform-admin work.

## Platform admin

No platform-admin user exists. Override writes remain service-role / ops (`operator_ref`). Future admin UI is out of scope.
