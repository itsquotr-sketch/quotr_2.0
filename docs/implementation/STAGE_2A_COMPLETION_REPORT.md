# Stage 2A Completion Report — Final Regression, Documentation and Local Completion

**Batch:** 2A.6  
**Date:** 2026-08-04  
**Status:** Complete — Local  
**Stage 2A overall:** Complete — Local (remote migrations 025/026/027 still unapplied; history repair not run)  
**Remote apply / production:** **Not touched**

---

## 1. Executive summary

Stage 2A (Security, Validation and Data Integrity) is **complete locally**. Batches 2A.1–2A.5 delivered authentication/organisation guards, runtime validation schemas, secured pricing and quote server actions, database integrity migration 025, and local two-organisation tenant-isolation proof (plus grant-restore migration 026). Batch 2A.6 re-ran the full verification suite on Windows after the macOS → Windows move, confirmed Section M acceptance criteria, reviewed migrations 025/026, reconciled in-scope Stage 1 issues, and published this completion report plus an owner-gated remote migration runbook covering both 025 and 026.

**Two Stage 2A corrections were required during 2A.6:** (1) local Docker Postgres container names hard-coded to `supabase_db_quotr_2.0-main` failed on Windows (`supabase_db_quotr_2.0`) — scripts now resolve the container dynamically; (2) migration 026 was narrowed from `GRANT ALL` to least-privilege SIDU for `authenticated`/`service_role` with no anon customer-table DML. After both fixes, all verification commands passed.

Remote production schema and data were **not** modified. Stage 2B was **not** started.

**Remote baseline note (2026-08-04):** Linked inspection found empty CLI migration history plus two historical drifts (019 missing `calibration_note`; 009 index name `note_proposals_created_idx`). Additive local migration `027_remote_baseline_reconciliation.sql` and plan `docs/implementation/STAGE_2A_REMOTE_BASELINE_RECONCILIATION_PLAN.md` prepare owner-gated history repair + push of 025→026→027. Stage 2A is **not** marked remotely complete.

---

## 2. Stage objective

Establish that Quotr’s existing MVP can be trusted for multi-tenant security and data integrity **without** consolidating the pricing engine: authenticated server actions, organisation ownership independent of RLS, RLS isolation, runtime input validation (including money-bearing paths), safe additive migrations, and controlled soft-delete behaviour.

---

## 3. Batches completed

| Batch | Name | Status | Evidence |
| --- | --- | --- | --- |
| 2A.1 | Shared authentication and organisation guard | Complete | `docs/implementation/STAGE_2A_BATCH_2A1_COMPLETION.md` |
| 2A.2 | Runtime validation schemas | Complete | `docs/implementation/STAGE_2A_BATCH_2A2_COMPLETION.md` |
| 2A.3A | Secure pricing server actions | Complete | `docs/implementation/STAGE_2A_BATCH_2A3A_COMPLETION.md` |
| 2A.3B | Secure quote server actions | Complete | `docs/implementation/STAGE_2A_BATCH_2A3B_COMPLETION.md` |
| 2A.4 | Database integrity and RLS corrections | Complete (local) | `docs/implementation/STAGE_2A_BATCH_2A4_COMPLETION.md` |
| 2A.5 | Local tenant-isolation verification | Complete (local) | `docs/implementation/STAGE_2A_BATCH_2A5_COMPLETION.md` |
| 2A.6 | Final regression, documentation, local completion | Complete (local) | This report |

---

## 4. Issues remediated (Stage 2A in-scope)

See §5 reconciliation table. In-scope IDs: S1-002, S1-003, S1-005, S1-006, S1-007, S1-013, S1-014, S1-015, S1-016, S1-017.

---

## 5. Stage 1 issue reconciliation

