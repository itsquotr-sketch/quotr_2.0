-- Reusable subcontractor rates. A rate schedule file stays a document.
-- Nothing here parses a file, writes an estimate, writes pricing, or changes resolveRate.
-- A later edit inserts a version. The originating response and its amount stay on version 1.

create table if not exists public.subcontractor_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  subcontractor_id uuid not null references public.subcontractors (id) on delete cascade,
  retired_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subcontractor_rates is
  'Identity of one reusable subcontractor rate. Money and scope live on versions. Retired rates stay readable and are not suggested.';

create index if not exists subcontractor_rates_business_idx
  on public.subcontractor_rates (subcontractor_id, retired_at);

create table if not exists public.subcontractor_rate_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  rate_id uuid not null references public.subcontractor_rates (id) on delete cascade,
  version_number integer not null,
  work_area_type text not null,
  scope text not null,
  unit text not null,
  cost_ex_gst numeric(12, 2) not null,
  currency text not null default 'NZD',
  minimum_charge numeric(12, 2),
  quantity_band_min numeric(12, 2),
  quantity_band_max numeric(12, 2),
  inclusions text not null default '',
  exclusions text not null default '',
  effective_from date not null,
  effective_until date,
  source text not null,
  source_document_id uuid references public.subcontractor_documents (id) on delete set null,
  origin_response_id uuid references public.rfq_responses (id) on delete restrict,
  informing_response_id uuid references public.rfq_responses (id) on delete restrict,
  source_amount_ex_gst numeric(12, 2),
  last_confirmed_on date,
  internal_notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subcontractor_rate_versions_number_positive check (version_number > 0),
  constraint subcontractor_rate_versions_uidx unique (rate_id, version_number),
  constraint subcontractor_rate_versions_unit_known check (unit in ('lump_sum', 'm2', 'm', 'item', 'hour')),
  constraint subcontractor_rate_versions_currency_nzd check (currency = 'NZD'),
  constraint subcontractor_rate_versions_source_known check (source in ('builder', 'rfq_response', 'rate_schedule_document')),
  constraint subcontractor_rate_versions_scope_len check (char_length(btrim(scope)) between 1 and 500),
  constraint subcontractor_rate_versions_text_len check (
    char_length(inclusions) <= 4000
    and char_length(exclusions) <= 4000
    and char_length(internal_notes) <= 2000
    and char_length(work_area_type) between 1 and 80
  ),
  constraint subcontractor_rate_versions_cost_range check (cost_ex_gst >= 0 and cost_ex_gst <= 99999999.99),
  constraint subcontractor_rate_versions_minimum_range check (
    minimum_charge is null or (minimum_charge >= 0 and minimum_charge <= 99999999.99)
  ),
  constraint subcontractor_rate_versions_band check (
    (quantity_band_min is null or quantity_band_min >= 0)
    and (quantity_band_max is null or quantity_band_max >= 0)
    and (quantity_band_min is null or quantity_band_max is null or quantity_band_max >= quantity_band_min)
  ),
  constraint subcontractor_rate_versions_dates check (effective_until is null or effective_until >= effective_from),
  constraint subcontractor_rate_versions_origin_amount check (
    (origin_response_id is null and source_amount_ex_gst is null)
    or (origin_response_id is not null and source_amount_ex_gst is not null)
  )
);

comment on table public.subcontractor_rate_versions is
  'Immutable rate version. source_amount_ex_gst is the originating response price and is copied, not edited.';

create index if not exists subcontractor_rate_versions_rate_idx
  on public.subcontractor_rate_versions (rate_id, version_number desc);

create or replace function public.subcontractor_rate_versions_block_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'SUBCONTRACTOR_RATE_VERSION_IMMUTABLE';
end;
$$;

drop trigger if exists subcontractor_rate_versions_immutable on public.subcontractor_rate_versions;
create trigger subcontractor_rate_versions_immutable
  before update on public.subcontractor_rate_versions
  for each row execute function public.subcontractor_rate_versions_block_update();

alter table public.subcontractor_rates enable row level security;
alter table public.subcontractor_rate_versions enable row level security;

revoke all on table public.subcontractor_rates from public, anon, authenticated;
revoke all on table public.subcontractor_rate_versions from public, anon, authenticated;
grant select on table public.subcontractor_rates to authenticated;
grant select on table public.subcontractor_rate_versions to authenticated;
grant select, insert, update, delete on table public.subcontractor_rates to service_role;
grant select, insert, update, delete on table public.subcontractor_rate_versions to service_role;

drop policy if exists subcontractor_rates_select_member on public.subcontractor_rates;
create policy subcontractor_rates_select_member
  on public.subcontractor_rates
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = subcontractor_rates.org_id
        and m.status = 'active'
    )
  );

