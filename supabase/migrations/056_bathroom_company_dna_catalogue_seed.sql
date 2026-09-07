-- WA-BATHROOM-08B — data-only Bathroom Company DNA catalogue seed.
-- Additive INSERT of the six approved Bathroom calibration tasks.
-- No ALTER TABLE, no new tables, no column changes, no RLS, no GRANT, no RPC rewrite.
-- Does not UPDATE/DELETE Deck/Fence/RW catalogue rows, calibration responses, or organisation rates.
--
-- 055 remains reserved/deferred for QDISP-SQL-055 (same skip convention as missing 037).
--
-- Source of truth:
--   Code (`lib/company-dna/v2-foundation.ts` COMPANY_DNA_BATHROOM_TASKS) is canonical
--   for full task metadata. This migration seeds the persistable identity the
--   save_productivity_calibration RPC FK/SELECT requires.
-- ON CONFLICT DO NOTHING is idempotent and never mutates existing rows.

insert into public.productivity_calibration_catalogue (
  calibration_task_key,
  scenario_version,
  work_area_type,
  productivity_rate_key,
  label,
  prompt,
  scenario_summary,
  reference_quantity,
  reference_unit,
  authority_quantity,
  authority_unit,
  benchmark_productivity,
  rate_label,
  is_high_impact,
  sort_order
) values
  (
    'bathroom.lining.wall.v1',
    '1',
    'bathroom',
    'bathroom.lining.wall.install.hours_per_m2',
    'Bathroom wall lining',
    $dna$Think of a normal bathroom where your team installs about 20 m² of Aqualine wall lining.$dna$,
    $dna$20 m² Aqualine wall lining · measure, cut, fit, screw · normal bathroom · normal access$dna$,
    20,
    'm2',
    20,
    'm2',
    0.3,
    'Bathroom wall lining (hours/m²)',
    true,
    10
  ),
  (
    'bathroom.lining.ceiling.v1',
    '1',
    'bathroom',
    'bathroom.lining.ceiling.install.hours_per_m2',
    'Bathroom ceiling lining',
    $dna$Think of a normal bathroom where your team installs about 8 m² of Aqualine ceiling lining.$dna$,
    $dna$8 m² Aqualine ceiling lining · measure, cut, fit, screw · normal bathroom · normal access$dna$,
    8,
    'm2',
    8,
    'm2',
    0.4,
    'Bathroom ceiling lining (hours/m²)',
    true,
    20
  ),
  (
    'bathroom.framing.v1',
    '1',
    'bathroom',
    'bathroom.framing.install.hours_per_lm',
    'Bathroom local framing / nogging',
    $dna$Think of a normal bathroom where your team fits about 12 lm of local nogging and fixture supports.$dna$,
    $dna$12 lm local bathroom framing / nogging · fixture supports · not complete partition walls$dna$,
    12,
    'lm',
    12,
    'lm',
    0.2,
    'Bathroom local framing (hours/lm)',
    true,
    30
  ),
  (
    'bathroom.floor_substrate.v1',
    '1',
    'bathroom',
    'bathroom.floor_substrate.install.hours_per_m2',
    'Bathroom floor substrate',
    $dna$Think of a normal bathroom where your team lays about 8 m² of plywood or fibre-cement floor substrate.$dna$,
    $dna$8 m² floor substrate · measure, cut, fit, screw · normal bathroom · normal access$dna$,
    8,
    'm2',
    8,
    'm2',
    0.4,
    'Bathroom floor substrate (hours/m²)',
    false,
    40
  ),
  (
    'bathroom.demolition.floor.v1',
    '1',
    'bathroom',
    'bathroom.demolition.floor_finish.hours_per_m2',
    'Bathroom floor finish removal',
    $dna$Think of a normal bathroom where your team strips about 8 m² of existing floor finish.$dna$,
    $dna$8 m² existing bathroom floor finish · strip at the workface · normal access$dna$,
    8,
    'm2',
    8,
    'm2',
    0.25,
    'Bathroom floor finish removal (hours/m²)',
    false,
    50
  ),
  (
    'bathroom.demolition.wall.v1',
    '1',
    'bathroom',
    'bathroom.demolition.wall_lining.hours_per_m2',
    'Bathroom wall lining removal',
    $dna$Think of a normal bathroom where your team strips about 20 m² of existing wall lining.$dna$,
    $dna$20 m² existing wet-area wall lining · strip at the workface · normal access$dna$,
    20,
    'm2',
    20,
    'm2',
    0.2,
    'Bathroom wall lining removal (hours/m²)',
    false,
    60
  )
