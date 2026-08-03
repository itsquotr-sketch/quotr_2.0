# Stage 2A.4 — Remote Migration Runbook

**Status:** Documentation only. **Not executed** in Batch 2A.4.  
**Migration:** `supabase/migrations/025_stage_2a4_database_integrity.sql`  
**Environment note:** There is no separate Supabase staging project. Remote apply requires **explicit owner approval** in a later step.

---

## 1. Preconditions

* Local Batch 2A.4 verification has passed (`supabase db reset` + `scripts/verify-batch-2a4-database-integrity.ts`).
* Owner has explicitly approved applying migration 025 to the remote Supabase project.
* Operator has project admin access to the remote Supabase dashboard / CLI linked project.
* Confirm whether migrations **023** and **024** are already present on the remote ledger before applying 025.
* Prefer a maintenance window even when there is currently no real external customer data.

## 2. Required backup or export

Before remote apply:

1. Export a logical backup of the remote database (Supabase dashboard backup / `pg_dump` of the linked project).
2. Record the current remote migration list (dashboard Database → Migrations, or CLI migration list).
3. Store the backup outside the application repo; do not commit secrets or dumps.

## 3. Read-only check — remote migration ledger

Confirm applied migrations without writing:

* Supabase Dashboard → Database → Migrations, or
* Linked CLI: `supabase migration list` (against the linked remote project).

Record whether `023_security_hardening` and `024_sprint2_trust_hardening` appear as applied.

## 4. Read-only check — migrations 023 and 024

If 023/024 are **missing** remotely:

* Do **not** apply 025 alone.
* First plan/apply 023 then 024 (or the full chain) under a separate explicit approval.
* Re-run remote ledger confirmation.

If 023/024 are **present**:

* Proceed to invalid-data checks below.

## 5. Read-only query for invalid existing data

Run in the remote SQL editor (read-only selects):

```sql
-- Invalid-child org mismatches against projects (should be 0 before/after 025)
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

-- Current margin default (informational)
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';
```

If any mismatch or bad GST counts are non-zero, **stop** and remediate data before applying 025.

## 6. Apply method (do not run without approval)

Dashboard:

* Database → Migrations → apply / push the pending local migration `025_stage_2a4_database_integrity.sql`.

Or linked CLI (example only):

```bash
# ONLY after explicit owner approval and successful pre-checks
supabase db push
```

Prefer applying a single reviewed migration rather than an unreviewed bulk push when possible.

## 7. Post-apply verification queries

```sql
-- Triggers present
SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname LIKE '%org_match%'
ORDER BY 1, 2;

-- Margin default
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';

-- GST constraints
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

Optionally re-run the local-oriented SQL audit against remote (read-only sections):

`supabase/sql/verify_rls_coverage.sql`

## 8. Rollback instructions

025 is additive (triggers, default change, check constraints, idempotent RLS enable).

If rollback is required after apply:

1. Restore from the pre-apply backup (preferred), **or**
2. Manual compensating SQL (only if backup restore is unavailable):

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

Record the rollback in the migration ledger / ops notes.

## 9. Warning — owner approval required

**Do not execute this runbook against remote Supabase without explicit owner approval.**  
Batch 2A.4 intentionally stopped after local validation.

## 10. Confirmation — Batch 2A.4 remote status

**This batch did not apply anything remotely.**  
No production schema change was performed as part of Batch 2A.4.
