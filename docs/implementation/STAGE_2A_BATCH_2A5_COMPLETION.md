# Stage 2A — Batch 2A.5 Completion Report

**Batch:** Local Tenant-Isolation Verification  
**Date:** 2026-08-03  
**Status:** Complete  
**Stage 2A overall:** In Progress (not complete)  
**Remote apply / production:** **Not touched**

---

## 1. Objective

Prove, on the local Supabase stack only, that Quotr enforces organisation isolation through both database RLS and application/server-action ownership guards under the binding MVP model (one user → one company; one company → many users; no org switching).

---

## 2. Issue IDs addressed and verified

| ID | Treatment |
| --- | --- |
| **S1-006** | Verified — end-to-end local two-org isolation suite passes (RLS + ownership helpers) |
| **S1-005** | Verified — assistant/active project ownership rejects foreign and soft-deleted projects |
| **S1-007** | Verified — migration 025 seven project-child org-match triggers enforce insert/update consistency |
| **2A.3A pricing ownership** | Verified — foreign pricing document/item IDs rejected with controlled not-found errors |
| **2A.3B quote ownership** | Verified — foreign quote/item IDs rejected with controlled not-found errors |
| **API table grants (defect)** | Fixed locally — migration `026_stage_2a5_restore_api_table_grants.sql` |

---

## 3. Local test environment

* Local Supabase Docker stack (`API_URL` host `127.0.0.1`)
* `supabase db reset` applied migrations **001 through 026**
* Migration **025** project-child triggers present
* Migration **026** restores PostgREST DML grants for `anon` / `authenticated` / `service_role`
* Verification refuses non-local Supabase URLs
* Credentials loaded from `supabase status -o env` when available (never printed); demo keys only as local fallback
* `.env.local` remote URL (if present) is ignored for live isolation checks
* No remote Supabase URL, service-role key, or production data used

---

## 4. Test data model

Disposable local organisations seeded via authenticated Admin API + PostgREST:

### Organisation A

* User A1 (owner) + User A2 (member)
* Project A, Work area A, Fact, Question block, Question, Constraint
* Estimate A + Estimate line item A
* Pricing document A + Pricing item A
* Quote A + Quote item A
* Organisation settings A, Rate A, optional pricing audit row

### Organisation B

* User B1 (owner)
* Parallel full child graph (project through quote item, settings, rate)

All IDs are freshly generated UUIDs. Records cleaned up at end of the suite (or via `supabase db reset`).

---

## 5. Same-organisation results

| Check | Result |
| --- | --- |
| User A1 read Project A | PASS |
| User A1 update Project A | PASS |
| User A1 create/delete child work area | PASS |
| Ownership helper accepts Project A for A1 | PASS |
| User A2 (same company) read + ownership of Project A | PASS |

Hardening did not block valid same-company access.

---

## 6. Cross-organisation read results

User A1 received empty results for Organisation B:

project, work area, facts, questions, constraints, estimate, estimate line items, pricing document, pricing items, quote, quote items, company settings, rates, pricing audit records.

Inverse: User B1 cannot read Organisation A project or quote.

No foreign records returned.

---

## 7. Cross-organisation write results

User A1 could not:

* update Project B / Estimate B / Pricing Document B / Pricing Item B / Quote B / Quote Item B
* delete Pricing Item B / Quote Item B
* insert work area or estimate line under Organisation B parents
* create a child with Org A `org_id` under Org B parent
* reparent Org A work area onto Org B project via RLS

Inverse: User B1 could not update Project A.

---

## 8. Application ownership-guard results

Exercised production helpers from `lib/security/org-ownership.ts` with real local authenticated clients:

| Guard | Result |
| --- | --- |
| `assertOrgOwnsActiveProject` rejects Project B | PASS (`Project not found.`) |
| `assertOrgOwnsPricingDocument` rejects Pricing Document B | PASS |
| `assertOrgOwnsPricingItem` rejects Pricing Item B | PASS |
| `assertOrgOwnsQuote` rejects Quote B | PASS |
| `assertOrgOwnsQuoteItem` rejects Quote Item B | PASS |
| `assertOrgOwnsWorkArea` rejects Work Area B | PASS |
| Soft-deleted Project A rejected by active helper | PASS |
| Lifecycle `assertOrgOwnsProject` still resolves soft-deleted Project A | PASS |

---

## 9. Parent-child integrity results

### Migration 025 (seven project-child tables)

Valid same-org inserts succeeded for representative tables. Mismatched-org insert, mismatched `org_id` update, and foreign reparenting failed for `work_areas`, `project_facts`, `question_blocks`, `constraints`, plus targeted mismatch inserts for `estimates`, `estimate_line_items`, and `questions`. Failed updates left original `org_id` unchanged.

### Migration 023

`pricing_items` and `quote_items` mismatched-org inserts failed as expected.

Service-role/postgres path used via docker `psql` to test triggers independently of RLS.

