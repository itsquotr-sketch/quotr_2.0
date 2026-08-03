-- Stage 2A Batch 2A.5: restore PostgREST DML grants for API roles.
-- Local-only additive migration. Do not apply remotely without explicit owner approval.
--
-- Defect (verified during Batch 2A.5 isolation seeding):
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public granted only
-- DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to anon, authenticated, and
-- service_role — omitting SELECT/INSERT/UPDATE. Tables created by migrations
-- therefore returned "permission denied" to PostgREST even when RLS policies
-- existed and service_role had BYPASSRLS.
--
-- Idempotent: re-granting ALL is safe.

-- ---------------------------------------------------------------------------
-- A. Fix default privileges so future postgres-owned objects are usable
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Restore grants on existing public tables / sequences
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
