-- 108 — approved workbook person-hour reference on the calibration catalogue.
-- Updates benchmark_productivity only where the seeded reference differs.
-- Does not touch organisation rates, calibration responses, quotes,
-- variations, accepted snapshots, or issued commercial records.
-- Does not insert new tasks and does not rewrite migrations 054 or 056.

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.08333333333333333
where productivity_rate_key = 'bathroom.demolition.wall_lining.hours_per_m2'
  and benchmark_productivity is distinct from 0.08333333333333333;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.9166666666666666
where productivity_rate_key = 'bathroom.floor_substrate.install.hours_per_m2'
  and benchmark_productivity is distinct from 0.9166666666666666;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.11666666666666667
where productivity_rate_key = 'bathroom.framing.install.hours_per_lm'
  and benchmark_productivity is distinct from 0.11666666666666667;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.25
where productivity_rate_key = 'bathroom.lining.ceiling.install.hours_per_m2'
  and benchmark_productivity is distinct from 0.25;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.1
where productivity_rate_key = 'deck.fascia.install.hours_per_lm'
  and benchmark_productivity is distinct from 0.1;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.06666666666666667
where productivity_rate_key = 'deck.post_hole_concrete.place.hours_per_bag'
  and benchmark_productivity is distinct from 0.06666666666666667;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.13333333333333333
where productivity_rate_key = 'deck.skirting.install.hours_per_lm'
  and benchmark_productivity is distinct from 0.13333333333333333;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.05
where productivity_rate_key = 'fence.board.horizontal.hours_per_lm'
  and benchmark_productivity is distinct from 0.05;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.125
where productivity_rate_key = 'fence.capping.hours_per_lm'
  and benchmark_productivity is distinct from 0.125;

update public.productivity_calibration_catalogue
set benchmark_productivity = 3.5
where productivity_rate_key = 'fence.gate.install.hours_per_gate'
  and benchmark_productivity is distinct from 3.5;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.5
where productivity_rate_key = 'fence.post_hole_concrete.place.hours_per_bag'
  and benchmark_productivity is distinct from 0.5;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.5
where productivity_rate_key = 'fence.section.install.hours_per_section'
  and benchmark_productivity is distinct from 0.5;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.5
where productivity_rate_key = 'retaining_wall.backfill.hours_per_m3'
  and benchmark_productivity is distinct from 0.5;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.4166666666666667
where productivity_rate_key = 'retaining_wall.excavation.machine.hours_per_m3'
  and benchmark_productivity is distinct from 0.4166666666666667;

update public.productivity_calibration_catalogue
set benchmark_productivity = 4
where productivity_rate_key = 'retaining_wall.excavation.manual.hours_per_m3'
  and benchmark_productivity is distinct from 4;

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.1
where productivity_rate_key = 'retaining_wall.post_hole_concrete.place.hours_per_bag'
  and benchmark_productivity is distinct from 0.1;
