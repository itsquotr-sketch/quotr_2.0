-- Quotr 2.0 — Phase 6B-1 performance indexes

-- estimates: composite project/org lookup and stale filtering
create index if not exists estimates_project_org_idx
  on public.estimates (project_id, org_id);

create index if not exists estimates_org_stale_idx
  on public.estimates (org_id, is_stale);

-- note_proposals: org-scoped status filtering per project
create index if not exists note_proposals_project_org_status_idx
  on public.note_proposals (project_id, org_id, status);

notify pgrst, 'reload schema';
