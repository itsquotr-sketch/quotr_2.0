-- COMMUNICATIONS — five-minute retry for failed Loops syncs.
-- Enables the extensions already available on this Supabase plan.
-- The job reads its URL and bearer from Vault at run time.
-- Until those secrets exist, the job does nothing.
-- Existing pending rows stay out of the automatic retry.
-- Does not store a secret, a URL, or a contact.

create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.profiles
  add column if not exists marketing_loops_retry_attempts integer not null default 0,
  add column if not exists marketing_loops_retry_after timestamptz,
  add column if not exists marketing_loops_retry_stopped boolean not null default false,
  add column if not exists marketing_loops_last_error text;

comment on column public.profiles.marketing_loops_retry_attempts is
  'Transient Loops failures so far for the current pending choice. Reset when that choice is accepted or saved again.';

comment on column public.profiles.marketing_loops_retry_after is
  'Do not schedule this pending choice again before this time.';

comment on column public.profiles.marketing_loops_retry_stopped is
  'A permanent Loops error, or the attempt cap. Pending stays set so it can be inspected. The schedule skips it.';

comment on column public.profiles.marketing_loops_last_error is
  'Short Loops failure code. No email address and no request body.';

create or replace function public.mark_own_marketing_loops_auto_retry()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'CONSENT:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_loops_auto_retry = true,
        marketing_loops_retry_stopped = false,
        marketing_loops_retry_attempts = 0,
        marketing_loops_retry_after = null,
        marketing_loops_last_error = null
  where id = v_uid
    and marketing_loops_sync_pending;

  return found;
end;
$$;

comment on function public.mark_own_marketing_loops_auto_retry() is
  'Marks auth.uid() eligible for the scheduled retry and clears a previous stop. Does not change consent or clear pending.';

revoke all on function public.mark_own_marketing_loops_auto_retry() from public, anon;
grant execute on function public.mark_own_marketing_loops_auto_retry() to authenticated, service_role;

create or replace function public.protect_profile_tenant_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and current_user = 'authenticated'
     and (
       new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.marketing_loops_sync_pending is distinct from old.marketing_loops_sync_pending
       or new.marketing_consent_revision is distinct from old.marketing_consent_revision
       or new.marketing_loops_sync_lease_until is distinct from old.marketing_loops_sync_lease_until
       or new.marketing_loops_auto_retry is distinct from old.marketing_loops_auto_retry
       or new.marketing_loops_retry_attempts is distinct from old.marketing_loops_retry_attempts
       or new.marketing_loops_retry_after is distinct from old.marketing_loops_retry_after
       or new.marketing_loops_retry_stopped is distinct from old.marketing_loops_retry_stopped
       or new.marketing_loops_last_error is distinct from old.marketing_loops_last_error
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change role, org, consent sync state, the Loops lease, or retry bookkeeping. SECURITY DEFINER consent functions still may.';

create or replace function public.invoke_marketing_loops_retry()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_bearer text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'marketing_loops_retry_url';

  select decrypted_secret into v_bearer
  from vault.decrypted_secrets
  where name = 'marketing_loops_retry_bearer';

  if v_url is null or v_bearer is null or length(v_bearer) < 16 then
    return;
  end if;
  if v_url !~ '^https://' then
    return;
  end if;

  perform net.http_get(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_bearer),
    timeout_milliseconds := 20000
  );
end;
$$;

comment on function public.invoke_marketing_loops_retry() is
  'Asks the application retry route to run. The URL and bearer come from Vault. Missing secrets do nothing. Does not log either secret.';

revoke all on function public.invoke_marketing_loops_retry() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'marketing-loops-retry'
  ) then
    perform cron.schedule(
      'marketing-loops-retry',
      '*/5 * * * *',
      'select public.invoke_marketing_loops_retry()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
