-- Quotr 2.0 — Phase 6I internal calibration note type (excluded from AI analysis)

alter table public.project_notes
  drop constraint if exists project_notes_note_type_check;

alter table public.project_notes
  add constraint project_notes_note_type_check
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
