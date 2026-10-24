-- Account-deletion requests. A row records the ask and the facts an
-- operator needs. It does not delete a login, company, quote, or subscription.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email_normalized text not null,
  source text not null check (source in ('signed_in', 'public')),
  identity_confirmed boolean not null,
  resolution text not null check (resolution in ('recorded', 'needs_support')),
  status text not null default 'open' check (status in ('open', 'withdrawn')),
  other_active_member_count integer not null default 0 check (other_active_member_count >= 0),
  issued_quote_count integer not null default 0 check (issued_quote_count >= 0),
  subscription_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_requests_one_open_email_uidx
  on public.account_deletion_requests (email_normalized)
  where status = 'open';

comment on table public.account_deletion_requests is
  'A request to close an account. Inserting or updating a row does not delete auth users, organisations, quotes, or subscriptions.';

alter table public.account_deletion_requests enable row level security;

revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;