on conflict (calibration_task_key) do nothing;

-- Existing Deck / Fence / RW / V1 catalogue identity must remain unchanged.
do $$
declare
  v_bathroom integer;
  v_deck integer;
  v_fence integer;
  v_rw integer;
begin
  if (
    select count(*)
    from public.productivity_calibration_catalogue
    where calibration_task_key in (
      'deck.framing.v1',
      'deck.decking.v1',
      'deck.posts.v1',
      'deck.demolition.v1',
      'fence.posts.v1',
      'fence.boards.v1',
      'fence.rails.v1',
      'retaining_wall.piles.v1',
      'retaining_wall.face.v1'
    )
  ) is distinct from 9 then
    raise exception 'WA-BATHROOM-08B: V1 catalogue keys missing after Bathroom seed';
  end if;

  if (
    select row(
      authority_quantity,
      authority_unit,
      benchmark_productivity,
      productivity_rate_key
    )
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'deck.framing.v1'
  ) is distinct from row(80::numeric, 'lm'::text, 0.13::numeric, 'deck.substructure.install.hours_per_framing_lm'::text)
  then
    raise exception 'WA-BATHROOM-08B: V1 deck.framing.v1 mutated';
  end if;

  select count(*) into v_bathroom
  from public.productivity_calibration_catalogue
  where work_area_type = 'bathroom';
  if v_bathroom is distinct from 6 then
    raise exception 'WA-BATHROOM-08B: expected 6 Bathroom catalogue rows, found %', v_bathroom;
  end if;

  if (
    select count(*)
    from public.productivity_calibration_catalogue
    where calibration_task_key in (
      'bathroom.lining.wall.v1',
      'bathroom.lining.ceiling.v1',
      'bathroom.framing.v1',
      'bathroom.floor_substrate.v1',
      'bathroom.demolition.floor.v1',
      'bathroom.demolition.wall.v1'
    )
  ) is distinct from 6 then
    raise exception 'WA-BATHROOM-08B: approved Bathroom keys missing after seed';
  end if;

  if (
    select row(productivity_rate_key, authority_quantity, authority_unit, benchmark_productivity)
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'bathroom.lining.wall.v1'
  ) is distinct from row(
    'bathroom.lining.wall.install.hours_per_m2'::text,
    20::numeric,
    'm2'::text,
    0.3::numeric
  ) then
    raise exception 'WA-BATHROOM-08B: wall lining catalogue identity mismatch';
  end if;

  select count(*) into v_deck
  from public.productivity_calibration_catalogue
  where work_area_type = 'deck';
  select count(*) into v_fence
  from public.productivity_calibration_catalogue
  where work_area_type = 'fence';
  select count(*) into v_rw
  from public.productivity_calibration_catalogue
  where work_area_type = 'retaining_wall';

  if v_deck is distinct from 7 then
    raise exception 'WA-BATHROOM-08B: Deck catalogue count mutated (expected 7, found %)', v_deck;
  end if;
  if v_fence is distinct from 9 then
    raise exception 'WA-BATHROOM-08B: Fence catalogue count mutated (expected 9, found %)', v_fence;
  end if;
  if v_rw is distinct from 15 then
    raise exception 'WA-BATHROOM-08B: Retaining catalogue count mutated (expected 15, found %)', v_rw;
  end if;
end;
$$;
