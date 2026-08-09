-- Stage 3.1B.7F-R2.2 — ACL hardening for user-authored work-area scope items.
-- Additive privilege-only. No table/data rewrite. No RLS policy changes.
--
-- Context: migration 026 default privileges grant SELECT/INSERT/UPDATE/DELETE on
-- new tables to authenticated. Migration 030 granted intended DML but did not
-- revoke the inherited extras (028 did for discovery tables). This migration
-- aligns grants with actual application operations:
--   items:     SELECT, INSERT (definition rows; decisions model include/exclude)
--   decisions: SELECT, INSERT (append-only)
--
-- RLS remains enabled; policies from 030 are unchanged.

-- ---------------------------------------------------------------------------
-- A. Revoke inherited / overly broad privileges
-- ---------------------------------------------------------------------------

revoke all on public.work_area_scope_items from anon, authenticated, service_role;
revoke all on public.work_area_scope_item_decisions from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Authenticated — least privilege for current server actions
-- ---------------------------------------------------------------------------
-- lib/work-areas/scope-items/actions.ts + lib/pricing/actions.ts only
-- SELECT / INSERT. No UPDATE or DELETE paths exist today.

grant select, insert on public.work_area_scope_items to authenticated;
grant select, insert on public.work_area_scope_item_decisions to authenticated;

-- ---------------------------------------------------------------------------
-- C. service_role — administrative DML (parity with 028; not GRANT ALL)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.work_area_scope_items to service_role;
grant select, insert, update, delete on public.work_area_scope_item_decisions to service_role;

-- anon: intentionally no DML grants.

notify pgrst, 'reload schema';
