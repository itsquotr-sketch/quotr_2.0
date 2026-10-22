-- Enrolment marker for the unpublished engagement sequence.
-- activated_at stays null, so no contact qualifies.
-- Existing profiles stay ineligible. Nothing here backfills consent or contacts.

create table if not exists public.marketing_engagement_runtime (
  id boolean primary key default true check (id),
  activated_at timestamptz
);

insert into public.marketing_engagement_runtime (id, activated_at)
values (true, null)
on conflict (id) do nothing;

comment on table public.marketing_engagement_runtime is
  'Singleton activation time for the engagement sequence. Null means the sequence is not enrolling. This migration does not set the time.';

alter table public.marketing_engagement_runtime enable row level security;
revoke all on table public.marketing_engagement_runtime from public, anon, authenticated;
grant select on table public.marketing_engagement_runtime to service_role;

alter table public.profiles
  add column if not exists marketing_engagement_eligible boolean not null default false;

comment on column public.profiles.marketing_engagement_eligible is
  'True only after a production sync has sent the one-time engagement marker. Existing rows stay false.';

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
       or new.marketing_engagement_eligible is distinct from old.marketing_engagement_eligible
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change role, org, consent sync state, the Loops lease, retry bookkeeping, or the engagement marker. SECURITY DEFINER consent functions still may.';

notify pgrst, 'reload schema';
