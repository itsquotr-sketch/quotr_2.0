-- Account-deletion lifecycle and contact suppression.
-- A completed row records that the personal login was deleted.
-- It does not delete an organisation, an issued quote, or a subscription.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

update public.account_deletion_requests
set status = case
  when status = 'open' and identity_confirmed then 'verified'
  when status = 'open' then 'requested'
  else status
end
where status = 'open';

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('requested', 'verified', 'processing', 'completed', 'withdrawn'));

alter table public.account_deletion_requests
  add column if not exists completed_at timestamptz,
  add column if not exists operator_email text,
  add column if not exists retained jsonb not null default '[]'::jsonb;

drop index if exists account_deletion_requests_one_open_email_uidx;

create unique index if not exists account_deletion_requests_one_active_email_uidx
  on public.account_deletion_requests (email_normalized)
  where status in ('requested', 'verified', 'processing');

create table if not exists public.account_deletion_suppressions (
  email_normalized text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

comment on table public.account_deletion_suppressions is
  'An email whose personal login was deleted. Contact sync must not create this person again. The row is not a retention period.';

alter table public.account_deletion_suppressions enable row level security;

revoke all on table public.account_deletion_suppressions from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_suppressions to service_role;
