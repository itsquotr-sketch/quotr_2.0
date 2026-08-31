-- INCIDENT-AI-ANALYSE-02: durable product AI usage metadata.
-- Stores token/latency/error class only. No request text or generated output.

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid null references public.projects (id) on delete set null,
  feature text not null
    check (
      feature in (
        'analyse_job',
        'analyse_notes',
        'scope_discovery'
      )
    ),
  provider text not null check (provider in ('anthropic')),
  model text not null,
  input_tokens integer null check (input_tokens is null or input_tokens >= 0),
  output_tokens integer null check (output_tokens is null or output_tokens >= 0),
  cache_creation_input_tokens integer null
    check (
      cache_creation_input_tokens is null
      or cache_creation_input_tokens >= 0
    ),
  cache_read_input_tokens integer null
    check (
      cache_read_input_tokens is null
      or cache_read_input_tokens >= 0
    ),
  latency_ms integer not null check (latency_ms >= 0),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  success boolean not null,
  error_class text null,
  created_at timestamptz not null default now()
);

create index ai_usage_events_org_created_idx
  on public.ai_usage_events (org_id, created_at desc);

create index ai_usage_events_project_created_idx
  on public.ai_usage_events (project_id, created_at desc)
  where project_id is not null;

alter table public.ai_usage_events enable row level security;

create policy "Users can select AI usage in their organisation"
  on public.ai_usage_events for select
  using (org_id = public.auth_org_id());

create policy "Users can insert AI usage in their organisation"
  on public.ai_usage_events for insert
  with check (org_id = public.auth_org_id());

-- No update/delete policies: usage rows are append-only for the session role.

grant select, insert on public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.ai_usage_events to service_role;

notify pgrst, 'reload schema';
