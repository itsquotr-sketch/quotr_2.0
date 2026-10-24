-- Preview only. Do not apply to Production until the owner accepts it.
-- A retained project, calibration response, or rate application can keep its
-- row after the personal author is cleared. The foreign key stays
-- ON DELETE RESTRICT, so a remaining person pointer still blocks login
-- deletion. This does not cascade-delete business rows and does not drop
-- the foreign key.

alter table public.projects
  alter column created_by drop not null;

alter table public.calibration_responses
  alter column created_by drop not null;

alter table public.productivity_calibration_responses
  alter column created_by drop not null;

alter table public.subcontractor_rate_applications
  alter column applied_by drop not null;

comment on column public.projects.created_by is
  'Personal author. Null after that person is deleted and no continuing member takes the pointer. The project row stays.';
