-- Quotr 2.0 — pricing item calculation metadata

alter table public.pricing_items
  add column if not exists calculation_mode text
    check (
      calculation_mode is null
      or calculation_mode in ('quantity_rate', 'productivity_labour', 'lump_sum')
    ),
  add column if not exists productivity_rate numeric(12, 4),
  add column if not exists productivity_unit text,
  add column if not exists calculated_quantity numeric(12, 4);

notify pgrst, 'reload schema';
