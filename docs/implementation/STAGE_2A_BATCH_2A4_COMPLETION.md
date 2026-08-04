# Stage 2A — Batch 2A.4 Completion Report

**Batch:** Database Integrity and RLS Corrections  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)  
**Remote apply:** **Not performed**

---

## 1. Objective

Add local additive database protections for parent-child organisation consistency (S1-007), align the organisation settings gross-margin default to 20% for new rows, add GST check constraints where safe, hide soft-deleted project children from normal active application queries without hard deletion (S1-017), and document S1-016 as an accepted MVP limitation — all without applying anything remotely.

## 2. Issue IDs addressed

| ID | Treatment |
| --- | --- |
| **S1-007** | Fixed locally — seven project-child tables now have before insert/update org-match triggers |
| **S1-016** | Documentation only — account/user deletion not required for MVP; author-tracking RESTRICT FKs retained |
| **S1-017** | Non-destructive — `assertOrgOwnsActiveProject` hides soft-deleted projects from active query/mutation paths; child rows remain stored |
| **DB margin default** | `organisation_settings.default_margin_percent` default changed 25.00 → 20.00 for **new** rows only |

## 3. Local schema findings

* Migrations 001–024 applied cleanly; 023 already protected `pricing_items` / `quote_items` only.
* Seven project-child tables lacked org-match triggers: `work_areas`, `project_facts`, `question_blocks`, `questions`, `constraints`, `estimates`, `estimate_line_items`.
* `organisation_settings.default_margin_percent` default was `25.00` (app constant already 20%).
* `organisation_settings.default_gst_rate` already checked 0–100; `pricing_documents.gst_rate` / `quotes.gst_rate` lacked checks.
* Local GST invalid-row counts were 0 before adding constraints.
* `pricing_audit_log` already had RLS enabled (migration 024).
* Soft-delete: projects have `deleted_at`; children are not soft-deleted and must not be hard-deleted.

## 4. Exact parent-child relationships protected

| Child table | Parent | FK | Trigger |
| --- | --- | --- | --- |
| `work_areas` | `projects` | `project_id` | `work_areas_project_org_match` |
| `project_facts` | `projects` | `project_id` | `project_facts_project_org_match` |
| `question_blocks` | `projects` | `project_id` | `question_blocks_project_org_match` |
| `questions` | `projects` | `project_id` | `questions_project_org_match` |
| `constraints` | `projects` | `project_id` | `constraints_project_org_match` |
| `estimates` | `projects` | `project_id` | `estimates_project_org_match` |
| `estimate_line_items` | `projects` | `project_id` | `estimate_line_items_project_org_match` |

Shared function: `public.enforce_child_project_org_match()` (insert + update).  
Not duplicated: `pricing_items` / `quote_items` (023).

## 5. Migration contents

**File:** `supabase/migrations/025_stage_2a4_database_integrity.sql`

* Create/replace `enforce_child_project_org_match` + seven triggers.
* Alter `organisation_settings.default_margin_percent` default to `20.00`.
* Guarded add of `pricing_documents_gst_rate_check` and `quotes_gst_rate_check` (0–100).
* Idempotent `enable row level security` on org-owned tables including `pricing_audit_log`.
* No hard-delete of soft-deleted project children; no RLS rewrite for soft-delete.

## 6. RLS verification changes

* Updated `supabase/sql/verify_rls_coverage.sql` — catalogue queries for RLS, policies, org columns, org-match triggers, margin default, GST constraints; includes `pricing_audit_log`; no `verify_rls_status` RPC.
* Updated `scripts/verify-rls-coverage.ts` — live Docker catalogue checks instead of missing RPC.

## 7. Gross-margin database default treatment

* Column: `public.organisation_settings.default_margin_percent`
* Previous default: `25.00`
* New default: `20.00`
* Existing rows **not** bulk updated

## 8. GST treatment

* Application Zod already enforces 0–100.
* DB: added checks on `pricing_documents.gst_rate` and `quotes.gst_rate`.
* `organisation_settings.default_gst_rate` already constrained (017); NZ default remains 15%.