---

## 10. Soft-delete results

| Check | Result |
| --- | --- |
| Active project accessible before soft-delete | PASS |
| Active ownership rejects after `deleted_at` set | PASS |
| Child rows remain physically stored | PASS |
| Org B cannot read soft-deleted Project A or children | PASS |
| No hard deletion (row remains with `deleted_at`) | PASS |

**Distinction documented:** application active visibility uses `assertOrgOwnsActiveProject`; RLS still allows same-org SELECT of soft-deleted project rows/children at the database layer. Cross-org RLS continues to hide them.

---

## 11. Error-disclosure results

Missing UUID and foreign UUID produce equivalent public errors for projects, pricing items, and quotes (`Project not found.` / corresponding not-found strings). Errors omit organisation IDs, foreign metadata, stack traces, and raw permission text.

---

## 12. Files changed

| File | Change |
| --- | --- |
| `scripts/verify-batch-2a5-tenant-isolation.ts` | New Batch 2A.5 entry script (local-only guard, seed, RLS, ownership, triggers, soft-delete, disclosure) |
| `scripts/verify-org-isolation.ts` | Local-only guard; points to Batch 2A.5 for live proof; retains static helper smoke tests |
| `scripts/verify-rls-coverage.ts` | Notes non-local `.env` is ignored; live checks remain Docker-only |
| `supabase/migrations/026_stage_2a5_restore_api_table_grants.sql` | Defect fix — restore API role DML grants + default privileges |
| `docs/implementation/STAGE_2A_BATCH_2A5_COMPLETION.md` | This report |
| `docs/plans/STAGE_2A_SECURITY_VALIDATION_PLAN.md` | Batch 2A.5 recorded; Stage 2A still In Progress |
| `docs/MVP_HARDENING_GUIDE.md` | Tracker updated |

---

## 13. Defects found and corrections made

### Defect: missing PostgREST DML grants (blocking isolation proof)

* **Symptom:** service-role / authenticated PostgREST calls returned `permission denied for table organisations` (and lacked SELECT/INSERT/UPDATE on public tables).
* **Cause:** `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public` granted only DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to `anon`, `authenticated`, and `service_role`, omitting SELECT/INSERT/UPDATE. Migration-created tables inherited that ACL. RLS policies existed but could not be exercised through the API.
* **Fix:** local migration `026_stage_2a5_restore_api_table_grants.sql` restores `GRANT ALL` on existing public tables/sequences and corrects default privileges for future objects.
* **Remote:** **not applied**; requires explicit owner approval (same gate as 025).
* **Evidence:** after reset through 026, `has_table_privilege('authenticated', 'public.projects', 'SELECT')` is true; Batch 2A.5 suite passes.

No pricing formulas, quote formulas, AI prompts, UI, or unrelated features were changed.

---

## 14. Commands run

```bash
supabase db reset
supabase status   # used for local URL confirmation / credential load; secrets not logged
npx tsc --noEmit
npm run lint
npm run build
npx tsx scripts/verify-batch-2a1-auth-org.ts
npx tsx scripts/verify-batch-2a2-validation.ts
npx tsx scripts/verify-batch-2a3a-pricing-actions.ts
npx tsx scripts/verify-batch-2a3b-quote-actions.ts
npx tsx scripts/verify-batch-2a4-database-integrity.ts
npx tsx scripts/verify-rls-coverage.ts
npx tsx scripts/verify-batch-2a5-tenant-isolation.ts
```

---

## 15. Full results

| Suite | Result |
| --- | --- |
| `tsc --noEmit` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Batch 2A.1 | PASS |
| Batch 2A.2 | PASS |
| Batch 2A.3A | PASS |
| Batch 2A.3B | PASS |
| Batch 2A.4 | PASS |
| RLS coverage | PASS |
| Batch 2A.5 tenant isolation | PASS |

---

## 16. Known limitations

* Soft-delete is an **application active-visibility** control, not an RLS rewrite; same-org users may still SELECT child rows of soft-deleted projects at the DB layer if they bypass active helpers.
* Child ownership helpers (`assertOrgOwnsWorkArea`, pricing/quote item helpers) do not independently re-check parent `projects.deleted_at`; active product paths are expected to gate via `assertOrgOwnsActiveProject` first.
* Migration **026** (and **025**) are local-only until explicit remote approval.
* No separate staging project; remote isolation proof remains owner-gated.
* Server actions were verified via exported ownership helpers with real authenticated local clients where Next.js server-action runtime could not be invoked directly from the script.

---

## 17. Confirmation — no remote data or migrations touched

* No remote `supabase db push` / migration apply
* No production credentials used for verification
* No production data read or modified
* Local disposable orgs/users only

---

## 18. Recommended next step

**Batch 2A.6 only** — final Stage 2A regression and completion report.  
Do not broaden into Stage 2B. Remote apply of 025/026 remains owner-gated.
