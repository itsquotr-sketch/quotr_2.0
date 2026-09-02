-- Quotr 2.0 — BILLING-2-R1 past_due incident clock.
-- LOCAL ONLY. Do not apply until owner review.
-- Do not apply to Production (Production remains on 045).
-- Do not backfill. Existing Preview rows may remain NULL.

alter table public.org_subscriptions
  add column if not exists past_due_since timestamptz;

comment on column public.org_subscriptions.past_due_since is
  'Start of the current past_due incident. Set once when status first becomes past_due, from the authoritative Stripe event time. Subsequent past_due webhooks must not reset it. Cleared when status leaves past_due. Not last_stripe_event_created_at, updated_at, or current_period_end. No historical backfill.';
