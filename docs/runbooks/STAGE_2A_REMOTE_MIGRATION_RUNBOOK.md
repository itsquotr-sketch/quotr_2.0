# Stage 2A — Remote Migration Runbook (025 + 026)

**Status:** Documentation only. **Not executed** during Stage 2A (Batches 2A.4–2A.6).  
**Migrations (apply in order):**

1. `supabase/migrations/025_stage_2a4_database_integrity.sql`
2. `supabase/migrations/026_stage_2a5_restore_api_table_grants.sql`

**Environment note:** There is no separate Supabase staging project. Remote apply requires **explicit owner approval** for each remote step.  
**Supersedes:** `docs/runbooks/STAGE_2A4_REMOTE_MIGRATION_RUNBOOK.md` (025-only draft).

---

## 1. Explicit owner-approval gate

**Do not execute this runbook against remote Supabase without explicit owner approval.**

Before any remote write:

* Owner has approved applying **both** migration 025 and migration 026 to the linked remote project (or has approved them as two separately gated steps in this order).
* Operator records the approval date, approver, and target project ref in ops notes (outside the application repo; do not commit secrets).
* Local Stage 2A verification has passed after `supabase db reset` through **026**, including Batch 2A.4, RLS coverage, and Batch 2A.5 tenant isolation.

Local apply does **not** imply remote apply.

---

## 2. Backup / export requirement

Before remote apply:

1. Export a logical backup of the remote database (Supabase dashboard backup and/or `pg_dump` of the linked project).
2. Record the current remote migration list (Dashboard → Database → Migrations, or linked CLI `supabase migration list`).
3. Confirm a restore path is understood.
4. Store the backup **outside** the application repository. Do not commit dumps, connection strings, or credentials.

Even when there is currently no real external customer data, treat the remote database carefully.

---

## 3. Read-only remote migration-ledger check

Confirm applied migrations without writing:

* Supabase Dashboard → Database → Migrations, or
* Linked CLI: `supabase migration list` (against the linked remote project).

Record whether these appear as applied:

* `023_security_hardening`
* `024_sprint2_trust_hardening`
* `025_stage_2a4_database_integrity` (must be absent before this runbook’s apply step)
* `026_stage_2a5_restore_api_table_grants` (must be absent before this runbook’s apply step)

---

## 4. Verification that migrations 023 and 024 are already applied

If **023** or **024** are **missing** remotely:

* Do **not** apply 025 or 026 alone.
* First plan/apply 023 then 024 (or the full chain through 024) under a **separate** explicit owner approval.
* Re-run the remote ledger confirmation.

If **023** and **024** are **present**:

* Proceed to pre-apply queries below.

---

## 5. Queries — current defaults, constraints, grants, and RLS

Run in the remote SQL editor (read-only):

```sql
-- Margin default (expect 25.00 before 025; 20.00 after 025)
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';

-- Existing org-match triggers (023 only until 025)
SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname LIKE '%org_match%'
ORDER BY 1, 2;

-- GST constraints (absent until 025)
SELECT conname, conrelid::regclass::text, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN (
  'pricing_documents_gst_rate_check',
  'quotes_gst_rate_check'
);

-- RLS enabled on organisation-owned tables
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'organisations','profiles','projects','work_areas','project_facts',
    'question_blocks','questions','constraints','estimates','estimate_line_items',
    'rates','organisation_settings','organisation_work_areas','project_notes',
    'note_proposals','pricing_documents','pricing_items','quotes','quote_items',
    'pricing_audit_log'
  )
ORDER BY 1;

-- Sample API-role table privileges (informational before 026)
SELECT
  has_table_privilege('authenticated', 'public.projects', 'SELECT') AS auth_select,
  has_table_privilege('authenticated', 'public.projects', 'INSERT') AS auth_insert,
  has_table_privilege('authenticated', 'public.projects', 'UPDATE') AS auth_update,
  has_table_privilege('service_role', 'public.projects', 'SELECT') AS service_select,
  has_table_privilege('anon', 'public.projects', 'SELECT') AS anon_select;
```

---

## 6. Queries detecting invalid existing data

Stop and remediate if any mismatch or bad GST count is non-zero **before** applying 025:

