# BILLING-1 subscription foundation runbook

**Status:** Local foundation complete. Owner review pending.  
**Do not apply migration 046 until the owner review gate passes.**  
**Do not deploy. Do not configure Production Stripe.**

See `docs/architecture/QUOTR_BILLING_ARCHITECTURE.md`.

---

## Preview Vercel env (TEST only)

Set on Preview after owner review and after 046 is applied to Preview. Do **not** request live keys.

```
BILLING_ENVIRONMENT=test
STRIPE_SECRET_KEY=<Stripe TEST secret>
STRIPE_WEBHOOK_SECRET=<Preview Stripe TEST endpoint secret>
STRIPE_PRICE_BUILDER_MONTHLY=<test Price>
STRIPE_PRICE_BUSINESS_BASE_MONTHLY=<test Price>
STRIPE_PRICE_BUSINESS_SEAT_MONTHLY=<test Price>
```

Webhook URL (after Preview deploy of this branch):

`https://<preview-host>/api/webhooks/stripe`

Listen to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`

---

## Stripe Dashboard setup (TEST MODE only)

Owner creates these in Stripe **Test mode**. Do not create via scripts unless the owner asks.

All prices: NZD, monthly, **tax exclusive**.

| Product | Price |
| --- | --- |
| Quotr Builder | $65 NZD / month |
| Quotr Business | $79 NZD / month |
| Quotr Business Additional User | $35 NZD / month |

Copy the three Price IDs into the Preview env names above.

GST: NZ 15% exclusive. Add a manual Stripe tax rate later. Do not mix with Quote GST.

---

## Migration 046

Preview project: `quotr_preview` / `shhpjsoldmqtkdbgrbtm`.

```
npm run db:preview:status
npm run db:preview:push-dry
npm run db:preview:push
```

Never `db push --linked`.  
Never apply 046 to Production (`lxvnylhsbvudzzupxeqr`) in BILLING-1.

---

## Future reconciliation

Not scheduled. Shape lives in `lib/billing/reconciliation.ts`.

Intended later:

```
npx tsx scripts/reconcile-billing.ts
```

Compares Stripe subscriptions vs `org_subscriptions` vs `paid_seat_quantity` in the current `BILLING_ENVIRONMENT`.
