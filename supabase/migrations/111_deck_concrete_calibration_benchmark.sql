-- 111 — align the Deck post-hole concrete calibration comparison
-- with the approved placement rate: 1 person for 4 minutes per bag
-- = 0.06666666666666667 person-hours/bag.
-- Replaces the historical 0.16 h/bag starter stored for deck.concrete.v1.
-- Updates the calibration-catalogue reference only.
-- Does not touch organisation rates, calibration responses, quotes,
-- variations, accepted snapshots, or issued commercial records.

update public.productivity_calibration_catalogue
set benchmark_productivity = 0.06666666666666667
where calibration_task_key = 'deck.concrete.v1'
  and benchmark_productivity is distinct from 0.06666666666666667;