```sql
-- Parent-child org mismatches against projects (should be 0)
SELECT 'work_areas' AS table_name, COUNT(*) AS mismatches
FROM public.work_areas c
JOIN public.projects p ON p.id = c.project_id
WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'project_facts', COUNT(*) FROM public.project_facts c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'question_blocks', COUNT(*) FROM public.question_blocks c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'questions', COUNT(*) FROM public.questions c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'constraints', COUNT(*) FROM public.constraints c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'estimates', COUNT(*) FROM public.estimates c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id
UNION ALL
SELECT 'estimate_line_items', COUNT(*) FROM public.estimate_line_items c
JOIN public.projects p ON p.id = c.project_id WHERE c.org_id IS DISTINCT FROM p.org_id;

-- GST rows that would block check constraints
SELECT COUNT(*) AS bad_pricing_gst
FROM public.pricing_documents
WHERE gst_rate IS NULL OR gst_rate < 0 OR gst_rate > 100;

SELECT COUNT(*) AS bad_quote_gst
FROM public.quotes
WHERE gst_rate IS NULL OR gst_rate < 0 OR gst_rate > 100;
```

---

## 7. Application order

Apply **exactly** in this order:

1. **025** — parent-child org triggers, margin default 20%, GST checks, idempotent RLS enable  
2. **026** — restore least-privilege PostgREST DML grants (`SELECT/INSERT/UPDATE/DELETE` for `authenticated`/`service_role`; schema `USAGE`; no anon table DML; no TRUNCATE/REFERENCES/TRIGGER) + default privileges for future objects  

Do not apply 026 before 025. Do not skip 025 if both are approved as a Stage 2A pair.

---

## 8. Exact remote application method

Dashboard:

* Database → Migrations → apply pending local migrations `025_stage_2a4_database_integrity.sql` then `026_stage_2a5_restore_api_table_grants.sql`.

Or linked CLI (example only — **do not run without approval**):

```powershell
# ONLY after explicit owner approval and successful pre-checks
# Prefer reviewing the pending list first:
npx supabase migration list

# Then push pending migrations to the linked remote project:
npx supabase db push
```

Prefer applying the two reviewed migrations rather than an unreviewed bulk push when the tooling allows. Record the CLI output (without secrets) in ops notes.

---

## 9. Post-025 verification

```sql
-- Seven 025 project-child triggers + retained 023 pricing/quote triggers
SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname LIKE '%org_match%'
ORDER BY 1, 2;
-- Expect 9 rows: seven *_project_org_match + pricing_items_org_match + quote_items_org_match

-- Margin default now 20.00
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';

-- GST constraints present
SELECT conname, conrelid::regclass::text, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN (
  'pricing_documents_gst_rate_check',
  'quotes_gst_rate_check'
);

-- RLS still enabled on pricing_audit_log
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'pricing_audit_log';
```

Confirm existing `organisation_settings.default_margin_percent` **values** were not bulk-rewritten (default change only).

---

## 10. Post-026 privilege and RLS verification

```sql
-- API roles can exercise required table DML (PostgREST + RLS)
-- Expect: authenticated/service_role SIDU = true; anon SELECT/INSERT = false;
--         TRUNCATE/REFERENCES/TRIGGER = false for authenticated/service_role/anon
SELECT
  has_table_privilege('authenticated', 'public.projects', 'SELECT') AS auth_select,
  has_table_privilege('authenticated', 'public.projects', 'INSERT') AS auth_insert,
  has_table_privilege('authenticated', 'public.projects', 'UPDATE') AS auth_update,
  has_table_privilege('authenticated', 'public.projects', 'DELETE') AS auth_delete,
  has_table_privilege('authenticated', 'public.projects', 'TRUNCATE') AS auth_truncate,
  has_table_privilege('service_role', 'public.organisations', 'SELECT') AS service_org_select,
  has_table_privilege('service_role', 'public.organisations', 'INSERT') AS service_org_insert,
  has_table_privilege('anon', 'public.projects', 'SELECT') AS anon_select,
  has_table_privilege('anon', 'public.projects', 'INSERT') AS anon_insert;

-- Privilege summary (expect SELECT/INSERT/UPDATE/DELETE for authenticated + service_role only)
SELECT grantee, privilege_type, COUNT(*) AS table_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, privilege_type
ORDER BY grantee, privilege_type;
-- Expect 8 rows: authenticated×4 + service_role×4. No anon table rows. No TRUNCATE/REFERENCES/TRIGGER.

-- RLS remains enabled (026 must not disable RLS)
SELECT COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_on, COUNT(*) AS total
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'organisations','profiles','projects','work_areas','project_facts',
    'question_blocks','questions','constraints','estimates','estimate_line_items',
    'rates','organisation_settings','organisation_work_areas','project_notes',
    'note_proposals','pricing_documents','pricing_items','quotes','quote_items',
    'pricing_audit_log'
  );
-- Expect rls_on = 20, total = 20
```

