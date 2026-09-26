-- PLATFORM-02B — additive lifecycle foundation.
-- Does not backfill stages or manufacture snapshots for existing quotes.
-- Does not change business_status, quote money, or quote item rows.
-- Preview/local only until an authorised migration is applied. Never Production from the app.

-- ---------------------------------------------------------------------------
-- A. Accepted commercial snapshot (one baseline per project and per quote)
-- ---------------------------------------------------------------------------

create table if not exists public.accepted_commercial_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  quote_id uuid not null references public.quotes (id) on delete cascade,
  revision_number integer not null,
  currency text not null,
  gst_rate numeric(5, 2) not null,
  tax_treatment text not null,
  direct_cost_total numeric(12, 2),
  sell_ex_gst numeric(12, 2) not null,
  gst_amount numeric(12, 2) not null,
  sell_incl_gst numeric(12, 2) not null,
  target_margin numeric(8, 4),
  effective_margin numeric(8, 4),
  accepted_at timestamptz not null,
  accepting_party_label text,
  acceptance_source text not null check (acceptance_source in ('client', 'manual')),
  inclusions jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  scope_summary text,
  created_at timestamptz not null default now(),
  constraint accepted_commercial_snapshots_revision_chk check (revision_number >= 1)
);

create unique index if not exists accepted_commercial_snapshots_project_uidx
  on public.accepted_commercial_snapshots (project_id);

create unique index if not exists accepted_commercial_snapshots_quote_uidx
  on public.accepted_commercial_snapshots (quote_id);

create index if not exists accepted_commercial_snapshots_org_idx
  on public.accepted_commercial_snapshots (org_id, accepted_at desc);

comment on table public.accepted_commercial_snapshots is
  'Immutable copy of one accepted quote revision. Not recalculated from rates or estimates. Events are not this baseline.';

