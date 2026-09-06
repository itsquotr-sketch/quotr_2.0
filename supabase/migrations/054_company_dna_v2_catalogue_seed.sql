-- DNA-V2B.1 — data-only Company DNA V2 calibration catalogue seed.
-- Additive INSERT of approved V2B foundation keys.
-- No ALTER TABLE, no new tables, no column changes, no RLS, no RPC rewrite.
-- Does not UPDATE/DELETE V1 catalogue rows, calibration responses, or organisation rates.
--
-- Source of truth:
--   Code (`lib/company-dna/v2-foundation.ts`) is canonical for full task metadata
--   including V2-only fields (tier, include/exclude, exposeInCurrentUi).
--   This migration seeds the persistable identity the RPC FK requires:
--   key, productivity_rate_key, quantities, units, benchmark, prompt/summary.
--   Benchmarks and units must match the foundation + estimator catalogues.
-- ON CONFLICT DO NOTHING is idempotent and never mutates existing V1 semantics.

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
    'deck.fascia.v1',
    '1',
    'deck',
    'deck.fascia.install.hours_per_lm',
    'Fascia / edge boards',
    $dna$How would your crew normally fix about 18 lm of fascia / edge boards on a normal deck?$dna$,
    $dna$18 lm fascia · one course · ground-level / low · normal access · framing already in$dna$,
    18,
    'lm',
    18,
    'lm',
    0.45,
    'Fascia installation (hours/lm)',
    false,
    50
  ),
  (
    'deck.skirting.v1',
    '1',
    'deck',
    'deck.skirting.install.hours_per_lm',
    'Full-height deck skirting',
    $dna$How would your crew normally fit about 18 lm of full-height deck skirting / screening?$dna$,
    $dna$18 lm full-height skirting · explicit screening scope · normal access$dna$,
    18,
    'lm',
    18,
    'lm',
    0.45,
    'Full-height deck skirting / screening (labour-h / lm)',
    false,
    60
  ),
  (
    'deck.concrete.v1',
    '1',
    'deck',
    'deck.post_hole_concrete.place.hours_per_bag',
    'Deck post-hole concrete',
    $dna$How would your crew normally mix and pour 20 bags of post-hole concrete (posts already set)?$dna$,
    $dna$20 × 20 kg bags · posts already set · mix and place at the workface · normal access$dna$,
    20,
    'bag',
    20,
    'bag',
    0.16,
    'Deck post-hole concrete placement (labour-h/bag)',
    false,
    70
  ),
  (
    'fence.boards.horizontal.v1',
    '1',
    'fence',
    'fence.board.horizontal.hours_per_lm',
    'Horizontal fence slats',
    $dna$How would your crew normally hang horizontal slats on 18 lm of 1.8 m timber fence (posts already in)?$dna$,
    $dna$18 lm · 1.8 m · ~11 courses · 198 slat-lm · 150 mm boards · 10 mm gaps · normal access$dna$,
    18,
    'lm',
    198,
    'lm',
    0.06,
    'Horizontal slat installation (labour-h/slat-lm)',
    false,
    40
  ),
  (
    'fence.capping.v1',
    '1',
    'fence',
    'fence.capping.hours_per_lm',
    'Fence capping',
    $dna$How would your crew normally fit 18 lm of fence capping?$dna$,
    $dna$18 lm capping · 1.8 m paling · posts and palings already in · normal access$dna$,
    18,
    'lm',
    18,
    'lm',
    0.08,
    'Fence capping installation (labour-h/lm)',
    false,
    50
  ),
  (
    'fence.gate.v1',
    '1',
    'fence',
    'fence.gate.install.hours_per_gate',
    'Timber gate',
    $dna$How would your crew normally build and hang one timber fence gate (frame, hinges and latch)?$dna$,
    $dna$1 timber gate · frame assembly, hang, hinges/latch · normal access · palings stay on paling labour$dna$,
    1,
    'gate',
    1,
    'gate',
    2,
    'Timber gate fabrication & installation (labour-h/gate)',
    false,
    60
  ),
  (
    'fence.concrete.v1',
    '1',
    'fence',
    'fence.post_hole_concrete.place.hours_per_bag',
    'Fence post-hole concrete',
    $dna$How would your crew normally mix and pour 20 bags of fence post-hole concrete (posts already set)?$dna$,
    $dna$20 × 20 kg bags · posts already set · mix and place at the workface · normal access$dna$,
    20,
    'bag',
    20,
    'bag',
    0.06,
    'Fence post-hole concrete placement (labour-h/bag)',
    false,
    70
  ),
  (
    'fence.section.v1',
    '1',
    'fence',
    'fence.section.install.hours_per_section',
    'Modular fence sections',
    $dna$How would your crew normally hang 8 modular fence sections (posts already in)?$dna$,
    $dna$8 installed sections · manufactured bays · posts already in · normal access$dna$,
    8,
    'section',
    8,
    'section',
    0.35,
    'Modular fence section installation (labour-h/section)',
    false,
    80
  ),
  (
    'fence.demolition.v1',
    '1',
    'fence',
    'fence.demolition_hours_per_lm',
    'Existing fence removal',
    $dna$How would your crew normally take down 18 lm of existing timber fence (strip the fence — not loading a bin off site)?$dna$,
    $dna$18 lm strip-out · normal access · demolition labour only · disposal / cartage is separate money$dna$,
    18,
    'lm',
    18,
    'lm',
    0.25,
    'Fence removal labour',
    false,
    90
  ),
  (
    'retaining_wall.excavation.machine.v1',
    '1',
    'retaining_wall',
    'retaining_wall.excavation.machine.hours_per_m3',
    'Machine excavation',
    $dna$How would your crew normally excavate 4 m³ for a retaining wall with a mini-digger on a normal accessible site (your labour — not the hire clock)?$dna$,
    $dna$4 m³ measured bulk cut · machine-assisted · digger can reach · crew attendance · normal soil$dna$,
    4,
    'm3',
    4,
    'm3',
    0.45,
    'Retaining wall excavation — machine-assisted (labour-h/m³)',
    true,
    30
  ),
  (
    'retaining_wall.excavation.manual.v1',
    '1',
    'retaining_wall',
    'retaining_wall.excavation.manual.hours_per_m3',
    'Manual excavation',
    $dna$How would your crew normally hand-dig 4 m³ for a retaining wall when a digger cannot reach the workface?$dna$,
    $dna$4 m³ measured bulk cut · no digger access · hand digging / barrow · normal soil$dna$,
    4,
    'm3',
    4,
    'm3',
    1.6,
    'Retaining wall excavation — manual (labour-h/m³)',
    false,
    40
  ),
  (
    'retaining_wall.drainage.v1',
    '1',
    'retaining_wall',
    'retaining_wall.drainage.install.hours_per_lm',
    'Drainage coil',
    $dna$How would your crew normally lay 10 lm of drainage coil behind a retaining wall (piles already in)?$dna$,
    $dna$10 lm novacoil · piles/posts in · ordinary joining and positioning · normal access$dna$,
    10,
    'lm',
    10,
    'lm',
    0.15,
    'Drainage installation (hours/lm)',
    false,
    50
  ),
  (
    'retaining_wall.backfill.v1',
    '1',
    'retaining_wall',
    'retaining_wall.backfill.hours_per_m3',
    'Drainage backfill',
    $dna$How would your crew normally place 2 m³ of drainage metal behind a retaining wall?$dna$,
    $dna$2 m³ drainage aggregate in place · shovel/barrow · no plate-compactor day · normal access$dna$,
    2,
    'm3',
    2,
    'm3',
    0.55,
    'Retaining wall backfill (hours/m³)',
    false,
    60
  ),
  (
    'retaining_wall.concrete.v1',
    '1',
    'retaining_wall',
    'retaining_wall.post_hole_concrete.place.hours_per_bag',
    'Retaining post-hole concrete',
    $dna$How would your crew normally mix and pour 20 bags of retaining-wall post-hole concrete (piles already set)?$dna$,
    $dna$20 × 20 kg bags · piles/posts already set · mix and place · normal access$dna$,
    20,
    'bag',
    20,
    'bag',
    0.035,
    'Retaining wall — post-hole bagged concrete placement',
    false,
    70
  ),
  (
    'retaining_wall.sleeper.posts.v1',
    '1',
    'retaining_wall',
    'retaining_wall.sleeper.posts.install.hours_per_ea',
    'Steel sleeper posts',
    $dna$How would your crew normally set 8 steel sleeper posts on a normal accessible site (digger on site — your attendance, not the hire clock)?$dna$,
    $dna$8 H-section posts · machine-assisted holes · normal access · not pouring concrete$dna$,
    8,
    'ea',
    8,
    'ea',
    0.95,
    'Steel post installation (hours/ea)',
    true,
    80
  ),
  (
    'retaining_wall.sleeper.sleepers.v1',
    '1',
    'retaining_wall',
    'retaining_wall.sleeper.sleepers.install.hours_per_ea',
    'Concrete sleepers',
    $dna$How would your crew normally set 20 concrete sleepers once the steel posts are in?$dna$,
    $dna$20 sleepers · posts already in · lift, slot, pack/level · normal access$dna$,
    20,
    'ea',
    20,
    'ea',
    0.22,
    'Concrete sleeper installation (hours/ea)',
    true,
    90
  ),
  (
    'retaining_wall.masonry.subbase.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.subbase.compact.hours_per_m2',
    'Masonry sub-base',
    $dna$How would your crew normally place and compact 8 m² of masonry footing sub-base?$dna$,
    $dna$8 m² footing-base area · hand place/compact · prepared trench · normal access$dna$,
    8,
    'm2',
    8,
    'm2',
    0.15,
    'Masonry sub-base compaction (hours/m²)',
    false,
    100
  ),
  (
    'retaining_wall.masonry.footing.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.footing.concrete.hours_per_m3',
    'Masonry footing pour',
    $dna$How would your crew normally place 1 m³ of masonry strip-footing concrete?$dna$,
    $dna$1 m³ ready-mix footing · place, level, basic consolidate · normal access$dna$,
    1,
    'm3',
    1,
    'm3',
    1.2,
    'Masonry footing concrete (hours/m³)',
    false,
    110
  ),
  (
    'retaining_wall.masonry.rebar.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.rebar.install.hours_per_lm',
    'Masonry rebar',
    $dna$How would your crew normally place 20 lm of stated masonry reinforcement?$dna$,
    $dna$20 lm stated horizontal runs · no invented bar schedule · normal access$dna$,
    20,
    'lm',
    20,
    'lm',
    0.08,
    'Masonry rebar installation (hours/lm)',
    false,
    120
  ),
  (
    'retaining_wall.masonry.block.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.block_lay.hours_per_m2',
    'Masonry block laying',
    $dna$How would your crew normally lay 10 m² of masonry retaining blocks (self-perform, not a subcontractor)?$dna$,
    $dna$10 m² face · standard hollow blocks · self-perform · normal access$dna$,
    10,
    'm2',
    10,
    'm2',
    1.8,
    'Masonry block laying (hours/m²)',
    true,
    130
  ),
  (
    'retaining_wall.masonry.core_fill.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.core_fill.hours_per_m3',
    'Masonry core fill',
    $dna$How would your crew normally place 1 m³ of masonry core fill / grout?$dna$,
    $dna$1 m³ core fill · blocks already laid · basic consolidation · normal access$dna$,
    1,
    'm3',
    1,
    'm3',
    0.85,
    'Masonry core fill (hours/m³)',
    false,
    140
  ),
  (
    'retaining_wall.masonry.waterproof.v1',
    '1',
    'retaining_wall',
    'retaining_wall.masonry.waterproofing.hours_per_m2',
    'Masonry waterproofing',
    $dna$How would your crew normally waterproof 10 m² of retaining-side masonry (self-perform)?$dna$,
    $dna$10 m² retaining-side membrane · self-perform · not a subcontract · normal access$dna$,
    10,
    'm2',
    10,
    'm2',
    0.28,
    'Masonry waterproofing (hours/m²)',
    false,
    150
  )
