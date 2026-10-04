-- Unified onboarding authority, phase 1.
-- Additive. Does not delete rows, rates, quotes, variations, or NZBN values.
-- Does not insert labour costs. Preview application only; do not run on Production.
--
-- Order is significant:
-- 1. Add nullable authority columns.
-- 2. Canonicalise grandfathered rates/review/completed rows.
-- 3. Backfill gst_registered from the canonical completed state.
-- 4. Backfill labour choices only from an existing positive company cost.
-- 5. Allow marketing consent source 'onboarding'.

alter table public.organisation_settings
  add column if not exists gst_registered boolean,
  add column if not exists carpenter_onboarding_choice text,
  add column if not exists labourer_onboarding_choice text;

alter table public.organisation_settings
  drop constraint if exists organisation_settings_carpenter_onboarding_choice_chk;

alter table public.organisation_settings
  add constraint organisation_settings_carpenter_onboarding_choice_chk
  check (
    carpenter_onboarding_choice is null
    or carpenter_onboarding_choice in ('company', 'quotr_benchmark')
  );

alter table public.organisation_settings
  drop constraint if exists organisation_settings_labourer_onboarding_choice_chk;

alter table public.organisation_settings
  add constraint organisation_settings_labourer_onboarding_choice_chk
  check (
    labourer_onboarding_choice is null
    or labourer_onboarding_choice in ('company', 'quotr_benchmark')
  );

comment on column public.organisation_settings.gst_registered is
  'Explicit GST registration choice. Null means unknown and must not re-gate a completed organisation. True requires a GST number or ABN. False stores default_gst_rate 0 and no GST number or ABN. NZBN is a separate identifier.';

comment on column public.organisation_settings.carpenter_onboarding_choice is
  'company = carpenter internal cost was supplied. quotr_benchmark = explicit benchmark answer with no invented cost. Null = unanswered.';

comment on column public.organisation_settings.labourer_onboarding_choice is
  'company = labourer internal cost was supplied. quotr_benchmark = explicit benchmark answer with no invented cost. Null = unanswered.';

-- Grandfathered access used rates, review, and completed. Make that pair canonical
-- so new writes of rates or review are no longer completion.
update public.organisation_settings
set
  onboarding_status = 'completed',
  onboarding_step = 'completed',
  onboarding_completed_at = coalesce(onboarding_completed_at, now())
where (
    onboarding_step in ('rates', 'review', 'completed')
    or onboarding_status = 'completed'
  )
  and (
    onboarding_status is distinct from 'completed'
    or onboarding_step is distinct from 'completed'
  );

-- True only from a stored NZ GST number (8-9 digits) or ABN (11 digits).
-- False only when the organisation is now canonically completed, the rate is 0,
-- and neither identifier is stored. NZBN is not read. Anything else stays null.
update public.organisation_settings
set gst_registered = case
  when regexp_replace(coalesce(gst_number, ''), '\D', '', 'g') ~ '^[0-9]{8,9}$'
    or regexp_replace(coalesce(abn, ''), '\D', '', 'g') ~ '^[0-9]{11}$'
    then true
  when onboarding_status = 'completed'
    and default_gst_rate = 0
    and nullif(btrim(coalesce(gst_number, '')), '') is null
    and nullif(btrim(coalesce(abn, '')), '') is null
    then false
  else null
end
where gst_registered is null;

-- Company answer only. Do not insert a rate and do not invent quotr_benchmark.
update public.organisation_settings as settings
set carpenter_onboarding_choice = 'company'
where settings.carpenter_onboarding_choice is null
  and exists (
    select 1
    from public.rates as rate
    where rate.org_id = settings.org_id
      and rate.rate_type = 'labour'
      and rate.item_key = 'labour.carpenter.hour'
      and rate.active is true
      and rate.cost_rate is not null
      and rate.cost_rate > 0
  );

update public.organisation_settings as settings
set labourer_onboarding_choice = 'company'
where settings.labourer_onboarding_choice is null
  and exists (
    select 1
    from public.rates as rate
    where rate.org_id = settings.org_id
      and rate.rate_type = 'labour'
      and rate.item_key = 'labour.labourer.hour'
      and rate.active is true
      and rate.cost_rate is not null
      and rate.cost_rate > 0
  );

alter table public.profiles
  drop constraint if exists profiles_marketing_consent_source_chk;

alter table public.profiles
  add constraint profiles_marketing_consent_source_chk
  check (
    marketing_consent_source is null
    or marketing_consent_source in ('signup', 'settings', 'onboarding')
  );

comment on column public.profiles.marketing_consent_source is
  'signup = account creation. settings = later profile change. onboarding = optional setup choice. Null = never explicitly recorded. Consent stays optional.';

create or replace function public.set_own_marketing_consent(
  p_consent boolean,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'CONSENT:NOT_AUTHENTICATED'
      using errcode = 'P0001';
  end if;

  if p_consent is null then
    raise exception 'CONSENT:INVALID'
      using errcode = 'P0001';
  end if;

  if p_source is distinct from 'signup'
     and p_source is distinct from 'settings'
     and p_source is distinct from 'onboarding' then
    raise exception 'CONSENT:INVALID_SOURCE'
      using errcode = 'P0001';
  end if;

  update public.profiles
    set marketing_consent = p_consent,
        marketing_consent_at = case when p_consent then now() else null end,
        marketing_consent_source = p_source,
        marketing_loops_sync_pending = true
  where id = v_uid;

  return found;
end;
$$;

comment on function public.set_own_marketing_consent(boolean, text) is
  'Sets marketing consent for auth.uid() only and marks the Loops preference sync pending. Source may be signup, settings, or onboarding. Opt-in writes marketing_consent_at. Opt-out clears it. Does not change role or org_id.';

notify pgrst, 'reload schema';