create table if not exists public.accepted_commercial_snapshot_lines (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.accepted_commercial_snapshots (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  work_area_id uuid references public.work_areas (id) on delete set null,
  source_quote_item_id uuid references public.quote_items (id) on delete cascade,
  pricing_item_id uuid,
  estimate_line_item_id uuid,
  stable_item_key text,
  client_description text not null,
  quantity numeric(12, 2),
  unit text,
  unit_sell numeric(12, 2),
  line_sell_ex_gst numeric(12, 2) not null,
  line_gst numeric(12, 2),
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create index if not exists accepted_commercial_snapshot_lines_snapshot_idx
  on public.accepted_commercial_snapshot_lines (snapshot_id, sort_order);

create index if not exists accepted_commercial_snapshot_lines_org_idx
  on public.accepted_commercial_snapshot_lines (org_id, project_id);

comment on table public.accepted_commercial_snapshot_lines is
  'Line copy from the accepted quote items. line_gst stays null when the quote item does not store tax.';

-- ---------------------------------------------------------------------------
-- B. Explicit lifecycle position (no backfill) and append-only events
-- ---------------------------------------------------------------------------

create table if not exists public.project_lifecycle_positions (
  project_id uuid primary key references public.projects (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  stage text not null check (
    stage in (
      'draft',
      'pricing',
      'quote_draft',
      'quote_sent',
      'quote_accepted',
      'active_job',
      'completed',
      'cancelled'
    )
  ),
  accepted_snapshot_id uuid references public.accepted_commercial_snapshots (id),
  updated_at timestamptz not null default now()
);

create index if not exists project_lifecycle_positions_org_idx
  on public.project_lifecycle_positions (org_id, stage);

comment on table public.project_lifecycle_positions is
  'Explicit stage written only by a validated transition or quote acceptance. Absent row means project the existing business_status. Archived is not backfilled.';

create table if not exists public.project_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (
    event_type in (
      'estimate_ready',
      'pricing_confirmed',
      'quote_created',
      'quote_sent',
      'quote_accepted',
      'project_activated',
      'project_completed',
      'project_cancelled'
    )
  ),
  occurred_at timestamptz not null default now(),
  source_entity_type text not null,
  source_entity_id uuid not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint project_lifecycle_events_idempotency_uidx unique (org_id, idempotency_key)
);

create index if not exists project_lifecycle_events_project_idx
  on public.project_lifecycle_events (org_id, project_id, occurred_at desc);

comment on table public.project_lifecycle_events is
  'Append-only lifecycle ledger. Not the commercial source of truth.';

-- ---------------------------------------------------------------------------
-- C. Immutability. Service-role and local admin deletes remain for fixture cleanup.
-- ---------------------------------------------------------------------------

create or replace function public.lifecycle_foundation_block_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and (
    coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
  ) then
    return old;
  end if;
  raise exception 'lifecycle foundation record is immutable';
end;
$$;

drop trigger if exists accepted_commercial_snapshots_immutable
  on public.accepted_commercial_snapshots;
create trigger accepted_commercial_snapshots_immutable
  before update or delete on public.accepted_commercial_snapshots
  for each row
  execute function public.lifecycle_foundation_block_mutation();

drop trigger if exists accepted_commercial_snapshot_lines_immutable
  on public.accepted_commercial_snapshot_lines;
create trigger accepted_commercial_snapshot_lines_immutable
  before update or delete on public.accepted_commercial_snapshot_lines
  for each row
  execute function public.lifecycle_foundation_block_mutation();

drop trigger if exists project_lifecycle_events_immutable
  on public.project_lifecycle_events;
create trigger project_lifecycle_events_immutable
  before update or delete on public.project_lifecycle_events
  for each row
  execute function public.lifecycle_foundation_block_mutation();

-- ---------------------------------------------------------------------------
-- D. RLS. Authenticated users may read their organisation. Writes are definer-only.
-- ---------------------------------------------------------------------------

alter table public.accepted_commercial_snapshots enable row level security;
alter table public.accepted_commercial_snapshot_lines enable row level security;
alter table public.project_lifecycle_positions enable row level security;
alter table public.project_lifecycle_events enable row level security;

revoke all on table public.accepted_commercial_snapshots from public, anon, authenticated;
revoke all on table public.accepted_commercial_snapshot_lines from public, anon, authenticated;
revoke all on table public.project_lifecycle_positions from public, anon, authenticated;
revoke all on table public.project_lifecycle_events from public, anon, authenticated;

grant select on table public.accepted_commercial_snapshots to authenticated;
grant select on table public.accepted_commercial_snapshot_lines to authenticated;
grant select on table public.project_lifecycle_positions to authenticated;
grant select on table public.project_lifecycle_events to authenticated;

grant select, insert, update, delete on table public.accepted_commercial_snapshots to service_role;
grant select, insert, update, delete on table public.accepted_commercial_snapshot_lines to service_role;
grant select, insert, update, delete on table public.project_lifecycle_positions to service_role;
grant select, insert, update, delete on table public.project_lifecycle_events to service_role;

create policy "Users can select accepted commercial snapshots in their organisation"
  on public.accepted_commercial_snapshots for select
  using (org_id = public.auth_org_id());

create policy "Users can select accepted commercial snapshot lines in their organisation"
  on public.accepted_commercial_snapshot_lines for select
  using (org_id = public.auth_org_id());

create policy "Users can select project lifecycle positions in their organisation"
  on public.project_lifecycle_positions for select
  using (org_id = public.auth_org_id());

create policy "Users can select project lifecycle events in their organisation"
  on public.project_lifecycle_events for select
  using (org_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- E. Capture the snapshot from the quote row when it first becomes accepted.
-- ---------------------------------------------------------------------------

create or replace function public.capture_accepted_commercial_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_other uuid;
  v_currency text;
  v_source text;
  v_party text;
  v_actor uuid;
  v_accepted_at timestamptz;
  v_snapshot uuid;
  v_item record;
begin
  if tg_op is distinct from 'UPDATE' then
    return new;
  end if;
  if new.status is distinct from 'accepted' or old.status = 'accepted' then
    return new;
  end if;
  if new.revision_number is null then
    raise exception 'QUOTE_VERSION_REQUIRED';
  end if;
  if old.status = 'superseded' or old.superseded_by_quote_id is not null then
    raise exception 'STALE_QUOTE_VERSION';
  end if;

  select id into v_existing
  from public.accepted_commercial_snapshots
  where quote_id = new.id;

  if v_existing is not null then
    return new;
  end if;

  select id into v_other
  from public.accepted_commercial_snapshots
  where project_id = new.project_id
    and quote_id is distinct from new.id
  limit 1;

  if v_other is not null then
    raise exception 'ACCEPTED_BASELINE_EXISTS';
  end if;

  if new.subtotal is null or new.gst_amount is null or new.total_incl_gst is null or new.gst_rate is null then
    raise exception 'MISSING_MONEY';
  end if;

  -- Currency is the organisation setting. The schema default NZD applies only
  -- when that row was never created. Client input is not read.
  select s.currency into v_currency
  from public.organisation_settings s
  where s.org_id = new.org_id;

  if v_currency is null or length(btrim(v_currency)) = 0 then
    v_currency := 'NZD';
  end if;

  select a.source, a.signer_name, a.actor_user_id, a.accepted_at
  into v_source, v_party, v_actor, v_accepted_at
  from public.quote_acceptances a
  where a.quote_id = new.id
    and a.org_id = new.org_id
    and a.project_id = new.project_id
  limit 1;

  if v_source is null or v_source not in ('client', 'manual') then
    v_source := 'manual';
  end if;

  insert into public.accepted_commercial_snapshots (
    org_id, project_id, quote_id, revision_number, currency, gst_rate,
    tax_treatment, direct_cost_total, sell_ex_gst, gst_amount, sell_incl_gst,
    target_margin, effective_margin, accepted_at, accepting_party_label,
    acceptance_source, inclusions, exclusions, scope_summary
  ) values (
    new.org_id, new.project_id, new.id, new.revision_number, v_currency, new.gst_rate,
    'exclusive', null, new.subtotal, new.gst_amount, new.total_incl_gst,
    null, null, coalesce(v_accepted_at, new.accepted_at, now()),
    nullif(btrim(coalesce(v_party, '')), ''),
    v_source, coalesce(new.inclusions, '[]'::jsonb), coalesce(new.exclusions, '[]'::jsonb),
    new.scope_summary
  )
  returning id into v_snapshot;

  for v_item in
    select *
    from public.quote_items
    where quote_id = new.id
      and org_id = new.org_id
      and project_id = new.project_id
    order by sort_order
  loop
    if v_item.total is null then
      raise exception 'MISSING_MONEY';
    end if;
    insert into public.accepted_commercial_snapshot_lines (
      snapshot_id, org_id, project_id, work_area_id, source_quote_item_id,
      pricing_item_id, client_description, quantity, unit, unit_sell,
      line_sell_ex_gst, line_gst, sort_order
    ) values (
      v_snapshot, new.org_id, new.project_id, v_item.work_area_id, v_item.id,
      v_item.pricing_item_id,
      coalesce(nullif(btrim(coalesce(v_item.description, '')), ''), v_item.label),
      v_item.quantity, v_item.unit, v_item.unit_price,
      v_item.total, null, v_item.sort_order
    );
  end loop;

  insert into public.project_lifecycle_events (
    org_id, project_id, actor_user_id, event_type, occurred_at,
    source_entity_type, source_entity_id, idempotency_key, metadata, schema_version
  ) values (
    new.org_id, new.project_id, v_actor, 'quote_accepted',
    coalesce(v_accepted_at, new.accepted_at, now()),
    'quote', new.id, 'quote_accepted:' || new.id::text,
    jsonb_build_object(
      'quoteId', new.id,
      'revisionNumber', new.revision_number
    ),
    1
  )
  on conflict (org_id, idempotency_key) do nothing;

  insert into public.project_lifecycle_positions (
    project_id, org_id, stage, accepted_snapshot_id
  ) values (
    new.project_id, new.org_id, 'quote_accepted', v_snapshot
  )
  on conflict (project_id) do update
  set
    accepted_snapshot_id = excluded.accepted_snapshot_id,
    stage = case
      when public.project_lifecycle_positions.stage in ('active_job', 'completed', 'cancelled')
        then public.project_lifecycle_positions.stage
      else 'quote_accepted'
    end,
    updated_at = now()
  where public.project_lifecycle_positions.org_id = excluded.org_id;

  return new;
end;
$$;

drop trigger if exists quotes_capture_accepted_commercial_snapshot on public.quotes;
create trigger quotes_capture_accepted_commercial_snapshot
  after update of status on public.quotes
  for each row
  execute function public.capture_accepted_commercial_snapshot();

revoke all on function public.capture_accepted_commercial_snapshot()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- F. Validated transitions. Organisation comes from the session, not the client.
-- ---------------------------------------------------------------------------

create or replace function public.project_lifecycle_projected_stage(p_project uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.auth_org_id();
  v_stage text;
  v_business text;
begin
  if v_org is null or p_project is null then
    return null;
  end if;

  select stage into v_stage
  from public.project_lifecycle_positions
  where project_id = p_project
    and org_id = v_org;

  if v_stage is not null then
    return v_stage;
  end if;

  select business_status into v_business
  from public.projects
  where id = p_project
    and org_id = v_org
    and deleted_at is null;

  if not found then
    return null;
  end if;

  return case v_business
    when 'lost' then 'cancelled'
    when 'won' then 'quote_accepted'
    when 'quote_sent' then 'quote_sent'
    when 'quote_draft' then 'quote_draft'
    when 'estimate_ready' then 'pricing'
    when 'lead' then 'draft'
    when 'site_visit' then 'draft'
    when 'scoping' then 'draft'
    when 'estimating' then 'draft'
    else null
  end;
end;
$$;

create or replace function public.apply_project_lifecycle_transition(
  p_project uuid,
  p_target text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.auth_org_id();
  v_from text;
  v_allowed boolean := false;
  v_event text;
  v_snapshot uuid;
  v_quote uuid;
  v_revision integer;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  end if;

  if not exists (
    select 1
    from public.projects
    where id = p_project
      and org_id = v_org
      and deleted_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;

  v_from := public.project_lifecycle_projected_stage(p_project);
  if v_from is null then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  if v_from = p_target then
    return jsonb_build_object('ok', true, 'idempotent', true, 'stage', v_from);
  end if;

  v_allowed := case
    when v_from = 'draft' and p_target in ('pricing', 'cancelled') then true
    when v_from = 'pricing' and p_target in ('quote_draft', 'cancelled') then true
    when v_from = 'quote_draft' and p_target in ('quote_sent', 'cancelled') then true
    when v_from = 'quote_sent' and p_target in ('quote_accepted', 'cancelled') then true
    when v_from = 'quote_accepted' and p_target in ('active_job', 'cancelled') then true
    when v_from = 'active_job' and p_target in ('completed', 'cancelled') then true
    else false
  end;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  select id, quote_id, revision_number
  into v_snapshot, v_quote, v_revision
  from public.accepted_commercial_snapshots
  where project_id = p_project
    and org_id = v_org;

  if p_target in ('quote_accepted', 'active_job', 'completed')
    and (v_snapshot is null or v_quote is null or v_revision is null) then
    return jsonb_build_object('ok', false, 'error', 'QUOTE_VERSION_REQUIRED');
  end if;

  v_event := case p_target
    when 'pricing' then 'estimate_ready'
    when 'quote_draft' then 'pricing_confirmed'
    when 'quote_sent' then 'quote_sent'
    when 'quote_accepted' then 'quote_accepted'
    when 'active_job' then 'project_activated'
    when 'completed' then 'project_completed'
    when 'cancelled' then 'project_cancelled'
    else null
  end;

  if v_event is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION');
  end if;

  insert into public.project_lifecycle_positions (
    project_id, org_id, stage, accepted_snapshot_id
  ) values (
    p_project, v_org, p_target, v_snapshot
  )
  on conflict (project_id) do update
  set
    stage = excluded.stage,
    accepted_snapshot_id = coalesce(excluded.accepted_snapshot_id, public.project_lifecycle_positions.accepted_snapshot_id),
    updated_at = now()
  where public.project_lifecycle_positions.org_id = excluded.org_id;

  insert into public.project_lifecycle_events (
    org_id, project_id, actor_user_id, event_type, occurred_at,
    source_entity_type, source_entity_id, idempotency_key, metadata, schema_version
  ) values (
    v_org, p_project, v_uid, v_event, now(),
    'project', p_project, v_event || ':' || p_project::text,
    jsonb_build_object('stage', p_target),
    1
  )
  on conflict (org_id, idempotency_key) do nothing;

  return jsonb_build_object('ok', true, 'idempotent', false, 'stage', p_target);
end;
$$;

revoke all on function public.project_lifecycle_projected_stage(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_project_lifecycle_transition(uuid, text)
  from public, anon, service_role;
grant execute on function public.apply_project_lifecycle_transition(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