| ID | Original severity | Launch-blocking | Remediation batch | Current status | Test evidence | Remaining limitation | Future stage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **S1-002** | Critical | Yes | 2A.2 schemas; 2A.3A pricing actions | **Resolved (local)** | `verify-batch-2a2-validation.ts`, `verify-batch-2a3a-pricing-actions.ts` — lump-sum validated; margin/markup bounds enforced before persist | `forwardTotalsMatchStored` lump-sum quantity×rate bypass retained but unreachable without schema + commercial guards | None for 2A; formula consolidation remains 2B |
| **S1-003** | Critical | Yes | 2A.2; 2A.3A; 2A.3B | **Resolved (local)** | 2A.2/2A.3A/2A.3B scripts — Zod on audited pricing/quote mutations | Quote status transition state machine not invented | Residual quote UX elsewhere → later stages |
| **S1-005** | High | Yes | 2A.1; re-verified 2A.5 | **Resolved (local)** | 2A.1 ownership mocks; 2A.5 active project ownership rejects foreign IDs | Assistant paths still rely on defense-in-depth with RLS | None |
| **S1-006** | High | Yes | 2A.5 | **Resolved (local)** | `verify-batch-2a5-tenant-isolation.ts` PASS (same-org, cross-org RLS R/W, ownership, disclosure) | Remote isolation proof owner-gated; no staging project | Remote smoke after 025/026 apply |
| **S1-007** | High | Yes | 2A.4 migration 025; verified 2A.5 | **Resolved (local)** | 2A.4 + 2A.5 trigger mismatch rejection | Remote 025 unapplied | Remote apply |
| **S1-013** | Medium | No | 2A.1 documentation | **Accepted limitation** | Documented MVP: org-scoped access for all company users; no invites/roles in 2A | `profiles.role` largely unused in app | Future invite/role hardening if needed |
| **S1-014** | Medium | No | 2A.1 | **Resolved (local)** | Build route `/app/setup-required`; layout redirect documented | Authenticated zero-org users must sign out before `/signup` | Optional UX polish |
| **S1-015** | Medium | No | 2A.1 partial; 2A.3A/3B pricing/quote | **Resolved for Stage 2A scope** | Shared `requireAuthOrgContext` used by assistant/rates/setup/settings/pricing/quotes | Some lifecycle/project-notes loaders remain thin domain wrappers | Optional further consolidation later |
| **S1-016** | Medium | No | 2A.4 documentation | **Accepted MVP limitation** | Owner decision: account deletion not required | Author-tracking RESTRICT FKs retained | If account deletion is required later |
| **S1-017** | Medium | No | 2A.4 active ownership | **Addressed (non-destructive)** | 2A.4/2A.5 soft-delete tests — active helper hides; children stored | Soft-delete hide is application-path based; same-org RLS SELECT of children under soft-deleted projects still possible at DB layer | Optional RLS soft-delete policy later |

---

## 6. Authentication and organisation security result

* Authoritative `requireAuthOrgContext` / `getAuthOrgContext` under `lib/security/`.
* Assistant `loadProjectStage` / `getAssistantState` require ownership asserts.
* Zero-org users redirected to `/app/setup-required`.
* No org-switcher or invite system introduced.
* **Verification:** Batch 2A.1 PASS (2026-08-04 re-run).

---

## 7. Runtime validation result

* Pricing/quote Zod schemas; gross margin **0–95%** (default **20%**); markup **0–1000%** separate; negatives/non-finite rejected; lump-sum totals required and validated.
* **Verification:** Batch 2A.2 PASS (2026-08-04 re-run).

---

## 8. Pricing-action security result

* All pricing mutations use auth + ownership + schemas; lump-sum cannot reach persistence without validation; commercial guards on computed margins/markups.
* **Verification:** Batch 2A.3A PASS (2026-08-04 re-run).
* No pricing-formula consolidation.

---

## 9. Quote-action security result

* All quote mutations use auth + ownership + schemas; compensating org-scoped cleanup retained on create/revise failures.
* **Verification:** Batch 2A.3B PASS (2026-08-04 re-run).
* No quote/pricing arithmetic redesign.

---

## 10. Database integrity result

* Migration **025** applied locally: seven project-child org-match triggers; margin default 20% for **new** rows; GST 0–100 checks; idempotent RLS enable.
* **Verification:** `supabase db reset` applied 001–026; Batch 2A.4 PASS (2026-08-04).

---

## 11. RLS and tenant-isolation result

* All 20 organisation-owned tables have RLS enabled (including `pricing_audit_log`).
* Local two-org suite proves same-company sharing and cross-company deny for RLS reads/writes and ownership helpers.
* Migration **026** restores least-privilege API role DML grants (`authenticated`/`service_role` SIDU; `anon` none) so PostgREST can exercise RLS.
* **Verification:** `verify-rls-coverage.ts` PASS; Batch 2A.5 PASS (2026-08-04). Scripts refuse non-local Supabase URLs.

---

## 12. Migration 025 review

