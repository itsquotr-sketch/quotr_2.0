-- Stage 3.1B.4B — Scope discovery persistence (LOCAL ONLY until owner Preview gate).
-- Additive. Does not mutate Facts, Work Areas, estimates, pricing, quotes, or Analyse Job.
-- Evidence is JSONB on suggestions. Decisions are append-only. No raw provider output column.

-- ---------------------------------------------------------------------------
-- A. Tables
-- ---------------------------------------------------------------------------

create table public.scope_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  requested_by uuid null references public.profiles (id) on delete set null,
  trigger text not null
    check (
      trigger in (
        'INITIAL_ANALYSE_JOB',
        'USER_REQUESTED_RERUN',
        'PROJECT_BRIEF_CHANGED',
        'SITE_NOTES_CHANGED',
        'FACTS_CHANGED',
        'CONSTRAINTS_CHANGED',
        'WORK_AREAS_CHANGED'
      )
    ),
  status text not null
    check (
      status in (
        'VALIDATED',
        'RUNNING',
        'COMPLETED',
        'COMPLETED_WITH_WARNINGS',
        'FAILED_VALIDATION',
        'FAILED_DETERMINISTIC',
        'FAILED_PROVIDER',
        'FAILED_MERGE',
        'REUSED',
        'CANCELLED'
      )
    ),
  source_fingerprint text not null,
  idempotency_key text not null,
  contract_version text not null,
  catalogue_version text not null,
  prompt_version text not null,
  provider text null,
  model text null,
  analysis_objective text not null,
  source_snapshot jsonb not null
    check (jsonb_typeof(source_snapshot) = 'object'),
  provider_metadata jsonb null
    check (provider_metadata is null or jsonb_typeof(provider_metadata) = 'object'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(errors) = 'array'),
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  input_tokens integer null check (input_tokens is null or input_tokens >= 0),
  output_tokens integer null check (output_tokens is null or output_tokens >= 0),
  repair_attempted boolean not null default false,
  provider_called boolean not null default false,
  reused_run_id uuid null references public.scope_discovery_runs (id) on delete set null,
  superseded_run_id uuid null references public.scope_discovery_runs (id) on delete set null,
  started_at timestamptz not null,
  completed_at timestamptz null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scope_discovery_runs_completed_after_started
    check (completed_at is null or completed_at >= started_at),
  constraint scope_discovery_runs_snapshot_size
    check (pg_column_size(source_snapshot) <= 65536),
  constraint scope_discovery_runs_warnings_size
    check (pg_column_size(warnings) <= 16384),
  constraint scope_discovery_runs_errors_size
    check (pg_column_size(errors) <= 16384)
);

comment on table public.scope_discovery_runs is
  'Intelligent Scope Discovery run history. Does not own Facts or Work Areas. No commercial totals.';

comment on column public.scope_discovery_runs.source_snapshot is
  'Material source revisions/hashes only — not raw customer dumps or secrets.';

comment on column public.scope_discovery_runs.provider_metadata is
  'Provider/model/request metadata only — never API keys or raw provider response bodies.';

create table public.scope_discovery_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  run_id uuid not null references public.scope_discovery_runs (id) on delete cascade,
  suggestion_identity text not null,
  suggestion_kind text not null
    check (
      suggestion_kind in (
        'WORK_AREA',
        'SUB_SCOPE',
        'MISSING_SCOPE',
        'DEPENDENCY',
        'POSSIBLE_EXCLUSION',
        'CLARIFICATION_REQUIRED',
        'DUPLICATE_WARNING',
        'CONFLICT_WARNING'
      )
    ),
  proposed_work_area_type text null,
  proposed_title text not null,
  proposed_description text null,
  related_work_area_id uuid null references public.work_areas (id) on delete set null,
  parent_suggestion_id uuid null references public.scope_discovery_suggestions (id) on delete set null,
  confidence numeric null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  confidence_band text not null check (confidence_band in ('HIGH', 'MEDIUM', 'LOW')),
  original_status text not null default 'PROPOSED'
    check (original_status = 'PROPOSED'),
  evidence jsonb not null
    check (jsonb_typeof(evidence) = 'array'),
  source_snapshot jsonb not null
    check (jsonb_typeof(source_snapshot) = 'object'),
  dependency_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(dependency_references) = 'array'),
  conflict_references jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conflict_references) = 'array'),
  missing_information jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_information) = 'array'),
  rationale_code text not null,
  contract_version text not null,
  catalogue_version text not null,
  prompt_version text null,
  provider_metadata jsonb null
    check (provider_metadata is null or jsonb_typeof(provider_metadata) = 'object'),
  stale_reason text null,
  superseded_by_suggestion_id uuid null
    references public.scope_discovery_suggestions (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint scope_discovery_suggestions_evidence_size
    check (pg_column_size(evidence) <= 65536),
  constraint scope_discovery_suggestions_snapshot_size
    check (pg_column_size(source_snapshot) <= 65536),
  constraint scope_discovery_suggestions_run_identity_unique
    unique (run_id, suggestion_identity)
);

