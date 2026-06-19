-- Phase 5B-0: estimate stale tracking and target margin for future overrides

alter table public.estimates
add column if not exists is_stale boolean not null default false;

alter table public.estimates
add column if not exists target_margin_percent numeric(5, 2);