| Check | Outcome |
| --- | --- |
| Protects exactly the seven verified project-child relationships | **Pass** — `work_areas`, `project_facts`, `question_blocks`, `questions`, `constraints`, `estimates`, `estimate_line_items` |
| Does not duplicate migration 023 triggers | **Pass** — `pricing_items` / `quote_items` unchanged |
| Changes only default for new gross-margin records | **Pass** — `ALTER … SET DEFAULT 20.00`; no bulk `UPDATE` of historical margins |
| Applies GST constraints safely | **Pass** — guarded add; aborts if invalid rows exist |
| No destructive data operations | **Pass** — no `DELETE`/`TRUNCATE`/unguarded drops of data |
| Idempotent / safely re-runnable | **Pass** — `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, guarded constraints, `ENABLE ROW LEVEL SECURITY` |

**Review outcome:** Safe for eventual remote application after owner approval and pre-checks in the remote runbook.

---

## 13. Migration 026 review

| Check | Outcome |
| --- | --- |
| Restores privileges required for API roles to exercise existing RLS | **Pass** — least-privilege `SELECT/INSERT/UPDATE/DELETE` on public tables for `authenticated` and `service_role`; schema `USAGE`; sequence `USAGE/SELECT`; function `EXECUTE` |
| Does not disable or bypass RLS | **Pass** — no `DISABLE ROW LEVEL SECURITY`; post-026 local check: 20/20 tables still RLS-on |
| Does not grant ownership or unrestricted policies | **Pass** — no `ALTER OWNER`; no new policies; no `USING (true)` |
| Explicit schema qualification | **Pass** — `IN SCHEMA public` / `ON SCHEMA public` |
| Safe after 023–025 | **Pass** — revoke residual incomplete grants then re-grant; verified after full reset through 026 |
| Appropriate for eventual remote application | **Pass** — narrowed in Batch 2A.6 corrective review (no longer `GRANT ALL`) |

### Privilege state (local, after narrowed 026)

| Role | Schema | Tables (20 org-owned) | Sequences | Functions |
| --- | --- | --- | --- | --- |
| `anon` | `USAGE` | **none** | **none** | **none** |
| `authenticated` | `USAGE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` only | `USAGE`, `SELECT` | `EXECUTE` |
| `service_role` | `USAGE` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` only | `USAGE`, `SELECT` | `EXECUTE` |

**Not granted:** `TRUNCATE`, `REFERENCES`, `TRIGGER`, ownership, or table DML to `anon`.

**Why sufficient:** Quotr session clients use JWT role `authenticated` for all customer CRUD under RLS; signup creates organisations/profiles via server-only `service_role`; login/signup otherwise use Auth API (not public table DML as anon); public schema has no sequences today (UUID PKs); public functions are trigger/RLS helpers (`auth_org_id` is SECURITY DEFINER), not app RPCs.

**Before 026 (verified defect in 2A.5):** API roles lacked SELECT/INSERT/UPDATE/DELETE on migration-created tables (only TRUNCATE/REFERENCES/TRIGGER from broken defaults) → PostgREST `permission denied` despite RLS policies.

**2A.6 narrowing:** previous temporary `GRANT ALL` (including anon table DML and TRUNCATE/REFERENCES/TRIGGER) replaced in-place in unapplied migration 026; full local reset + verification suite re-passed; nothing applied remotely.

**Review outcome:** Accept for remote application with owner gate; RLS remains the tenant access control.

---

## 14. Soft-delete result

* Active product paths use `assertOrgOwnsActiveProject` (hide soft-deleted projects).
* Child rows remain stored; no hard-delete cascade.
* Cross-org RLS continues to hide foreign soft-deleted graphs.
* **Accepted limitation:** same-org DB-layer SELECT of children under soft-deleted projects remains possible if active helpers are bypassed.

---

## 15. Remaining accepted limitations

1. Soft-delete visibility is application-path based (not an RLS rewrite).
2. S1-016 account deletion / RESTRICT author FKs — not required for MVP.
3. S1-013 role/invite model — out of Stage 2A.
4. No multi-statement DB transactions beyond compensating deletes on create/revise paths.
5. Pricing/estimate formula duplication deferred to **Stage 2B**.
6. Remote migrations 025/026 unapplied; remote isolation smoke optional after apply.
7. `supabase/config.toml` with `[edge_runtime] enabled = false` remains **untracked** pending explicit owner decision to commit that project convention (Edge Runtime intentionally disabled; do not re-enable).
8. Local verification scripts discover Docker DB container names dynamically after the Windows checkout rename.
9. Migration 026 grants `DELETE` on all public tables to `authenticated`/`service_role` even where some tables rarely delete — RLS still gates deletes; further per-table operation narrowing is optional beyond Stage 2A.

---

## 16. Full command and test results (2026-08-04)

