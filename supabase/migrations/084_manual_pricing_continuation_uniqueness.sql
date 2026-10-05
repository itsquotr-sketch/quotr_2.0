-- One manual continuation cannot create two work areas or two Pricing lines.
-- Different custom scopes stay distinct. Issued Quotes are not updated.
-- Additive indexes only. No backfill and no rewrite of existing rows.

create unique index if not exists work_areas_manual_scope_uidx
  on public.work_areas (org_id, project_id, type, name, quote_description)
  where type = 'custom'
    and status = 'confirmed'
    and quote_description is not null;

comment on index public.work_areas_manual_scope_uidx is
  'One confirmed custom area per project for the same name and scope. A different scope is a different area.';

create unique index if not exists pricing_documents_open_manual_uidx
  on public.pricing_documents (org_id, project_id)
  where estimate_id is null
    and status in ('draft', 'reviewed');

comment on index public.pricing_documents_open_manual_uidx is
  'One open manual Pricing document per project. A document converted to a Quote is not in this index.';

create unique index if not exists pricing_items_manual_work_area_uidx
  on public.pricing_items (pricing_document_id, work_area_id)
  where notes_internal like '%__quotr_manual_work_area_line__%';

comment on index public.pricing_items_manual_work_area_uidx is
  'One manual work-area Pricing line per document. User scope-item stubs do not carry this marker.';
