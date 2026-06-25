-- Company-level material wastage defaults for future quantity build-ups.

alter table organisation_settings
  add column if not exists default_material_wastage_percent numeric(5,2) not null default 10,
  add column if not exists decking_wastage_percent numeric(5,2) null,
  add column if not exists sheet_material_wastage_percent numeric(5,2) null,
  add column if not exists flooring_wastage_percent numeric(5,2) null,
  add column if not exists paint_wastage_percent numeric(5,2) null,
  add column if not exists timber_framing_wastage_percent numeric(5,2) null;
