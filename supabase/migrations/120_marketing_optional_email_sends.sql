-- Actual Loops workflow send times for the 48-hour optional-email limit.
-- Rows arrive from the Loops webhook. Nothing here is backfilled.
-- This migration does not set reminder activation and does not change
-- marketing_engagement_runtime.

create table if not exists public.marketing_optional_email_sends (
  webhook_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workflow_id text not null,
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.marketing_optional_email_sends is
  'One row per verified Loops workflow send for the known tip and reminder workflows. Used to keep optional emails 48 hours apart. No address is stored. No backfill.';

create index if not exists marketing_optional_email_sends_user_idx
  on public.marketing_optional_email_sends (user_id, sent_at);

alter table public.marketing_optional_email_sends enable row level security;
revoke all on table public.marketing_optional_email_sends from public, anon, authenticated;
grant select, insert on table public.marketing_optional_email_sends to service_role;

notify pgrst, 'reload schema';