drop policy if exists subcontractor_rate_versions_select_member on public.subcontractor_rate_versions;
create policy subcontractor_rate_versions_select_member
  on public.subcontractor_rate_versions
  for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.organisation_memberships m
      where m.user_id = auth.uid()
        and m.org_id = subcontractor_rate_versions.org_id
        and m.status = 'active'
    )
  );

create or replace function public.save_subcontractor_rate_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_rate_id uuid;
  v_rate public.subcontractor_rates%rowtype;
  v_sub public.subcontractors%rowtype;
  v_response public.rfq_responses%rowtype;
  v_origin public.rfq_responses%rowtype;
  v_recipient public.rfq_recipients%rowtype;
  v_rfq public.rfqs%rowtype;
  v_doc public.subcontractor_documents%rowtype;
  v_previous public.subcontractor_rate_versions%rowtype;
  v_version integer := 1;
  v_version_id uuid;
  v_type text;
  v_scope text;
  v_unit text;
  v_cost numeric(12, 2);
  v_source text;
  v_from date;
  v_until date;
  v_origin_id uuid;
  v_origin_amount numeric(12, 2);
  v_informing uuid;
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  if coalesce(p_payload->>'confirm_scope', '') is distinct from 'true'
    or coalesce(p_payload->>'confirm_unit', '') is distinct from 'true'
    or coalesce(p_payload->>'confirm_amount', '') is distinct from 'true'
    or coalesce(p_payload->>'confirm_validity', '') is distinct from 'true'
  then
    return jsonb_build_object('ok', false, 'error', 'CONFIRM');
  end if;

  v_type := btrim(coalesce(p_payload->>'work_area_type', ''));
  v_scope := btrim(coalesce(p_payload->>'scope', ''));
  v_unit := btrim(coalesce(p_payload->>'unit', ''));
  v_source := btrim(coalesce(p_payload->>'source', ''));
  if v_type = '' or char_length(v_scope) < 1 or char_length(v_scope) > 500 then
    return jsonb_build_object('ok', false, 'error', 'SCOPE');
  end if;
  if v_unit not in ('lump_sum', 'm2', 'm', 'item', 'hour') then
    return jsonb_build_object('ok', false, 'error', 'UNIT');
  end if;
  if v_source not in ('builder', 'rfq_response', 'rate_schedule_document') then
    return jsonb_build_object('ok', false, 'error', 'SOURCE');
  end if;
  if p_payload->>'cost_ex_gst' is null or (p_payload->>'cost_ex_gst') !~ '^[0-9]+(\.[0-9]+)?$' then
    return jsonb_build_object('ok', false, 'error', 'AMOUNT');
  end if;
  v_cost := round((p_payload->>'cost_ex_gst')::numeric, 2);
  if v_cost < 0 or v_cost > 99999999.99 then
    return jsonb_build_object('ok', false, 'error', 'AMOUNT');
  end if;
  begin
    v_from := (p_payload->>'effective_from')::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'DATES');
  end;
  if nullif(p_payload->>'effective_until', '') is null then
    v_until := null;
  else
    begin
      v_until := (p_payload->>'effective_until')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'DATES');
    end;
  end if;
  if v_from is null or (v_until is not null and v_until < v_from) then
    return jsonb_build_object('ok', false, 'error', 'DATES');
  end if;

  if nullif(p_payload->>'rate_id', '') is null then
    if nullif(p_payload->>'subcontractor_id', '') is null then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    select * into v_sub from public.subcontractors
    where id = (p_payload->>'subcontractor_id')::uuid and org_id = v_org;
    if not found or v_sub.archived_at is not null then
      return jsonb_build_object('ok', false, 'error', 'ARCHIVED');
    end if;
    insert into public.subcontractor_rates (org_id, subcontractor_id, created_by)
    values (v_org, v_sub.id, auth.uid())
    returning * into v_rate;
  else
    select * into v_rate from public.subcontractor_rates
    where id = (p_payload->>'rate_id')::uuid and org_id = v_org
    for update;
    if not found or v_rate.retired_at is not null then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    select * into v_sub from public.subcontractors
    where id = v_rate.subcontractor_id and org_id = v_org;
    if not found or v_sub.archived_at is not null then
      return jsonb_build_object('ok', false, 'error', 'ARCHIVED');
    end if;
    select * into v_previous from public.subcontractor_rate_versions
    where rate_id = v_rate.id
    order by version_number asc
    limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    v_version := coalesce((
      select max(version_number) + 1 from public.subcontractor_rate_versions where rate_id = v_rate.id
    ), 1);
    v_origin_id := v_previous.origin_response_id;
    v_origin_amount := v_previous.source_amount_ex_gst;
  end if;

  if not (v_type = any(v_sub.work_area_types)) then
    return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
  end if;

  v_informing := null;
  if v_source = 'rfq_response' then
    if nullif(p_payload->>'response_id', '') is null then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    select * into v_response from public.rfq_responses
    where id = (p_payload->>'response_id')::uuid and org_id = v_org;
    if not found or v_response.status <> 'submitted' or v_response.price_ex_gst is null then
      return jsonb_build_object('ok', false, 'error', 'NOT_SUBMITTED');
    end if;
    select * into v_recipient from public.rfq_recipients
    where id = v_response.recipient_id and org_id = v_org;
    if not found or v_recipient.subcontractor_id <> v_sub.id then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
    select * into v_rfq from public.rfqs where id = v_recipient.rfq_id and org_id = v_org;
    if v_response.pricing_structure = 'lump_sum' and v_unit <> 'lump_sum' then
      return jsonb_build_object('ok', false, 'error', 'LUMP_SUM_UNIT');
    end if;
    if v_rfq.scope_kind = 'work_area' and v_rfq.work_area_type is not null and v_type is distinct from v_rfq.work_area_type then
      return jsonb_build_object('ok', false, 'error', 'WORK_AREA');
    end if;
    if v_version = 1 then
      v_origin_id := v_response.id;
      v_origin_amount := round(v_response.price_ex_gst, 2);
    end if;
    v_informing := v_response.id;
    if p_payload ? 'source_amount_ex_gst'
      and abs(coalesce((p_payload->>'source_amount_ex_gst')::numeric, -1) - v_origin_amount) > 0.001
    then
      return jsonb_build_object('ok', false, 'error', 'SOURCE_AMOUNT');
    end if;
  elsif v_version = 1 then
    v_origin_id := null;
    v_origin_amount := null;
  end if;

  if v_origin_id is not null then
    select * into v_origin from public.rfq_responses where id = v_origin_id and org_id = v_org;
    if v_origin.pricing_structure = 'lump_sum' and v_unit <> 'lump_sum' then
      return jsonb_build_object('ok', false, 'error', 'LUMP_SUM_UNIT');
    end if;
  end if;

  if v_source = 'rate_schedule_document' then
    if nullif(p_payload->>'source_document_id', '') is null then
      return jsonb_build_object('ok', false, 'error', 'SOURCE');
    end if;
    select * into v_doc from public.subcontractor_documents
    where id = (p_payload->>'source_document_id')::uuid and org_id = v_org;
    if not found or v_doc.subcontractor_id <> v_sub.id or v_doc.document_kind <> 'rate_schedule' or v_doc.archived_at is not null then
      return jsonb_build_object('ok', false, 'error', 'SOURCE');
    end if;
  end if;

  insert into public.subcontractor_rate_versions (
    org_id, rate_id, version_number, work_area_type, scope, unit, cost_ex_gst, currency,
    minimum_charge, quantity_band_min, quantity_band_max, inclusions, exclusions,
    effective_from, effective_until, source, source_document_id,
    origin_response_id, informing_response_id, source_amount_ex_gst,
    last_confirmed_on, internal_notes, created_by
  )
  values (
    v_org, v_rate.id, v_version, v_type, v_scope, v_unit, v_cost, 'NZD',
    nullif(p_payload->>'minimum_charge', '')::numeric,
    nullif(p_payload->>'quantity_band_min', '')::numeric,
    nullif(p_payload->>'quantity_band_max', '')::numeric,
    left(coalesce(p_payload->>'inclusions', ''), 4000),
    left(coalesce(p_payload->>'exclusions', ''), 4000),
    v_from, v_until, v_source,
    case when v_source = 'rate_schedule_document' then (p_payload->>'source_document_id')::uuid else null end,
    v_origin_id, v_informing, v_origin_amount,
    nullif(p_payload->>'last_confirmed_on', '')::date,
    left(coalesce(p_payload->>'internal_notes', ''), 2000),
    auth.uid()
  )
  returning id into v_version_id;

  update public.subcontractor_rates set updated_at = now() where id = v_rate.id;

  return jsonb_build_object(
    'ok', true,
    'rateId', v_rate.id,
    'versionId', v_version_id,
    'versionNumber', v_version
  );
end;
$$;

create or replace function public.retire_subcontractor_rate_v1(p_rate uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
begin
  if auth.uid() is null or v_org is null or not public.auth_can_mutate_work() then
    return jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  end if;
  update public.subcontractor_rates
  set retired_at = now(), updated_at = now()
  where id = p_rate and org_id = v_org and retired_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.save_subcontractor_rate_v1(jsonb) from public, anon;
revoke all on function public.retire_subcontractor_rate_v1(uuid) from public, anon;
grant execute on function public.save_subcontractor_rate_v1(jsonb) to authenticated;
grant execute on function public.retire_subcontractor_rate_v1(uuid) to authenticated;

comment on function public.save_subcontractor_rate_v1(jsonb) is
  'Inserts a rate version after the builder confirms scope, unit, amount, and validity. A lump-sum response cannot be stored as a measured unit. Does not write estimates or pricing.';
