# Billing owner decisions

**Status:** Approved (2026-09-01)  
**Source:** BILLING-0 owner review + ENVIRONMENT-01  
**Do not implement Stripe Checkout or entitlement enforcement in ENVIRONMENT-01.**
BILLING-1 adds local subscription authority only; Preview 046 apply is an owner gate.

---

## D1 — Environment isolation — APPROVED

Preview and Production **must** use separate Supabase projects before hosted Stripe testing.

| Environment | Supabase | Stripe (later) |
| --- | --- | --- |
| Local | Local Docker, or hosted Preview `shhpjsoldmqtkdbgrbtm` until Docker is available. Never Production. | TEST only. Never live. |
| Preview | `quotr_preview` / `shhpjsoldmqtkdbgrbtm` | TEST only, `BILLING_ENVIRONMENT=test` |
| Production | `quotr_2.0` / `lxvnylhsbvudzzupxeqr` | LIVE only, `BILLING_ENVIRONMENT=live` |

Do not clone Production customer data into Preview.

Even with separate databases, future billing rows keep `billing_environment` (`test` \| `live`) as defence in depth.

---

## D2 — Trial — APPROVED

- 14-day free trial
- **No** payment method / credit card at signup
- Trial is **not** a permanent free plan
- Trial starts automatically after organisation provisioning/onboarding in **BILLING-3** (not now)
- Status = `trialing`
- Entitlement basis = **Business**
- User cap during trial = **1**
- Reduced Voice / Concept Visual allowances
- No team invites during the initial self-service trial unless explicitly enabled later

Configurable policy (do not hard-code as architecture):

```
TRIAL_PAYMENT_METHOD_REQUIRED=false
```

---

## D3 — After trial expiry — APPROVED

User **may**:

- log in
- view existing Projects, Estimates, Pricing, Quotes
- view delivery/acceptance history
- export/download historical client documents where appropriate
- access Billing / Choose Plan

User **may not** continue normal new value-producing activity until subscription activation, including (subject to BILLING-2 entitlement audit):

- create new Projects
- generate/update Estimates
- create/finalise new Pricing workflows
- send new Quotes
- usage-heavy AI processing
- Voice
- Concept Visuals
- team functionality

Do **not** delete or hide historical work.

---

## D4 — Payment conversion — APPROVED

Payment method becomes required when converting from expired or in-progress trial to **Builder** or **Business**.

Checkout activates subscription only after authoritative Stripe webhook state. Browser Checkout return **never** grants access.

---

## BILLING-1 implementation notes

Canonical architecture: `docs/architecture/QUOTR_BILLING_ARCHITECTURE.md`.

- No-card trial lives on `org_subscriptions` with `source=internal_trial` (Stripe ids nullable). Do not start trials in BILLING-1.
- `organisations.subscription_tier` remains dead legacy (`free|pro|team`). Do not reuse, migrate, or drop.
- GST: NZ 15% exclusive, manual Stripe tax later. Separate from Quote GST.

