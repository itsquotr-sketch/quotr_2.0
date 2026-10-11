-- 109 — owner decision 11 Oct 2026 for fence post-hole concrete placement.
-- Two people × two minutes per 20 kg bag = 0.06666666666666667 person-hours/bag.
-- Replaces the workbook conversion of 0.5 that migration 108 stored.
-- Updates the calibration-catalogue reference only.
-- Does not touch organisation rates, calibration responses, quotes,
-- variations, accepted snapshots, or issued commercial records.

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.06666666666666667
where productivity_rate_key = 'fence.post_hole_concrete.place.hours_per_bag'
  and benchmark_productivity is distinct from 0.06666666666666667;
