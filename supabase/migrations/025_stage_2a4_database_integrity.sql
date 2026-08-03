-- Stage 2A Batch 2A.4: parent/project org consistency, margin default, GST bounds.
-- Local-only additive migration. Do not apply remotely without explicit owner approval.
-- Idempotent: safe on clean DB and on DB where 023/024 already applied.

-- ---------------------------------------------------------------------------
-- A. Parent-child organisation consistency (S1-007)
-- Protect the seven project-child tables that lacked triggers after migration 023.
-- pricing_items / quote_items already covered by 023 — do not duplicate.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_child_project_org_match()
returns trigger
language plpgsql
as $$
declare
  project_org uuid;
begin
  select org_id into project_org
  from public.projects
  where id = new.project_id;

  if project_org is null then
    raise exception 'project not found';
  end if;

  if new.org_id is distinct from project_org then
    raise exception '% org_id must match project org_id', TG_TABLE_NAME;
  end if;

  return new;
end;
$$;

drop trigger if exists work_areas_project_org_match on public.work_areas;
create trigger work_areas_project_org_match
  before insert or update on public.work_areas
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists project_facts_project_org_match on public.project_facts;
create trigger project_facts_project_org_match
  before insert or update on public.project_facts
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists question_blocks_project_org_match on public.question_blocks;
create trigger question_blocks_project_org_match
  before insert or update on public.question_blocks
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists questions_project_org_match on public.questions;
create trigger questions_project_org_match
  before insert or update on public.questions
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists constraints_project_org_match on public.constraints;
create trigger constraints_project_org_match
  before insert or update on public.constraints
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists estimates_project_org_match on public.estimates;
create trigger estimates_project_org_match
  before insert or update on public.estimates
  for each row
  execute function public.enforce_child_project_org_match();

drop trigger if exists estimate_line_items_project_org_match on public.estimate_line_items;
create trigger estimate_line_items_project_org_match
  before insert or update on public.estimate_line_items
  for each row
  execute function public.enforce_child_project_org_match();

-- ---------------------------------------------------------------------------
-- B. Database gross-margin default: 25% → 20% for new organisation_settings rows
-- Does not rewrite existing stored margins.
-- ---------------------------------------------------------------------------

alter table public.organisation_settings
  alter column default_margin_percent set default 20.00;

-- ---------------------------------------------------------------------------
-- C. GST bounds on client-mutable document columns (0–100 inclusive)
-- organisation_settings.default_gst_rate already constrained in migration 017.
-- Only add when no invalid rows exist and constraint is absent.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.pricing_documents
    where gst_rate is null or gst_rate < 0 or gst_rate > 100
  ) then
    raise exception 'Cannot add pricing_documents gst_rate check: invalid rows exist';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pricing_documents_gst_rate_check'
      and conrelid = 'public.pricing_documents'::regclass
  ) then
    alter table public.pricing_documents
      add constraint pricing_documents_gst_rate_check
      check (gst_rate >= 0 and gst_rate <= 100);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from public.quotes
    where gst_rate is null or gst_rate < 0 or gst_rate > 100
  ) then
    raise exception 'Cannot add quotes gst_rate check: invalid rows exist';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quotes_gst_rate_check'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_gst_rate_check
      check (gst_rate >= 0 and gst_rate <= 100);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Soft-delete (S1-017): no hard-delete of children; no RLS rewrite in this
-- migration. Active visibility is enforced in application ownership helpers
-- (assertOrgOwnsActiveProject) so soft-deleted project children stay stored
-- but are hidden from normal active queries.
-- ---------------------------------------------------------------------------

-- Ensure RLS remains enabled on organisation-owned tables (idempotent).
alter table if exists public.organisations enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.projects enable row level security;
alter table if exists public.work_areas enable row level security;
alter table if exists public.project_facts enable row level security;
alter table if exists public.question_blocks enable row level security;
alter table if exists public.questions enable row level security;
alter table if exists public.constraints enable row level security;
alter table if exists public.estimates enable row level security;
alter table if exists public.estimate_line_items enable row level security;
alter table if exists public.rates enable row level security;
alter table if exists public.organisation_settings enable row level security;
alter table if exists public.organisation_work_areas enable row level security;
alter table if exists public.project_notes enable row level security;
alter table if exists public.note_proposals enable row level security;
alter table if exists public.pricing_documents enable row level security;
alter table if exists public.pricing_items enable row level security;
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_items enable row level security;
alter table if exists public.pricing_audit_log enable row level security;

notify pgrst, 'reload schema';
