# Stage 2A — Remote Migration Runbook (history baseline + 025 + 026 + 027)

**Status:** Documentation only. **Not executed.**  
**Companion plan:** `docs/implementation/STAGE_2A_REMOTE_BASELINE_RECONCILIATION_PLAN.md`

**Migrations to apply after history repair (in order):**

1. `supabase/migrations/025_stage_2a4_database_integrity.sql`
2. `supabase/migrations/026_stage_2a5_restore_api_table_grants.sql`
3. `supabase/migrations/027_remote_baseline_reconciliation.sql`

**Environment note:** There is no separate Supabase staging project. Remote apply requires **explicit owner approval** for each remote write step.  
**Supersedes:** prior 025/026-only draft of this runbook.

---

## Owner-approval gate

**Do not execute this runbook against remote Supabase without explicit owner approval.**

Before any remote write (including `migration repair` or `db push`):

* Owner has approved the full sequence below.
* Local Stage 2A verification has passed after `supabase db reset` through **027**.
* Backup / export is complete and restore is understood.
* Ops notes record approver, date, and target project ref (**outside** the repo; no secrets committed).

Local apply does **not** imply remote apply.

---

## Revised remote sequence (do not execute)

### 1. Back up the remote project

1. Export a logical backup (Supabase dashboard backup and/or `pg_dump` of the linked project).
2. Record the current remote migration list (`npx supabase migration list --linked`).
3. Store the backup **outside** the application repository.

### 2. Complete read-only preflight

Run the read-only queries in sections **Preflight A–C** below. Stop on any unexpected mismatch.

### 3. Verify the remote schema substantially represents migrations 001–024

Confirmed by prior read-only inspection (2026-08-04):

* `023` schema objects present (`enforce_pricing_item_org_match`, pricing/quote org-match triggers, `note_proposals` DELETE policy).
* `024` `pricing_audit_log` present.
* Remote CLI migration history is **empty** (`supabase_migrations` schema absent; `migration list --linked` shows no remote versions).

Schema was applied historically outside the CLI ledger (dashboard SQL / non-CLI path).

### 4. Record known historical drift reconciled by migration 027

| Drift | Remote fact | Local intent | Reconciled by |
| --- | --- | --- | --- |
| Migration **019** constraint | `project_notes_note_type_check` lacks `calibration_note` | 019 full value set including `calibration_note` | **027** |
| Migration **009** index name | `note_proposals_created_idx` on `(project_id, created_at DESC)` | `note_proposals_project_created_idx` same definition | **027** (rename; semantically equivalent) |

No other unexplained material 001–024 public-schema drift was identified in the SQL inventory.  
`npx supabase db diff --linked --schema public` returned an empty migra diff despite these verified differences — treat SQL inventory as authoritative for these objects.

### 5. Mark migrations 001–024 as applied in remote migration history (owner-gated only)

**Only after** backup + preflight + owner approval. This updates the CLI ledger to match the already-present remote schema; it does **not** re-run SQL for 001–024.

Proposed PowerShell command (example — **not run** during this documentation batch):

```powershell
# OWNER APPROVAL REQUIRED — marks history only; does not apply SQL for 001-024
npx supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 023 024
```

If the installed CLI requires one version per invocation, run the same flag once per version `001` … `024`.

**Stop point:** confirm `npx supabase migration list --linked` before proceeding.

### 6. Confirm migration list shows only 025, 026, and 027 pending

Expected after successful repair of 001–024:

| Version | Local | Remote |
| --- | --- | --- |
| 001–024 | present | marked applied |
| 025 | present | pending |
| 026 | present | pending |
| 027 | present | pending |

If any of 001–024 remain pending, or if 025–027 are unexpectedly marked applied, **stop**.

### 7. Run db push dry-run

```powershell
# OWNER APPROVAL REQUIRED — dry-run only if supported by CLI version
npx supabase db push --dry-run
```

If `--dry-run` is unavailable, re-check `migration list --linked` and review the three pending migration files manually. Do not push yet.

### 8. Apply migrations 025, 026, and 027 in order

```powershell
# OWNER APPROVAL REQUIRED
npx supabase db push
```

Apply order must be **025 → 026 → 027**. Do not skip 027 (it closes verified 009/019 remote drift).

### 9. Run post-migration verification

Use **Post-apply verification** queries below (025 triggers/defaults/GST, 026 privileges, 027 constraint + canonical index).

### 10. Confirm historical drift is closed

```sql
-- 019 / 027: calibration_note present
SELECT pg_get_constraintdef(oid) LIKE '%calibration_note%' AS has_calibration
FROM pg_constraint
WHERE conname = 'project_notes_note_type_check'
  AND conrelid = 'public.project_notes'::regclass;

-- 009 / 027: canonical index only
SELECT
  to_regclass('public.note_proposals_project_created_idx') IS NOT NULL AS has_canonical,
  to_regclass('public.note_proposals_created_idx') IS NOT NULL AS has_alternate;
```

Expect `has_calibration = true`, `has_canonical = true`, `has_alternate = false`.

Optionally re-run `npx supabase db diff --linked --schema public` and confirm no unexplained remaining public drift. Remember migra may still miss some objects — prefer SQL checks for 027 artefacts.

---

## Preflight A — ledger and baseline objects

