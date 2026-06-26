-- Security hardening: idempotent RLS enable + parent/org consistency on child rows.

-- Ensure RLS is enabled on all application tables (no-op if already enabled).
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

-- Reject pricing_items whose document belongs to a different organisation.
create or replace function public.enforce_pricing_item_org_match()
returns trigger
language plpgsql
as $$
declare
  doc_org uuid;
begin
  select org_id into doc_org
  from public.pricing_documents
  where id = new.pricing_document_id;

  if doc_org is null then
    raise exception 'pricing_document not found';
  end if;

  if new.org_id is distinct from doc_org then
    raise exception 'pricing_item org_id must match pricing_document org_id';
  end if;

  return new;
end;
$$;

drop trigger if exists pricing_items_org_match on public.pricing_items;
create trigger pricing_items_org_match
  before insert or update on public.pricing_items
  for each row
  execute function public.enforce_pricing_item_org_match();

-- Reject quote_items whose quote belongs to a different organisation.
create or replace function public.enforce_quote_item_org_match()
returns trigger
language plpgsql
as $$
declare
  quote_org uuid;
begin
  select org_id into quote_org
  from public.quotes
  where id = new.quote_id;

  if quote_org is null then
    raise exception 'quote not found';
  end if;

  if new.org_id is distinct from quote_org then
    raise exception 'quote_item org_id must match quote org_id';
  end if;

  return new;
end;
$$;

drop trigger if exists quote_items_org_match on public.quote_items;
create trigger quote_items_org_match
  before insert or update on public.quote_items
  for each row
  execute function public.enforce_quote_item_org_match();

-- note_proposals: add missing DELETE policy
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'note_proposals'
      and policyname = 'Users can delete note proposals in their organisation'
  ) then
    create policy "Users can delete note proposals in their organisation"
      on public.note_proposals for delete
      using (org_id = public.auth_org_id());
  end if;
end $$;

notify pgrst, 'reload schema';