## 9. Soft-delete treatment

* **Security policy:** unchanged RLS (same-org access still possible at DB layer for soft-deleted project rows).
* **Active-data visibility:** `assertOrgOwnsActiveProject` (`.is("deleted_at", null)`) used by assistant, pricing, quotes, estimate-stale, and related active paths.
* **Archive visibility:** `assertOrgOwnsProject` retained for lifecycle paths that must see deleted projects.
* Child rows remain stored; no hard deletion.

### Call sites switched to active ownership

* `lib/assistant/state.ts`, `actions.ts`, `work-area-actions.ts`, `margin-actions.ts`, `fact-actions.ts`, `constraint-actions.ts`
* `lib/pricing/actions.ts`, `lib/quotes/actions.ts`, `lib/estimate/stale.ts`

## 10. Files changed

### Database / SQL

* `supabase/migrations/025_stage_2a4_database_integrity.sql` *(new)*
* `supabase/sql/verify_rls_coverage.sql`

### Application

* `lib/security/org-ownership.ts` (`assertOrgOwnsActiveProject`)
* Assistant / pricing / quotes / estimate active call sites listed above

### Verification / docs

* `scripts/verify-batch-2a4-database-integrity.ts` *(new)*
* `scripts/verify-rls-coverage.ts`
* `docs/runbooks/STAGE_2A4_REMOTE_MIGRATION_RUNBOOK.md` *(new in 2A.4; superseded in 2A.6 by `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` covering 025+026)*
* `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md`
* `docs/MVP_HARDENING_GUIDE.md`
* `docs/implementation/STAGE_2A_BATCH_2A4_COMPLETION.md` *(this file)*

## 11. Local commands run

* `supabase db reset` — success (001–025 applied; 023/024 before 025)
* `supabase status` — local API/DB up
* `npx tsc --noEmit` — pass
* `npm run lint` — pass
* `npm run build` — pass
* Prior batch verify scripts 2A.1–2A.3B — pass
* `npx tsx scripts/verify-rls-coverage.ts` — pass (incl. live Docker)
* `psql < supabase/sql/verify_rls_coverage.sql` — pass
* `npx tsx scripts/verify-batch-2a4-database-integrity.ts` — pass

## 12. Verification results

* Matching child/parent org inserts succeed; mismatched insert/update rejected; rows unchanged after rejected update.
* New settings rows default to 20% margin; explicit margins preserved.
* GST 0/15/100 accepted; negative / >100 rejected.
* Soft-deleted projects fail active ownership helper; lifecycle helper retained.
* Idempotent re-create of function/trigger smoke-tested.

## 13. Migration idempotence assessment

Uses `create or replace function`, `drop trigger if exists` + create, guarded constraint creation, `alter … set default`, and `alter table if exists … enable row level security`. Safe on clean DB and after 023/024.

## 14. Existing-data assessment

* Local invalid GST rows: 0 before constraint add.
* No historical margin bulk rewrite.
* Parent-child mismatch insert/update rejected going forward; local fixtures cleaned after tests.

## 15. Remote runbook created

`docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` (supersedes the 2A.4 025-only draft) — preconditions, backup, ledger checks, invalid-data queries, apply method for 025 then 026, post-checks, rollback, owner-approval warning. **Not executed.**

## 16. Known limitations

* Soft-delete hiding is application-path based; RLS still allows same-org select of rows under soft-deleted projects if queried directly.
* Account deletion / RESTRICT author FKs unchanged (S1-016 accepted).
* Two-user isolation proof remains Batch **2A.5**.
* Quote vs pricing subtotal divergence unchanged.
* Remote migration not applied.

## 17. Confirmation no remote migration was applied

**Confirmed:** Batch 2A.4 made no remote Supabase or production schema changes.

## 18. Recommended next step

**Batch 2A.5 only** — tenant-isolation verification (two real users / two organisations on local). Do not begin Stage 2B formula consolidation without approval.