comment on table public.scope_discovery_suggestions is
  'Immutable original scope-discovery proposals and evidence. Decision history lives in scope_discovery_decisions. Does not own Facts or Work Areas.';

comment on column public.scope_discovery_suggestions.evidence is
  'Validated capped evidence JSONB — never authoritative Facts by itself.';

comment on column public.scope_discovery_suggestions.original_status is
  'Immutable insert status for model/deterministic proposals — always PROPOSED.';

create table public.scope_discovery_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  run_id uuid not null references public.scope_discovery_runs (id) on delete cascade,
  suggestion_id uuid not null references public.scope_discovery_suggestions (id) on delete cascade,
  decision_type text not null
    check (decision_type in ('ACCEPT', 'REJECT', 'MODIFY')),
  decided_by uuid not null references public.profiles (id),
  decided_at timestamptz not null,
  reason_code text null,
  user_note text null,
  modified_title text null,
  modified_description text null,
  modified_work_area_type text null,
  source_revision text not null,
  created_work_area_id uuid null references public.work_areas (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.scope_discovery_decisions is
  'Append-only user accept/reject/modify events for scope discovery. Provenance only — no Company DNA writes. Does not own Facts.';

-- ---------------------------------------------------------------------------
-- B. Indexes and idempotency
-- ---------------------------------------------------------------------------

create index scope_discovery_runs_org_project_idx
  on public.scope_discovery_runs (org_id, project_id);

create index scope_discovery_runs_project_created_idx
  on public.scope_discovery_runs (project_id, created_at desc);

create index scope_discovery_runs_status_idx
  on public.scope_discovery_runs (status);

create index scope_discovery_runs_fingerprint_idx
  on public.scope_discovery_runs (source_fingerprint);

create index scope_discovery_runs_project_idempotency_idx
  on public.scope_discovery_runs (project_id, idempotency_key);

-- One active/in-flight run per idempotency key (insert-before-provider).
create unique index scope_discovery_runs_active_idempotency_uidx
  on public.scope_discovery_runs (project_id, idempotency_key)
  where status = 'RUNNING';

create index scope_discovery_suggestions_run_id_idx
  on public.scope_discovery_suggestions (run_id);

create index scope_discovery_suggestions_project_identity_idx
  on public.scope_discovery_suggestions (project_id, suggestion_identity);

create index scope_discovery_suggestions_related_wa_idx
  on public.scope_discovery_suggestions (related_work_area_id);

create index scope_discovery_decisions_suggestion_decided_idx
  on public.scope_discovery_decisions (suggestion_id, decided_at);

create index scope_discovery_decisions_project_created_idx
  on public.scope_discovery_decisions (project_id, created_at desc);

-- At most one ACCEPT decision per suggestion (corrective REJECT/MODIFY still allowed).
create unique index scope_discovery_decisions_one_accept_uidx
  on public.scope_discovery_decisions (suggestion_id)
  where decision_type = 'ACCEPT';

-- ---------------------------------------------------------------------------
-- C. updated_at helper for runs
-- ---------------------------------------------------------------------------

create or replace function public.set_scope_discovery_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scope_discovery_runs_set_updated_at
  before update on public.scope_discovery_runs
  for each row
  execute function public.set_scope_discovery_runs_updated_at();

-- ---------------------------------------------------------------------------
-- D. Org/project integrity
-- ---------------------------------------------------------------------------

-- Reuse Stage 2A project-child org match for all three tables.
drop trigger if exists scope_discovery_runs_project_org_match on public.scope_discovery_runs;
create trigger scope_discovery_runs_project_org_match
  before insert or update on public.scope_discovery_runs
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists scope_discovery_suggestions_project_org_match
  on public.scope_discovery_suggestions;
create trigger scope_discovery_suggestions_project_org_match
  before insert or update on public.scope_discovery_suggestions
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists scope_discovery_decisions_project_org_match
  on public.scope_discovery_decisions;
create trigger scope_discovery_decisions_project_org_match
  before insert or update on public.scope_discovery_decisions
  for each row
  execute function public.enforce_child_project_org_match();

create or replace function public.enforce_scope_discovery_suggestion_run_match()
returns trigger
language plpgsql
as $$
declare
  run_org uuid;
  run_project uuid;
begin
  select org_id, project_id into run_org, run_project
  from public.scope_discovery_runs
  where id = new.run_id;

  if run_org is null then
    raise exception 'scope_discovery run not found';
  end if;

  if new.org_id is distinct from run_org
     or new.project_id is distinct from run_project then
    raise exception 'scope_discovery_suggestions org/project must match parent run';
  end if;

  if new.parent_suggestion_id is not null then
    if not exists (
      select 1
      from public.scope_discovery_suggestions p
      where p.id = new.parent_suggestion_id
        and p.run_id = new.run_id
        and p.org_id = new.org_id
        and p.project_id = new.project_id
    ) then
      raise exception 'parent suggestion must belong to the same run/org/project';
    end if;
  end if;

  if new.related_work_area_id is not null then
    if not exists (
      select 1
      from public.work_areas w
      where w.id = new.related_work_area_id
        and w.org_id = new.org_id
        and w.project_id = new.project_id
    ) then
      raise exception 'related work area must belong to the same org/project';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists scope_discovery_suggestions_run_match
  on public.scope_discovery_suggestions;
create trigger scope_discovery_suggestions_run_match
  before insert or update on public.scope_discovery_suggestions
  for each row
  execute function public.enforce_scope_discovery_suggestion_run_match();

create or replace function public.enforce_scope_discovery_decision_match()
returns trigger
language plpgsql
as $$
declare
  sug_org uuid;
  sug_project uuid;
  sug_run uuid;
begin
  select org_id, project_id, run_id into sug_org, sug_project, sug_run
  from public.scope_discovery_suggestions
  where id = new.suggestion_id;

  if sug_org is null then
    raise exception 'scope_discovery suggestion not found';
  end if;

  if new.org_id is distinct from sug_org
     or new.project_id is distinct from sug_project
     or new.run_id is distinct from sug_run then
    raise exception 'scope_discovery_decisions must match suggestion org/project/run';
  end if;

  if new.created_work_area_id is not null then
    if not exists (
      select 1
      from public.work_areas w
      where w.id = new.created_work_area_id
        and w.org_id = new.org_id
        and w.project_id = new.project_id
    ) then
      raise exception 'created work area must belong to the same org/project';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists scope_discovery_decisions_match on public.scope_discovery_decisions;
create trigger scope_discovery_decisions_match
  before insert or update on public.scope_discovery_decisions
  for each row
  execute function public.enforce_scope_discovery_decision_match();

create or replace function public.enforce_scope_discovery_run_refs_match()
returns trigger
language plpgsql
as $$
begin
  if new.reused_run_id is not null then
    if not exists (
      select 1 from public.scope_discovery_runs r
      where r.id = new.reused_run_id
        and r.org_id = new.org_id
        and r.project_id = new.project_id
    ) then
      raise exception 'reused_run_id must belong to the same org/project';
    end if;
  end if;

  if new.superseded_run_id is not null then
    if not exists (
      select 1 from public.scope_discovery_runs r
      where r.id = new.superseded_run_id
        and r.org_id = new.org_id
        and r.project_id = new.project_id
    ) then
      raise exception 'superseded_run_id must belong to the same org/project';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists scope_discovery_runs_refs_match on public.scope_discovery_runs;
create trigger scope_discovery_runs_refs_match
  before insert or update on public.scope_discovery_runs
  for each row
  execute function public.enforce_scope_discovery_run_refs_match();

-- ---------------------------------------------------------------------------
-- E. Immutability
-- ---------------------------------------------------------------------------

create or replace function public.enforce_scope_discovery_run_immutability()
returns trigger
language plpgsql
as $$
declare
  terminal constant text[] := array[
    'COMPLETED',
    'COMPLETED_WITH_WARNINGS',
    'FAILED_VALIDATION',
    'FAILED_DETERMINISTIC',
    'FAILED_PROVIDER',
    'FAILED_MERGE',
    'REUSED',
    'CANCELLED'
  ];
begin
  -- Never reverse to RUNNING from a terminal state.
  if old.status = any (terminal) and new.status = 'RUNNING' then
    raise exception 'terminal scope_discovery_runs cannot return to RUNNING';
  end if;

  if old.status = any (terminal) then
    if new.org_id is distinct from old.org_id
       or new.project_id is distinct from old.project_id
       or new.trigger is distinct from old.trigger
       or new.status is distinct from old.status
       or new.source_fingerprint is distinct from old.source_fingerprint
       or new.idempotency_key is distinct from old.idempotency_key
       or new.contract_version is distinct from old.contract_version
       or new.catalogue_version is distinct from old.catalogue_version
       or new.prompt_version is distinct from old.prompt_version
       or new.provider is distinct from old.provider
       or new.model is distinct from old.model
       or new.analysis_objective is distinct from old.analysis_objective
       or new.source_snapshot is distinct from old.source_snapshot
       or new.provider_metadata is distinct from old.provider_metadata
       or new.warnings is distinct from old.warnings
       or new.errors is distinct from old.errors
       or new.latency_ms is distinct from old.latency_ms
       or new.input_tokens is distinct from old.input_tokens
       or new.output_tokens is distinct from old.output_tokens
       or new.repair_attempted is distinct from old.repair_attempted
       or new.provider_called is distinct from old.provider_called
       or new.reused_run_id is distinct from old.reused_run_id
       or new.superseded_run_id is distinct from old.superseded_run_id
       or new.started_at is distinct from old.started_at
       or new.completed_at is distinct from old.completed_at
       or new.requested_by is distinct from old.requested_by
    then
      raise exception 'terminal scope_discovery_runs identity fields are immutable';
    end if;
    -- archived_at (and updated_at) may change after terminal.
  end if;

  return new;
end;
$$;

drop trigger if exists scope_discovery_runs_immutability on public.scope_discovery_runs;
create trigger scope_discovery_runs_immutability
  before update on public.scope_discovery_runs
  for each row
  execute function public.enforce_scope_discovery_run_immutability();

create or replace function public.enforce_scope_discovery_suggestion_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is distinct from old.org_id
     or new.project_id is distinct from old.project_id
     or new.run_id is distinct from old.run_id
     or new.suggestion_identity is distinct from old.suggestion_identity
     or new.suggestion_kind is distinct from old.suggestion_kind
     or new.proposed_work_area_type is distinct from old.proposed_work_area_type
     or new.proposed_title is distinct from old.proposed_title
     or new.proposed_description is distinct from old.proposed_description
     or new.related_work_area_id is distinct from old.related_work_area_id
     or new.parent_suggestion_id is distinct from old.parent_suggestion_id
     or new.confidence is distinct from old.confidence
     or new.confidence_band is distinct from old.confidence_band
     or new.original_status is distinct from old.original_status
     or new.evidence is distinct from old.evidence
     or new.source_snapshot is distinct from old.source_snapshot
     or new.dependency_references is distinct from old.dependency_references
     or new.conflict_references is distinct from old.conflict_references
     or new.missing_information is distinct from old.missing_information
     or new.rationale_code is distinct from old.rationale_code
     or new.contract_version is distinct from old.contract_version
     or new.catalogue_version is distinct from old.catalogue_version
     or new.prompt_version is distinct from old.prompt_version
     or new.provider_metadata is distinct from old.provider_metadata
     or new.created_at is distinct from old.created_at
  then
    raise exception 'scope_discovery_suggestions original payload is immutable';
  end if;

  -- Only stale_reason / superseded_by_suggestion_id may change (one-way lifecycle).
  return new;
end;
$$;

drop trigger if exists scope_discovery_suggestions_immutability
  on public.scope_discovery_suggestions;
create trigger scope_discovery_suggestions_immutability
  before update on public.scope_discovery_suggestions
  for each row
  execute function public.enforce_scope_discovery_suggestion_immutability();

create or replace function public.enforce_scope_discovery_decision_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'scope_discovery_decisions are append-only';
end;
$$;

drop trigger if exists scope_discovery_decisions_no_update on public.scope_discovery_decisions;
create trigger scope_discovery_decisions_no_update
  before update on public.scope_discovery_decisions
  for each row
  execute function public.enforce_scope_discovery_decision_append_only();

drop trigger if exists scope_discovery_decisions_no_delete on public.scope_discovery_decisions;
create trigger scope_discovery_decisions_no_delete
  before delete on public.scope_discovery_decisions
  for each row
  execute function public.enforce_scope_discovery_decision_append_only();

-- ---------------------------------------------------------------------------
-- F. RLS
-- ---------------------------------------------------------------------------

alter table public.scope_discovery_runs enable row level security;
alter table public.scope_discovery_suggestions enable row level security;
alter table public.scope_discovery_decisions enable row level security;

create policy "scope_discovery_runs_select_own_org"
  on public.scope_discovery_runs for select
  using (org_id = public.auth_org_id());

create policy "scope_discovery_runs_insert_own_org"
  on public.scope_discovery_runs for insert
  with check (org_id = public.auth_org_id());

create policy "scope_discovery_runs_update_own_org"
  on public.scope_discovery_runs for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- No DELETE policy for authenticated users on runs.

create policy "scope_discovery_suggestions_select_own_org"
  on public.scope_discovery_suggestions for select
  using (org_id = public.auth_org_id());

create policy "scope_discovery_suggestions_insert_own_org"
  on public.scope_discovery_suggestions for insert
  with check (org_id = public.auth_org_id());

create policy "scope_discovery_suggestions_update_own_org"
  on public.scope_discovery_suggestions for update
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- No DELETE policy for authenticated users on suggestions.

create policy "scope_discovery_decisions_select_own_org"
  on public.scope_discovery_decisions for select
  using (org_id = public.auth_org_id());

create policy "scope_discovery_decisions_insert_own_org"
  on public.scope_discovery_decisions for insert
  with check (org_id = public.auth_org_id());

-- No UPDATE / DELETE policies for decisions (append-only + trigger defence).

-- ---------------------------------------------------------------------------
-- G. Grants (least privilege — align with 026; no GRANT ALL)
-- ---------------------------------------------------------------------------
-- Migration 026 default privileges grant SELECT/INSERT/UPDATE/DELETE on new
-- tables to authenticated. Revoke first, then grant only what this batch needs.

revoke all on public.scope_discovery_runs from anon, authenticated, service_role;
revoke all on public.scope_discovery_suggestions from anon, authenticated, service_role;
revoke all on public.scope_discovery_decisions from anon, authenticated, service_role;

grant select, insert, update on public.scope_discovery_runs to authenticated;
grant select, insert, update on public.scope_discovery_suggestions to authenticated;
-- Decisions are append-only for authenticated clients (no UPDATE/DELETE).
grant select, insert on public.scope_discovery_decisions to authenticated;

grant select, insert, update, delete on public.scope_discovery_runs to service_role;
grant select, insert, update, delete on public.scope_discovery_suggestions to service_role;
grant select, insert, update, delete on public.scope_discovery_decisions to service_role;

notify pgrst, 'reload schema';