```sql
-- History schema may be absent before repair
SELECT nspname FROM pg_namespace
WHERE nspname LIKE '%migration%' OR nspname = 'supabase_migrations';

-- 023 / 024 presence
SELECT
  to_regprocedure('public.enforce_pricing_item_org_match()') IS NOT NULL AS has_023_fn,
  to_regclass('public.pricing_audit_log') IS NOT NULL AS has_024_table,
  to_regprocedure('public.enforce_child_project_org_match()') IS NOT NULL AS has_025_fn_before;
-- Expect: has_023_fn true, has_024_table true, has_025_fn_before false
```

```powershell
npx supabase migration list --linked
# Expect: all remote version cells empty before repair
```

---

## Preflight B — known 009 / 019 drift (027 targets)

```sql
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname = 'project_notes_note_type_check'
  AND conrelid = 'public.project_notes'::regclass;
-- Expect: ARRAY without calibration_note

SELECT c.relname AS index_name, pg_get_indexdef(i.indexrelid) AS index_def
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'note_proposals'
  AND c.relname IN (
    'note_proposals_project_created_idx',
    'note_proposals_created_idx'
  );
-- Expect: only note_proposals_created_idx with (project_id, created_at DESC)

-- No rows outside the intended post-027 set (broadening; should be empty)
SELECT note_type, COUNT(*)
FROM public.project_notes
WHERE note_type NOT IN (
  'general','measurement','access','client_request','existing_condition',
  'material_preference','exclusion','risk','calibration_note','other'
)
GROUP BY 1;
```

---

## Preflight C — expected pending 025 / 026 state

```sql
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';
-- Expect 25.00 before 025

SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname LIKE '%org_match%'
ORDER BY 1, 2;
-- Expect only pricing_items_org_match + quote_items_org_match before 025

SELECT conname FROM pg_constraint
WHERE conname IN (
  'pricing_documents_gst_rate_check',
  'quotes_gst_rate_check'
);
-- Expect 0 rows before 025

SELECT
  has_table_privilege('authenticated', 'public.projects', 'SELECT') AS auth_select,
  has_table_privilege('authenticated', 'public.projects', 'TRUNCATE') AS auth_truncate,
  has_table_privilege('anon', 'public.projects', 'SELECT') AS anon_select;
-- Before 026: typically broader grants (anon SELECT / TRUNCATE possible)
```

Invalid parent-child / GST data checks (must be 0 before 025):

```sql
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

SELECT COUNT(*) AS bad_pricing_gst
FROM public.pricing_documents
WHERE gst_rate IS NULL OR gst_rate < 0 OR gst_rate > 100;

SELECT COUNT(*) AS bad_quote_gst
FROM public.quotes
WHERE gst_rate IS NULL OR gst_rate < 0 OR gst_rate > 100;
```

---

## Post-apply verification

### After 025

```sql
SELECT c.relname, t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname LIKE '%org_match%'
ORDER BY 1, 2;
-- Expect 9 org_match triggers

SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organisation_settings'
  AND column_name = 'default_margin_percent';
-- Expect 20.00
```

### After 026

```sql
SELECT
  has_table_privilege('authenticated', 'public.projects', 'SELECT') AS auth_select,
  has_table_privilege('authenticated', 'public.projects', 'INSERT') AS auth_insert,
  has_table_privilege('authenticated', 'public.projects', 'UPDATE') AS auth_update,
  has_table_privilege('authenticated', 'public.projects', 'DELETE') AS auth_delete,
  has_table_privilege('authenticated', 'public.projects', 'TRUNCATE') AS auth_truncate,
  has_table_privilege('anon', 'public.projects', 'SELECT') AS anon_select;
-- Expect SIDU true for authenticated; TRUNCATE false; anon SELECT false
```

### After 027

```sql
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'project_notes_note_type_check'
  AND conrelid = 'public.project_notes'::regclass;
-- Must include calibration_note

SELECT
  to_regclass('public.note_proposals_project_created_idx') IS NOT NULL AS has_canonical,
  to_regclass('public.note_proposals_created_idx') IS NOT NULL AS has_alternate,
  pg_get_indexdef('public.note_proposals_project_created_idx'::regclass) AS canonical_def;
```

### Two-organisation smoke (optional, owner-gated)

Same as prior runbook: disposable User A / Org A vs User B / Org B; cross-org deny; generic not-found.

---

## Rollback

Preferred: restore from the pre-apply backup.

Manual compensating notes (only if backup restore unavailable):

* **027:** drop/recreate note-type check without `calibration_note` only if product requires reverting; rename index back to `note_proposals_created_idx` if required for ops consistency (usually unnecessary).
* **026 / 025:** see prior compensating SQL in ops notes / Stage 2A completion report; prefer backup restore.

Manual SQL does not automatically repair `supabase_migrations.schema_migrations` — coordinate ledger changes with Supabase tooling.

---

## Expected downtime

* Negligible for additive DDL (triggers, defaults, checks, grants, index rename, constraint swap).
* Brief PostgREST reload may occur.
* Prefer a short maintenance window for pre/post checks.

---

## Confirmation — planning status vs deployment

This runbook documented the owner-gated remote sequence. Owner-confirmed deployment of history repair + migrations **025 → 026 → 027** completed successfully on **2026-08-04**. Formal record: `docs/implementation/STAGE_2A_REMOTE_DEPLOYMENT_REPORT.md`.

Stage 2A is **Complete**. Stage 2B has **not** started.

No secrets are included in this document.
