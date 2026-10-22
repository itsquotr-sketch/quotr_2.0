-- Optional reminder queue. activated_at stays null, so nothing is enrolled.
-- Existing jobs, trials, and profiles are not backfilled.

create table if not exists public.marketing_reminder_runtime (
  id boolean primary key default true check (id),
  activated_at timestamptz
);

insert into public.marketing_reminder_runtime (id, activated_at)
values (true, null)
on conflict (id) do nothing;

comment on table public.marketing_reminder_runtime is
  'Singleton activation time for the four optional reminders. Null means they are not enrolling. This migration does not set the time and does not change marketing_engagement_runtime.';

alter table public.marketing_reminder_runtime enable row level security;
revoke all on table public.marketing_reminder_runtime from public, anon, authenticated;
grant select on table public.marketing_reminder_runtime to service_role;

alter table public.profiles
  add column if not exists marketing_engagement_marked_at timestamptz;

comment on column public.profiles.marketing_engagement_marked_at is
  'When the one-time engagement marker was accepted by Loops. Null for every existing row. Not backfilled.';

create table if not exists public.marketing_engagement_reminders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null check (kind in ('setup', 'estimate', 'quote', 'trial')),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz not null,
  milestone_at timestamptz not null,
  suppressed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, kind)
);

comment on table public.marketing_engagement_reminders is
  'One optional reminder per organisation and kind. Rows are inserted only when a milestone happens after reminder activation. Nothing here scans or backfills existing work.';

create index if not exists marketing_engagement_reminders_due_idx
  on public.marketing_engagement_reminders (due_at)
  where released_at is null and suppressed_at is null;

alter table public.marketing_engagement_reminders enable row level security;
revoke all on table public.marketing_engagement_reminders from public, anon, authenticated;
grant select, insert, update on table public.marketing_engagement_reminders to service_role;

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
       or new.marketing_engagement_marked_at is distinct from old.marketing_engagement_marked_at
     ) then
    raise exception 'PROFILE:FORBIDDEN'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.protect_profile_tenant_columns() is
  'Authenticated sessions cannot change role, org, consent sync state, the Loops lease, retry bookkeeping, the engagement marker, or its timestamp. SECURITY DEFINER consent functions still may.';

notify pgrst, 'reload schema';
