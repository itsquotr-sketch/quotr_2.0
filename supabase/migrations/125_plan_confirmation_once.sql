-- Once-per-subscription lock for the paid plan confirmation.
-- A repeat insert for the same Stripe subscription returns the existing row
-- and inserted=false. The webhook sends only when inserted is true.
-- Pending and failed rows are retried by the operator command, not by a
-- later active, past_due, or renewal event.

create or replace function public.enqueue_paid_plan_confirmation_v1(
  p_org_id uuid,
  p_billing_environment text,
  p_environment text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sub public.org_subscriptions%rowtype;
  v_key text;
  v_row public.plan_confirmation_deliveries%rowtype;
  v_inserted integer := 0;
begin
  if p_environment is distinct from 'preview'
     and p_environment is distinct from 'production'
     and p_environment is distinct from 'development' then
    raise exception 'PLAN:ENVIRONMENT' using errcode = 'P0001';
  end if;
  if p_billing_environment is distinct from 'test'
     and p_billing_environment is distinct from 'live' then
    raise exception 'PLAN:BILLING_ENVIRONMENT' using errcode = 'P0001';
  end if;
  if p_stripe_subscription_id is null or btrim(p_stripe_subscription_id) = '' then
    raise exception 'PLAN:SUBSCRIPTION' using errcode = 'P0001';
  end if;

  select * into v_sub
  from public.org_subscriptions s
  where s.org_id = p_org_id
    and s.billing_environment = p_billing_environment;

  if v_sub.id is null
     or v_sub.source is distinct from 'stripe'
     or v_sub.status is distinct from 'active'
     or v_sub.plan_code not in ('builder', 'business')
     or v_sub.stripe_subscription_id is distinct from p_stripe_subscription_id
     or v_sub.stripe_customer_id is distinct from p_stripe_customer_id then
    raise exception 'PLAN:NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.org_billing_overrides o
    where o.org_id = p_org_id
      and o.billing_environment = p_billing_environment
      and o.status is distinct from 'expired'
      and o.status is distinct from 'revoked'
      and o.starts_at <= now()
      and (o.expires_at is null or o.expires_at > now())
  ) then
    raise exception 'PLAN:OVERRIDE' using errcode = 'P0001';
  end if;

  v_key := 'plan-confirmation-v1:' || p_environment || ':' || p_stripe_subscription_id;

  insert into public.plan_confirmation_deliveries (
    org_id, billing_environment, environment, template_version, source,
    stripe_subscription_id, stripe_customer_id, status, idempotency_key
  )
  values (
    p_org_id, p_billing_environment, p_environment, 'plan-confirmation-v1', 'activation',
    p_stripe_subscription_id, p_stripe_customer_id, 'pending', v_key
  )
  on conflict (environment, stripe_subscription_id) where source = 'activation' do nothing;

  get diagnostics v_inserted = row_count;

  select * into v_row
  from public.plan_confirmation_deliveries
  where environment = p_environment
    and stripe_subscription_id = p_stripe_subscription_id
    and source = 'activation';

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'inserted', v_inserted > 0,
    'status', v_row.status,
    'idempotency_key', v_row.idempotency_key,
    'provider_message_id', v_row.provider_message_id,
    'recipient_email', v_row.recipient_email
  );
end;
$$;

notify pgrst, 'reload schema';
