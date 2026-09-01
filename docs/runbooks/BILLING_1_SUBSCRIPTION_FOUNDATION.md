# BILLING-1 subscription foundation runbook

**Status:** Preview migration **046 applied** (`shhpjsoldmqtkdbgrbtm`). Production remains **045**. Preview app deployed for `hardening/stage-2a-security`. Stripe TEST products/keys are owner-configured next — not in repo.

See `docs/architecture/QUOTR_BILLING_ARCHITECTURE.md`.

---

## Expired no-card trial

Persist `status=trialing`. Derive `trial_expired` when `now() >= trial_ends_at`. Helper: `deriveInternalTrialAccessState`. No paywall in BILLING-1.

---

## Preview Vercel env (TEST only)

```
BILLING_ENVIRONMENT=test
STRIPE_SECRET_KEY=<Stripe TEST secret>
STRIPE_WEBHOOK_SECRET=<TEST webhook signing secret>
STRIPE_PRICE_BUILDER_MONTHLY=<test Price>
STRIPE_PRICE_BUSINESS_BASE_MONTHLY=<test Price>
STRIPE_PRICE_BUSINESS_SEAT_MONTHLY=<test Price>
```

Production Stripe remains unconfigured.

Price IDs are env contract only. Do not commit them.

---

## Vercel Deployment Protection and Stripe webhooks

Preview is behind Vercel Standard Deployment Protection (SSO). Stripe cannot complete Vercel login.

**Do not globally disable Preview protection.**

Owner configuration:

1. Vercel → Project → Deployment Protection → enable **Protection Bypass for Automation**.
2. Create a Stripe **Test mode** webhook endpoint URL:

```
https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app/api/webhooks/stripe?x-vercel-protection-bypass=<bypass-secret>
```

Stripe Dashboard cannot send the `x-vercel-protection-bypass` header. The query parameter is the supported bypass. Keep the secret in Stripe only.

Optional: if the Vercel plan later supports ignored paths, add `/api/webhooks/stripe` as an exception and then the query parameter can be removed.

Events: `customer.subscription.created|updated|deleted`, `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`.

Test events must have `livemode=false`.

---

## Stripe Dashboard (TEST MODE only)

NZD monthly, tax exclusive:

| Product | Price |
| --- | --- |
| Quotr Builder | $65 |
| Quotr Business | $79 |
| Quotr Business Additional User | $35 |

---

## Migration 046

```
npm run db:preview:status
npm run db:preview:push-dry
npm run db:preview:push
```

Never `db push --linked`. Never apply 046 to Production (`lxvnylhsbvudzzupxeqr`).

---

## Future reconciliation

```
npx tsx scripts/reconcile-billing.ts
```

Not scheduled.