**Important:** Migration 026 restores **least-privilege** table privileges (`SELECT/INSERT/UPDATE/DELETE`) for `authenticated` and `service_role` so RLS policies can be exercised through PostgREST. It does **not** grant table DML to `anon`, does **not** grant `TRUNCATE`/`REFERENCES`/`TRIGGER`, does **not** disable RLS, add unrestricted policies, or grant table ownership.

Optionally re-run read-only sections of `supabase/sql/verify_rls_coverage.sql` against remote.

---

## 11. Two-organisation smoke test

After both migrations:

1. Create (or use disposable) User A / Organisation A and User B / Organisation B on remote **only if owner approves** disposable test data.
2. Confirm User A can read/update Organisation A project records.
3. Confirm User A cannot read or update Organisation B project / pricing / quote IDs.
4. Confirm missing and foreign IDs return equivalent generic not-found behaviour in the app.
5. Clean up disposable remote test orgs if created.

If owner does not approve remote disposable users, defer the live remote isolation proof and rely on local Batch 2A.5 evidence plus post-apply SQL checks above.

---

## 12. Rollback options

Both migrations are additive. Preferred rollback: **restore from the pre-apply backup**.

### Compensating SQL — reverse 026 first, then 025 (only if backup restore unavailable)

**026 reverse (narrow — use with care):** Re-applying restricted grants is environment-specific. Prefer backup restore. If privileges must be tightened manually, do so only under owner/DBA guidance; do not invent destructive `REVOKE` scripts without verifying which grants existed pre-026 on that remote.

**025 reverse:**

```sql
-- Drop 025 project-child triggers (retain 023 pricing/quote triggers)
DROP TRIGGER IF EXISTS work_areas_project_org_match ON public.work_areas;
DROP TRIGGER IF EXISTS project_facts_project_org_match ON public.project_facts;
DROP TRIGGER IF EXISTS question_blocks_project_org_match ON public.question_blocks;
DROP TRIGGER IF EXISTS questions_project_org_match ON public.questions;
DROP TRIGGER IF EXISTS constraints_project_org_match ON public.constraints;
DROP TRIGGER IF EXISTS estimates_project_org_match ON public.estimates;
DROP TRIGGER IF EXISTS estimate_line_items_project_org_match ON public.estimate_line_items;
DROP FUNCTION IF EXISTS public.enforce_child_project_org_match();

ALTER TABLE public.organisation_settings
  ALTER COLUMN default_margin_percent SET DEFAULT 25.00;

ALTER TABLE public.pricing_documents
  DROP CONSTRAINT IF EXISTS pricing_documents_gst_rate_check;
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_gst_rate_check;
```

Record any rollback in the migration ledger / ops notes. Manual compensating SQL does not automatically remove rows from `supabase_migrations.schema_migrations` — coordinate ledger repair with Supabase tooling if needed.

---

## 13. Expected application downtime

* **Expected downtime:** none / negligible for additive DDL (triggers, default change, check constraints, `GRANT`).
* Brief PostgREST schema reload may occur (`NOTIFY pgrst, 'reload schema'`).
* Prefer a short maintenance window anyway so operators can run post-checks without concurrent schema confusion.
* No data rewrite of historical margins is performed by 025; 026 does not modify row data.

---

## 14. Confirmation — runbook not executed during Stage 2A

**This runbook was not executed during Stage 2A.**  
Batches 2A.4, 2A.5, and 2A.6 validated migrations **locally only**.  
Remote migrations **025** and **026** remain **unapplied** until explicit owner approval.

No secrets are included in this document.
