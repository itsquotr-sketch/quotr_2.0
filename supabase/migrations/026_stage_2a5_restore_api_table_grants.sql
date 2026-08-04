-- Stage 2A Batch 2A.5: restore least-privilege PostgREST DML grants for API roles.
-- Local-only additive migration. Do not apply remotely without explicit owner approval.
--
-- Defect (verified during Batch 2A.5 isolation seeding):
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public granted only
-- TRUNCATE/REFERENCES/TRIGGER (and similar non-DML rights) to anon, authenticated,
-- and service_role — omitting SELECT/INSERT/UPDATE/DELETE. Tables created by
-- migrations therefore returned "permission denied" to PostgREST even when RLS
-- policies existed and service_role had BYPASSRLS.
--
-- Privilege model (narrowed in Batch 2A.6 corrective review):
-- * Schema USAGE: anon, authenticated, service_role (PostgREST / role visibility).
-- * Table DML: SELECT, INSERT, UPDATE, DELETE only — no TRUNCATE/REFERENCES/TRIGGER.
-- * authenticated: all public application tables (RLS enforces org rows).
-- * service_role: same table DML (signup org/profile bootstrap + admin paths).
-- * anon: NO table/sequence/function grants on public customer objects.
--   Unauthenticated flows use Auth API; org/profile bootstrap uses service_role.
-- * Sequences: USAGE + SELECT for authenticated/service_role (none today; UUID PKs).
-- * Functions: EXECUTE for authenticated/service_role only (no public app RPCs today;
--   trigger helpers run as owner; auth_org_id is SECURITY DEFINER).
-- Idempotent: revoke-then-grant is safe on clean local reset.

-- ---------------------------------------------------------------------------
-- A. Fix default privileges so future postgres-owned objects get least privilege
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Schema usage (required for PostgREST role access to public)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- C. Strip residual incomplete / overly broad grants inherited from defaults
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke all on all functions in schema public from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D. Least-privilege grants for Quotr application roles
-- ---------------------------------------------------------------------------

-- Authenticated session clients (anon key + user JWT → role authenticated)
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Service role (server-only signup bootstrap and admin tooling; still needs table ACL
-- even with BYPASSRLS)
grant select, insert, update, delete on all tables in schema public to service_role;

-- Sequences (none in public today; keep grants for any future serial/identity use)
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Functions (no Quotr PostgREST RPCs today; keep EXECUTE for authenticated/service_role)
grant execute on all functions in schema public to authenticated, service_role;

-- anon intentionally receives no public table/sequence/function privileges.
-- Customer-owned data is never accessed anonymously.

notify pgrst, 'reload schema';
