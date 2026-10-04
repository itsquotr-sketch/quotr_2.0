-- Organisation customer directory.
-- A customer is a convenience source for new projects. It is not document authority.
-- Project client_name and client_email stay the project snapshot.
-- This migration does not update quotes, pricing documents, variations, or deliveries.
-- There is no 037 or 055. 083 is the next migration after Preview head 082.
-- No backfill from historical project names. No unique name or email.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint customers_name_len check (char_length(btrim(name)) between 1 and 160),
  constraint customers_email_len check (email is null or char_length(btrim(email)) between 1 and 254),
  constraint customers_phone_len check (phone is null or char_length(btrim(phone)) between 1 and 40),
  constraint customers_notes_len check (notes is null or char_length(notes) <= 5000)
);

comment on table public.customers is
  'Organisation customer directory. Editing a customer does not rewrite projects or issued documents.';

comment on column public.customers.email is
  'Optional. Not unique. Blank emails are stored as null so shared or missing addresses are allowed.';

comment on column public.customers.archived_at is
  'Soft archive. Archived customers stay linked to existing projects and are hidden from new-job selection.';

create index if not exists customers_org_id_idx
  on public.customers (org_id);

create index if not exists customers_org_active_name_idx
  on public.customers (org_id, name)
  where archived_at is null;

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

create or replace function public.protect_customer_organisation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.org_id is distinct from old.org_id then
    raise exception 'CUSTOMER_ORG_IMMUTABLE'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'CUSTOMER_CREATED_BY_IMMUTABLE'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_protect_organisation on public.customers;
create trigger customers_protect_organisation
  before update on public.customers
  for each row
  execute function public.protect_customer_organisation();

alter table public.projects
  add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_customer_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_customer_id_fkey
      foreign key (customer_id)
      references public.customers (id)
      on delete set null;
  end if;
end $$;

comment on column public.projects.customer_id is
  'Optional link to the organisation customer used when the project was set up. Null is valid. Deleting a customer unlinks the project and does not delete it. client_name and client_email remain the project snapshot.';

alter table public.projects
  add column if not exists creation_request_id uuid;

create unique index if not exists projects_org_creation_request_uidx
  on public.projects (org_id, creation_request_id)
  where creation_request_id is not null;

create index if not exists projects_customer_id_idx
  on public.projects (customer_id)
  where customer_id is not null;

comment on column public.projects.creation_request_id is
  'Client idempotency key for one create-job submission. A repeat returns the existing project and does not create another customer.';

create or replace function public.enforce_project_customer_same_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.customer_id is null then
    return new;
  end if;

  select c.org_id
    into v_org
  from public.customers c
  where c.id = new.customer_id;

  if v_org is null or v_org is distinct from new.org_id then
    raise exception 'PROJECT_CUSTOMER_ORG_MISMATCH'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_customer_same_org on public.projects;
create trigger projects_customer_same_org
  before insert or update of customer_id, org_id on public.projects
  for each row
  execute function public.enforce_project_customer_same_org();

alter table public.customers enable row level security;

revoke all on table public.customers from public, anon, authenticated;
grant select, insert, update on table public.customers to authenticated;
grant select, insert, update, delete on table public.customers to service_role;

drop policy if exists customers_select_active_member on public.customers;
create policy customers_select_active_member
  on public.customers
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = customers.org_id
        and m.status = 'active'
    )
  );

drop policy if exists customers_insert_active_work_role on public.customers;
create policy customers_insert_active_work_role
  on public.customers
  for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = auth.uid()
    and public.auth_can_mutate_work()
  );

drop policy if exists customers_update_active_work_role on public.customers;
create policy customers_update_active_work_role
  on public.customers
  for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_mutate_work()
  );

-- No DELETE policy and no DELETE grant for authenticated.
-- Archive is an UPDATE of archived_at. service_role bypasses RLS for cleanup.

create or replace function public.create_project_with_new_customer(
  p_title text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_site_address text,
  p_creation_request_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_email text := nullif(btrim(coalesce(p_customer_email, '')), '');
  v_phone text := nullif(btrim(coalesce(p_customer_phone, '')), '');
  v_site text := nullif(btrim(coalesce(p_site_address, '')), '');
  v_customer uuid;
  v_project uuid;
begin
  if v_uid is null or v_org is null or not public.auth_can_mutate_work() then
    raise exception 'CUSTOMER_PROJECT_FORBIDDEN'
      using errcode = '42501';
  end if;

  if p_creation_request_id is null then
    raise exception 'CREATION_REQUEST_REQUIRED'
      using errcode = '23514';
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'PROJECT_TITLE_INVALID'
      using errcode = '23514';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 160 then
    raise exception 'CUSTOMER_NAME_INVALID'
      using errcode = '23514';
  end if;

  if v_email is not null and (
    char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'CUSTOMER_EMAIL_INVALID'
      using errcode = '23514';
  end if;

  if v_phone is not null and char_length(v_phone) > 40 then
    raise exception 'CUSTOMER_PHONE_INVALID'
      using errcode = '23514';
  end if;

  select p.id
    into v_project
  from public.projects p
  where p.org_id = v_org
    and p.creation_request_id = p_creation_request_id
    and p.deleted_at is null
  limit 1;

  if v_project is not null then
    return v_project;
  end if;

  begin
    insert into public.customers (
      org_id, name, email, phone, created_by
    ) values (
      v_org, v_name, v_email, v_phone, v_uid
    )
    returning id into v_customer;

    insert into public.projects (
      org_id,
      created_by,
      title,
      client_name,
      client_email,
      site_address,
      priority,
      stage,
      quality_level,
      status,
      business_status,
      customer_id,
      creation_request_id
    ) values (
      v_org,
      v_uid,
      v_title,
      v_name,
      v_email,
      v_site,
      'normal',
      'brief',
      'unknown',
      'draft',
      'lead',
      v_customer,
      p_creation_request_id
    )
    returning id into v_project;
  exception
    when unique_violation then
      select p.id
        into v_project
      from public.projects p
      where p.org_id = v_org
        and p.creation_request_id = p_creation_request_id
      limit 1;
      if v_project is null then
        raise;
      end if;
      return v_project;
  end;

  return v_project;
end;
$$;

comment on function public.create_project_with_new_customer(text, text, text, text, text, uuid) is
  'Inserts one customer and one project in a single transaction, or returns the project already stored for creation_request_id. Copies name and email onto the project. Does not update quotes, pricing, or variations. Billing entitlement stays in the server action. RLS and auth_can_mutate_work still apply.';

revoke all on function public.create_project_with_new_customer(text, text, text, text, text, uuid) from public, anon;
grant execute on function public.create_project_with_new_customer(text, text, text, text, text, uuid) to authenticated, service_role;

revoke all on function public.protect_customer_organisation() from public, anon, authenticated;
revoke all on function public.enforce_project_customer_same_org() from public, anon, authenticated;

notify pgrst, 'reload schema';