| Command | Result |
| --- | --- |
| `git status` | Clean except untracked `supabase/config.toml` (left untracked) |
| `npx supabase status` | Local stack up; Edge Runtime stopped |
| `npx supabase db reset` | **PASS** — migrations **001 through 026** applied in order |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** (Next.js 16.2.9; middleware deprecation warning only) |
| `npx tsx scripts/verify-batch-2a1-auth-org.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a2-validation.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a3a-pricing-actions.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a3b-quote-actions.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a4-database-integrity.ts` | **PASS** (after container-name fix) |
| `npx tsx scripts/verify-rls-coverage.ts` | **PASS** |
| `npx tsx scripts/verify-batch-2a5-tenant-isolation.ts` | **PASS** |

### 2A.6 corrections applied

* Added `scripts/local-db-container.ts` and wired Batch 2A.4 / 2A.5 / RLS scripts to resolve `supabase_db_quotr*` dynamically (Windows folder `quotr_2.0` vs prior `quotr_2.0-main`).
* Narrowed unapplied migration `026` from `GRANT ALL` to least-privilege SIDU for `authenticated`/`service_role`; revoked anon customer-table DML; extended Batch 2A.5 privilege and anonymous-denial proofs. Full suite re-passed.

---

## 17. Local environment used

* OS: Windows 10 (PowerShell)
* Local Supabase Docker (`127.0.0.1:54321` API; Postgres `127.0.0.1:54322`)
* Edge Runtime: **disabled / stopped** (intentional)
* CLI via `npx supabase` (global `supabase` not on PATH)
* Verification refused non-local Supabase URLs (Batch 2A.5 + RLS coverage notes)

---

## 18. Remote state explicitly unchanged

* No `supabase db push` / remote migration apply
* No production credentials used for live checks
* No production data read or modified
* Migrations **025** and **026** remain local-only until owner approval

---

## 19. Remote migration approval still required

Owner-gated checklist (see `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md`):

1. Explicit owner approval for remote 025 then 026  
2. Backup / export  
3. Read-only ledger confirms 023 + 024 present; 025/026 absent  
4. Invalid parent-child / GST data counts = 0  
5. Apply **025**, verify triggers/default/GST/RLS  
6. Apply **026**, verify grants + RLS still enabled  
7. Optional two-org remote smoke  
8. Record ops notes (no secrets in repo)

**This checklist was not executed during Stage 2A.**

---

## 20. Stage 2A acceptance checklist (Section M)

| # | Criterion | Result |
| ---: | --- | --- |
| 1 | Protected server actions require authenticated user | **Pass** |
| 2 | Organisation-owned actions verify ownership (one-user→one-company / multi-user→one-company) | **Pass** |
| 3 | No trust of client org ID; no org-switcher | **Pass** |
| 4 | Runtime schemas validate audited mutation inputs | **Pass** |
| 5 | Monetary inputs reject invalid/non-finite/negative | **Pass** |
| 6 | Gross margin 0–95% (default 20%) and markup 0–1000% enforced separately | **Pass** |
| 7 | Lump-sum available and cannot bypass validation | **Pass** |
| 8 | RLS enabled/verified for every org-owned table locally (incl. `pricing_audit_log`) | **Pass** |
| 9 | Two real users / two orgs cannot access each other’s records (local) | **Pass** |
| 10 | Direct DB requests and server-action ownership both enforce isolation | **Pass** |
| 11 | Destructive ops cannot delete other-org records | **Pass** |
| 12 | Migrations apply safely to clean local DB; remote apply documented and owner-gated | **Pass** |
| 13 | Existing data preserved; production not modified unnecessarily | **Pass** |
| 14 | Type checking passes | **Pass** |
| 15 | Linting passes | **Pass** |
| 16 | Production build passes | **Pass** |
| 17 | Focused automated tests pass | **Pass** |
| 18 | No pricing-engine consolidation, UI redesign, performance work, DNA, uploads, packages, or unrelated features | **Pass** |

No Critical or High Stage 2A acceptance criterion remains failed.

---

## 21. Recommendation — Stage 2A local completion

**Mark Stage 2A `Complete — Local`.**

Do **not** mark production deployment complete. Remote 025/026 remain owner-gated.

---

## 22. Recommended next step

1. **Owner decision:** apply remote migrations 025 then 026 using `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` (or defer).  
2. After remote decision is settled, begin **Stage 2B — Authoritative Pricing Engine** only with explicit authorisation.

**Stop:** Stage 2B was not started in this batch.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2A_COMPLETION_REPORT.md` |
| Date | 2026-08-04 |
| Governing plan | `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md` |
| Remote runbook | `docs/runbooks/STAGE_2A_REMOTE_MIGRATION_RUNBOOK.md` |