on conflict (calibration_task_key) do nothing;

-- Historical V1 catalogue identity must remain unchanged by this seed.
do $$
declare
  v_count integer;
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
    raise exception 'DNA-V2B.1: V1 catalogue keys missing after seed';
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
    raise exception 'DNA-V2B.1: V1 deck.framing.v1 mutated';
  end if;

  if (
    select row(authority_quantity, authority_unit, benchmark_productivity)
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'deck.decking.v1'
  ) is distinct from row(142.8571::numeric, 'lm'::text, 0.077::numeric)
  then
    raise exception 'DNA-V2B.1: V1 deck.decking.v1 mutated';
  end if;

  if (
    select row(authority_quantity, authority_unit, benchmark_productivity)
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'deck.posts.v1'
  ) is distinct from row(9::numeric, 'ea'::text, 0.2::numeric)
  then
    raise exception 'DNA-V2B.1: V1 deck.posts.v1 mutated';
  end if;

  if (
    select row(authority_quantity, authority_unit, benchmark_productivity)
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'fence.posts.v1'
  ) is distinct from row(13::numeric, 'post'::text, 0.7::numeric)
  then
    raise exception 'DNA-V2B.1: V1 fence.posts.v1 mutated';
  end if;

  if exists (
    select 1
    from public.productivity_calibration_catalogue
    where calibration_task_key = 'deck.steps.v1'
       or productivity_rate_key = 'deck.steps.install.hours_per_m2'
  ) then
    raise exception 'DNA-V2B.1: deferred Deck steps must not be seeded';
  end if;

  select count(*) into v_count
  from public.productivity_calibration_catalogue
  where calibration_task_key like 'retaining_wall.piles%';
  if v_count is distinct from 1 then
    raise exception 'DNA-V2B.1: RW pile catalogue must stay a single V1 key';
  end if;
end
$$;
