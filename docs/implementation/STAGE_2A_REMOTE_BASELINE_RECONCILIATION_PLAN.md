# Stage 2A — Remote Baseline Reconciliation Plan

**Date:** 2026-08-04  
**Status:** Local artefacts prepared; remote **unchanged**  
**Stage 2A remote:** **Not complete**  
**Stage 2B:** **Not started**

---

## 1. Reason remote migration history is empty

Read-only linked inspection (`npx supabase migration list --linked` and SQL):

* Every local version `001`–`026` shows an empty remote version cell.
* Relation `supabase_migrations.schema_migrations` does **not** exist on the linked remote.
* No `supabase_migrations` (or similar) schema namespace was present.

**Conclusion:** The remote public schema was built historically (dashboard SQL / non-CLI path) without recording CLI migration history. Schema objects for 023/024 are present, but the ledger is empty — hence a controlled **history repair for 001–024** is required before `db push` of 025–027, and must stay owner-gated.

---

## 2. Verified historical drift (001–024)

### 2.1 Migration 019 — `project_notes.note_type` check

**Remote (linked query):**

```text
CHECK ((note_type = ANY (ARRAY[
  'general','measurement','access','client_request','existing_condition',
  'material_preference','exclusion','risk','other'
])))
```

**Local migration 019 additionally permits:** `calibration_note`

**Invalid remote rows outside the intended post-027 set:** none found.

**Classification:** historical 001–024 drift → reconciled by migration **027**.

### 2.2 Migration 009 — `note_proposals` created-at index name

| Property | Remote `note_proposals_created_idx` | Local `note_proposals_project_created_idx` (009) |
| --- | --- | --- |
| Table | `public.note_proposals` | `public.note_proposals` |
| Columns / order | `(project_id, created_at DESC)` | `(project_id, created_at DESC)` |
| Method | btree | btree |
| Unique | no | no |
| Partial predicate | none | none |

**Canonical name remotely:** absent (`note_proposals_project_created_idx` not found).

**Classification:** historical naming drift; **semantically equivalent** → safe rename/normalise in migration **027**.

### 2.3 Other 001–024 checks sampled

| Check | Remote result | Classification |
| --- | --- | --- |
| `enforce_pricing_item_org_match` | present | 023 represented |
| `pricing_items_org_match` / `quote_items_org_match` | present | 023 represented |
| `note_proposals` DELETE policy | present | 023 represented |
| `pricing_audit_log` | present | 024 represented |
| `enforce_child_project_org_match` | absent | expected **025** pending |
| Margin default | `25.00` | expected **025** pending |
| GST check constraints | absent | expected **025** pending |
| API privileges (`anon` SELECT / `authenticated` TRUNCATE) | broader than local post-026 | expected **026** pending |

**No unexplained material 001–024 public-schema drift** beyond the 019 constraint and 009 index-name findings was identified in this inventory.

---

## 3. Complete linked-diff classification

### 3.1 `npx supabase db diff --linked --schema public`

* Shadow DB built from local migrations through **026** (at time of run; before 027 existed).
* Tool result: **“No schema changes found”** / empty migra diff.

### 3.2 Classification relative to direct SQL inventory

| Observation | Classification |
| --- | --- |
| Empty migra diff vs verified 019/009/025/026 gaps | **Tool false-negative / limitation** — do not treat empty migra output as proof of schema parity |
| Missing `calibration_note` on remote | historical **019** drift → **027** |
| Index name `note_proposals_created_idx` | historical **009** naming drift → **027** |
| Missing seven project-child org triggers / GST / margin 20% | expected **025** |
| Broader API role grants than least-privilege SIDU | expected **026** |
| Empty CLI migration ledger | process/history gap → owner-gated `migration repair` for 001–024 |

---

## 4. Migration 027 design

**File:** `supabase/migrations/027_remote_baseline_reconciliation.sql`

### Constraint

* Inspects for invalid `note_type` values against the full intended set before changing anything.
* If `calibration_note` already present → no-op (clean local after 019).
* Else adds `project_notes_note_type_check_new` with the full set, drops the old check, renames to `project_notes_note_type_check` (no constraint-less window).
* Does not delete or rewrite note rows.
* Broadening only — existing remote values remain valid.

### Index

* If canonical exists and alternate exists and alternate is equivalent → drop alternate.
* If only canonical → no-op.
* If only equivalent alternate → `ALTER INDEX … RENAME TO note_proposals_project_created_idx`.
* If neither → create canonical definition from 009.
* Refuses to touch a non-equivalent alternate (raises).

---

## 5. Local test evidence (2026-08-04)

| Command | Result |
| --- | --- |
| `npx supabase db reset` | **PASS** — 001 through **027** applied |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npx tsx scripts/verify-batch-2a1-auth-org.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a2-validation.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a3a-pricing-actions.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a3b-quote-actions.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a4-database-integrity.ts` | **PASS** |
| `npx tsx scripts/verify-rls-coverage.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a5-tenant-isolation.ts` | **PASS** |
| `npx tsx scripts/verify-migration-027-baseline-reconciliation.ts` | **PASS** |

027 proofs include: constraint lists all intended values including `calibration_note`; unknown type rejected; single canonical `(project_id, created_at DESC)` index; guarded rename path safe to re-run.

---

## 6. Precise proposed migration-repair command (001–024)

**Not executed.**

```powershell
npx supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 023 024
```

If the CLI requires one version per call, invoke once per version `001` … `024` with `--status applied`.

**Stop points:**

1. After backup.  
2. After read-only preflight.  
3. After repair — confirm list shows only 025–027 pending.  
4. After dry-run (if available).  
5. After each of 025 / 026 / 027 post-checks (or after the push batch with full post verification).

---

## 7. Expected pending migrations after repair

| Version | File | Status after repair |
| --- | --- | --- |
| 001–024 | (existing) | remote marked **applied** (history only) |
| **025** | `025_stage_2a4_database_integrity.sql` | **pending** |
| **026** | `026_stage_2a5_restore_api_table_grants.sql` | **pending** |
| **027** | `027_remote_baseline_reconciliation.sql` | **pending** |

Apply with owner-gated `npx supabase db push` in file order 025 → 026 → 027.

---

## 8. Remote execution stop points

See `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` revised sequence §§1–10.

Do **not** mark Stage 2A remotely complete until:

* history repair succeeds;
* 025–027 apply and verify;
* 027 closes 009/019 drift;
* owner accepts residual limitations (if any).

---

## 9. Rollback considerations

* Prefer full restore from the pre-sequence backup.
* 027 is additive/reconcile-only; reverse only if product requires removing `calibration_note` or restoring the old index name.
* History repair rollback requires Supabase CLI ledger correction (`migration repair --status reverted` or equivalent) under owner/DBA guidance — coordinate carefully so ledger and schema stay aligned.

---

## 10. Confirmation — nothing remote was modified

During this reconciliation planning/implementation batch:

* **No** `supabase migration repair`
* **No** `supabase db push`
* **No** remote SQL mutations
* **No** remote migration application

Only read-only linked inspection (`migration list --linked`, `db diff --linked`, `db query --linked` SELECTs) and local Docker work were performed.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2A_REMOTE_BASELINE_RECONCILIATION_PLAN.md` |
| Migration | `supabase/migrations/027_remote_baseline_reconciliation.sql` |
| Verify script | `scripts/verify-migration-027-baseline-reconciliation.ts` |
| Runbook | `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` |
