-- Stage 2A remote baseline reconciliation (historical drift after 001–024).
-- Additive / idempotent. Do not apply remotely without explicit owner approval.
--
-- Verified remote drift (read-only linked inspection, 2026-08-04):
-- 1) project_notes.note_type check lacks 'calibration_note' (migration 019 incomplete remotely)
-- 2) note_proposals index named note_proposals_created_idx instead of
--    note_proposals_project_created_idx, with identical definition
--    (project_id, created_at DESC) — semantically equivalent to migration 009.
--
-- Safe on:
-- * clean local DB where 019 + 009 already correct (no-op / no duplicate indexes)
-- * remote DB with the two drifts above

-- ---------------------------------------------------------------------------
-- A. project_notes.note_type — ensure calibration_note is allowed (019)
-- Avoids a constraint-less window by adding the new check before dropping the old.
-- ---------------------------------------------------------------------------

do $$
declare
  current_def text;
  invalid_count bigint;
  target_values text[] := array[
    'general',
    'measurement',
    'access',
    'client_request',
    'existing_condition',
    'material_preference',
    'exclusion',
    'risk',
    'calibration_note',
    'other'
  ];
begin
  select pg_get_constraintdef(oid)
  into current_def
  from pg_constraint
  where conname = 'project_notes_note_type_check'
    and conrelid = 'public.project_notes'::regclass;

  -- Already reconciled (local after 019, or prior 027 apply)
  if current_def is not null and current_def like '%calibration_note%' then
    return;
  end if;

  select count(*)
  into invalid_count
  from public.project_notes
  where note_type is null
     or note_type <> all (target_values);

  if invalid_count > 0 then
    raise exception
      'Cannot reconcile project_notes_note_type_check: % row(s) have note_type outside the intended set',
      invalid_count;
  end if;

  -- Broadening allowed values: existing remote values remain valid.
  alter table public.project_notes
    add constraint project_notes_note_type_check_new
    check (
      note_type in (
        'general',
        'measurement',
        'access',
        'client_request',
        'existing_condition',
        'material_preference',
        'exclusion',
        'risk',
        'calibration_note',
        'other'
      )
    );

  if current_def is not null then
    alter table public.project_notes
      drop constraint project_notes_note_type_check;
  end if;

  alter table public.project_notes
    rename constraint project_notes_note_type_check_new
    to project_notes_note_type_check;
end $$;

-- ---------------------------------------------------------------------------
-- B. note_proposals created-at index — canonical name from migration 009
-- Remote: note_proposals_created_idx ON (project_id, created_at DESC)
-- Local:  note_proposals_project_created_idx ON (project_id, created_at DESC)
-- ---------------------------------------------------------------------------

do $$
declare
  canonical_exists boolean;
  alternate_exists boolean;
  alternate_def text;
  expected_fragment text := 'ON public.note_proposals USING btree (project_id, created_at DESC)';
begin
  select to_regclass('public.note_proposals_project_created_idx') is not null
  into canonical_exists;

  select to_regclass('public.note_proposals_created_idx') is not null
  into alternate_exists;

  if alternate_exists then
    select pg_get_indexdef(c.oid)
    into alternate_def
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'note_proposals_created_idx'
      and c.relkind = 'i';

    if alternate_def is null
       or position(expected_fragment in alternate_def) = 0
       or alternate_def ~* 'UNIQUE'
       or alternate_def ~* ' WHERE ' then
      raise exception
        'Refusing to reconcile note_proposals_created_idx: definition is not equivalent to migration 009 (% )',
        coalesce(alternate_def, '<missing>');
    end if;
  end if;

  if canonical_exists and alternate_exists then
    -- Duplicate equivalent indexes — keep canonical, drop alternate
    drop index public.note_proposals_created_idx;
    return;
  end if;

  if canonical_exists then
    -- Clean local / already reconciled
    return;
  end if;

  if alternate_exists then
    alter index public.note_proposals_created_idx
      rename to note_proposals_project_created_idx;
    return;
  end if;

  -- Neither present (unexpected) — create canonical definition from 009
  create index note_proposals_project_created_idx
    on public.note_proposals (project_id, created_at desc);
end $$;

notify pgrst, 'reload schema';
