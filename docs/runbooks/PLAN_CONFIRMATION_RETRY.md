# Paid plan confirmation — retry and reconciliation

Service email for the first activation of a paid Stripe plan. Not a scheduler, not a tax invoice, and not a backfill.

Sending stays off unless `PLAN_CONFIRMATION_EMAIL_ENABLED=true`. Production also requires `PLAN_CONFIRMATION_EMAIL_PRODUCTION=true`. Leave both unset while preparing Production.

Do not print service-role keys, Stripe keys, or Resend keys in the output you keep.

## Find deliveries

On the target database, as the service role:

```sql
select
  id,
  environment,
  source,
  status,
  reconcile_required,
  attempt_count,
  provider_message_id is not null as provider_accepted,
  last_error_safe,
  created_at
from public.plan_confirmation_deliveries
where status in ('pending', 'failed', 'sending')
   or reconcile_required = true
order by created_at;
```

This list omits the recipient address. `last_error_safe` is the reason stored for a skip or failure.

One activation row exists per Stripe subscription and environment. Whether that row was inserted by this call does not decide eligibility. The subscription transition decides: the first time that Stripe subscription becomes an active paid Builder or Business plan. A later return from past due, a renewal, or a repeated event does not qualify. The database refuses a second activation row for the same subscription.

## Retry one delivery

There is no retry scheduler.

```text
npx tsx scripts/retry-plan-confirmation.ts <delivery-uuid>
```

The command takes only that id. It does not accept an email address. It refuses `preview_test` rows.

- `pending` and `failed` rows with no provider message are claimed and sent with the stored idempotency key.
- A row already `accepted`, or one that already has a provider message, is not sent again.
- A `sending` row whose 90-second lease is still running is left in flight.

## Recipient mismatch

Nothing is sent, and the message is not given to another person, when:

- the confirmed organisation owner email and the Stripe billing email differ
- either billing email is missing
- the Stripe billing email is not the confirmed owner

The row is `failed`. `last_error_safe` says to make the Stripe billing email and the confirmed owner the same address, then retry that delivery id. Do not put a different member’s address on the command.

## 24-hour cutoff

The first send attempt stores `idempotency_started_at` and the idempotency key. Resend treats a repeat of that key as the original message.

If 24 hours have passed and no provider message is stored, the claim stops. It sets `reconcile_required`, marks the row `failed`, and does not send. The retry command returns `reconcile` and does not create a new key.

Before any follow-up, look up that idempotency key in Resend. If Resend already accepted it, record that provider message on the row. Do not send a second email. If Resend has no acceptance, decide the follow-up separately. This runbook does not authorise a new key or a backfill.
