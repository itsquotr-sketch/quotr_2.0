# Stage 2A — Remote Deployment Report

**Status:** Stage 2A — Complete  
**Deployment date:** 2026-08-04  
**Evidence basis:** Owner-confirmed remote deployment and verification  
**Stage 2B:** Not Started

---

## 1. Executive summary

Stage 2A (Security, Validation and Data Integrity) is now **complete locally and remotely**.

Local hardening (Batches 2A.1–2A.6), remote baseline reconciliation (migration 027), owner-gated history repair for migrations 001–024, and remote application of migrations **025 → 026 → 027** were completed successfully. Post-migration database checks and a deployed-application smoke test passed. No rollback was required. Production is working well.

---

## 2. Deployment details

| Field | Value |
| --- | --- |
| Deployment date | 2026-08-04 |
| Target environment | Linked remote Supabase project (production) |
| Branch | `hardening/stage-2a-security` |
| Latest commit at documentation time | `0559b1e893bb1dd4878ab3cb6651f97987e2ad69` — *Add remote baseline reconciliation migration* |
| Migrations applied remotely | `025`, `026`, `027` |
| Migration order | **025** → **026** → **027** |
| Backup / recovery preparation | Completed before remote changes (owner-confirmed) |
| Owner approval | Explicit owner approval obtained; owner executed and verified remote deployment |

Migrations applied:

1. `supabase/migrations/025_stage_2a4_database_integrity.sql`
2. `supabase/migrations/026_stage_2a5_restore_api_table_grants.sql`
3. `supabase/migrations/027_remote_baseline_reconciliation.sql`

Preceding ledger baseline (history only, after schema verification): migrations **001–024** marked applied via migration repair.

---

## 3. Preflight result

Owner-confirmed:

* The remote Supabase project was linked successfully.
* Remote migration history was initially empty.
* Remote schema was inspected before repair.
* Historical drift was identified (019 missing `calibration_note`; 009 index name `note_proposals_created_idx`) and designed for reconciliation through migration **027**.
* Migrations **001–024** were marked applied in remote migration history only after schema verification.
* The migration repair completed successfully.
* Dry run showed only migrations **025**, **026**, and **027** as pending.

---

## 4. Migration 025 result

Owner-confirmed verification passed:

* Seven project-child organisation consistency triggers exist (`work_areas`, `project_facts`, `question_blocks`, `questions`, `constraints`, `estimates`, `estimate_line_items`), using `enforce_child_project_org_match()`.
* `organisation_settings.default_margin_percent` default is **20%** for new rows.
* GST constraints exist and enforce **0–100** on `pricing_documents.gst_rate` and `quotes.gst_rate`.
* No destructive data rewrite.
* No historical margin records were bulk rewritten.

---

## 5. Migration 026 result

Owner-confirmed verification passed:

* Least-privilege API grants are in place (`SELECT` / `INSERT` / `UPDATE` / `DELETE` for `authenticated` and `service_role`).
* Anonymous customer-table DML is absent.
* Authenticated and service-role CRUD grants are present.
* RLS remains enabled.
* No unnecessary `TRUNCATE`, `REFERENCES`, or `TRIGGER` grants remain.

---

## 6. Migration 027 result

Owner-confirmed verification passed:

* `project_notes_note_type_check` includes `calibration_note`.
* Canonical index `note_proposals_project_created_idx` exists.
* Obsolete alternate index name `note_proposals_created_idx` no longer remains.
* No project-note data loss.

---

## 7. Application smoke-test result

Owner-confirmed deployed Quotr application smoke test passed:

* Sign-in
* Dashboard
* Project access / creation
* Work area
* Estimate
* Pricing item
* Save and refresh
* Quote
* No permission, RLS, trigger, GST, migration, or data-integrity errors observed

Authentication, project access, work areas, estimates, pricing items, quotes, saving, and refresh behaviour all worked successfully.

---

## 8. Security result

Confirmed against Stage 2A hardening expectations:

* Cross-company isolation remains enforced (RLS + server-side ownership).
* Same-company use remains functional.
* Server-side ownership checks remain active in the hardened application.
* RLS remains active on organisation-owned tables.
* Remote database matches the hardened application expectations after 025–027.

---

## 9. Remote migration ledger

Local and remote migration histories are aligned through **027**.

Owner-confirmed: the remote migration list now shows migrations **001–027** aligned with the repository.

---

## 10. Warnings or incidents

* No deployment incident.
* No rollback required.
* No data loss.
* No unexpected production behaviour.
* Production is working well.

---

## 11. Remaining accepted limitations

Carried forward from Stage 2A (unchanged; no new limitations introduced):

* Soft-delete visibility is enforced through active application paths (`assertOrgOwnsActiveProject`) rather than a broad RLS archive policy.
* Account deletion is not part of the MVP (S1-016 accepted; author-tracking RESTRICT FKs retained).
* Organisation roles and invitations are deferred (S1-013).
* Duplicated pricing / margin formula implementations remain for **Stage 2B**.
* No Quotr DNA work has started.

---

## 12. Final Stage 2A status

**Stage 2A — Complete**

---

## 13. Recommended next step

**Proceed to Stage 2B — Authoritative Pricing Engine, beginning with a controlled audit and calculation specification before any refactoring.**

Stage 2B has **not** started.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2A_REMOTE_DEPLOYMENT_REPORT.md` |
| Related local completion | `docs/implementation/STAGE_2A_COMPLETION_REPORT.md` |
| Related reconciliation plan | `docs/implementation/STAGE_2A_REMOTE_BASELINE_RECONCILIATION_PLAN.md` |
| Runbook followed | `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` |
| Governing plan | `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md` |
