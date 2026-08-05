# Stage 3.1B — Remote Migration 028 / 029 Runbook

**Status:** Ready Pending Owner Approval — **Do not execute until signed**  
**Date:** 2026-08-06  
**Migrations:**  
- `supabase/migrations/028_scope_discovery_persistence.sql`  
- `supabase/migrations/029_scope_discovery_acceptance_rpc.sql`  
**Related:** `docs/decisions/STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md`  
**Batch:** Stage 3.1B.5B planning  

**Hard rule:** This runbook is documentation only until the owner marks remote apply approved. Do not push migrations, repair history, or create Work Areas from this document alone.

---

## 1. Preconditions

| # | Check | Pass criteria |
| ---: | --- | --- |
| 1 | Owner approvals #1 and #2 signed | `STAGE_3_1B5B_REMOTE_AND_WIRING_APPROVAL.md` — remote apply of 028 and 029 **Approved** with date |
| 2 | Local verification green | `verify-stage-3-1b4b-persistence.ts` and `verify-stage-3-1b5a-decision-lifecycle.ts` pass on local Docker |
| 3 | Linked project correct | `npx supabase projects list` / link points at intended Preview (or production if explicitly authorised) |
| 4 | Feature still off | No `SCOPE_DISCOVERY_ENABLED` path live; Analyse Job unchanged |
| 5 | No concurrent schema work | No other migration PR in flight against the same remote |
| 6 | Backup window | Snapshot / PITR window confirmed for the target project |

---

## 2. Branch and commit checks

```bash
git status
git log --oneline -5
git rev-parse HEAD
```

Confirm:

- Working tree clean (or only unrelated approved docs).
- Migrations 028 and 029 match the commit under test (no uncommitted SQL edits).
- Record commit SHA in the sign-off template (§18).

---

## 3. Backup guidance

Before apply:

1. Confirm Supabase PITR / daily backups are enabled for the target project.
2. Optionally export schema-only baseline:  
   `npx supabase db dump --linked --schema public -f backup-pre-028-029-schema.sql`
3. Record backup timestamp and project ref in sign-off.
4. Prefer applying first to **Preview** (or a dedicated remote) before production.

---

## 4. Migration-history check

Read-only:

```bash
npx supabase migration list
```

**Required before apply (2026-08-06 baseline):**

| Version | Local | Remote |
| --- | --- | --- |
| 001–027 | Present | Present |
| 028 | Present | **Empty** (pending) |
| 029 | Present | **Empty** (pending) |

If remote is missing any of 001–027, or already shows 028/029, **stop** and investigate. Do not repair history from this runbook.

---

## 5. Remote schema conflict check

Read-only:

```bash
npx supabase db diff --linked --schema public
```

Interpret carefully:

- Shadow applies **all** local migrations (including 028/029).
- Remote through 027 has **no** `scope_discovery_*` objects.
- Diff may show DROP of `scope_discovery_*` when comparing shadow→remote — that means remote lacks them (expected). **Do not apply that DROP SQL.**
- Confirm no *unrelated* destructive changes are required (no drop of `projects`, `work_areas`, Facts, commercial tables).
- Confirm proposed names are free on remote:  
  `scope_discovery_runs`, `scope_discovery_suggestions`, `scope_discovery_decisions`,  
  `accept_scope_discovery_suggestion`, `reject_scope_discovery_suggestion`,  
  `modify_accept_scope_discovery_suggestion`, and 028/029 helper/trigger function names.

**2026-08-06 inspection result:** History aligned through 027; 028/029 local-only; no remote name collision; no unexplained conflict objects. Diff noise limited to pending scope-discovery objects plus known helper redefine cosmetic drift (`auth_org_id`, pricing/quote org-match helpers).

---

## 6. Dry-run or diff review

1. Re-read 028 and 029 SQL end-to-end.
2. Confirm additive-only: CREATE TABLE / INDEX / FUNCTION / POLICY / GRANT; no ALTER of Facts/estimates/pricing/quotes; no Analyse Job objects.
3. Confirm 029 depends on 028 tables.
4. Optional: apply on a disposable branch/clone first if available.
5. Do **not** use `db diff` output as the apply script — apply the numbered migration files.

---

## 7. Apply 028

Owner-approved only:

```bash
# Preferred: push pending migrations in order (028 then 029 if both pending)
npx supabase db push
```

If applying one-at-a-time is required by policy, push after isolating commits, or apply via Supabase SQL editor **only** with the exact file contents of `028_scope_discovery_persistence.sql`, then mark history accordingly — prefer CLI push to keep history aligned.

Record: start time, end time, operator, project ref.

---

## 8. Verify 028 objects

On remote (SQL editor or `psql` via linked connection):

```sql
-- Tables
select tablename from pg_tables
where schemaname = 'public'
  and tablename in (
    'scope_discovery_runs',
    'scope_discovery_suggestions',
    'scope_discovery_decisions'
  )
order by 1;

-- RLS enabled
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname like 'scope_discovery_%';

-- Partial unique indexes
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in (
    'scope_discovery_runs_active_idempotency_uidx',
    'scope_discovery_decisions_one_accept_uidx'
  );

-- No anon grants
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'scope_discovery_%'
  and grantee = 'anon';
```

Expect: three tables; RLS on; both indexes; zero anon rows.

Also confirm `migration list` shows 028 on remote (and 029 still pending if applied separately).

---

## 9. Apply 029

After 028 verified:

```bash
npx supabase db push
```

(or apply exact `029_scope_discovery_acceptance_rpc.sql` content if one-at-a-time).

---

## 10. Verify RPC / grants

```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'accept_scope_discovery_suggestion',
    'reject_scope_discovery_suggestion',
    'modify_accept_scope_discovery_suggestion',
    'scope_discovery_require_auth_org',
    'scope_discovery_decision_fail',
    'scope_discovery_supported_work_area_type'
  )
order by 1;

-- EXECUTE grants: authenticated + service_role only
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name like '%scope_discovery%'
order by 1, 2;

select indexname from pg_indexes
where schemaname = 'public'
  and indexname = 'scope_discovery_decisions_one_scope_create_uidx';
```

Expect: six functions; no anon EXECUTE; scope-create unique index present.

---

## 11. Same-org smoke checks

Using a real Preview org user (authenticated client / service role as server would):

1. Insert a `RUNNING` then complete a minimal run row for a owned project (or use local persistence adapters against Preview only if explicitly authorised).
2. Insert one suggestion under that run.
3. Call `accept_scope_discovery_suggestion` → one confirmed Work Area + one ACCEPT decision.
4. Call `reject_scope_discovery_suggestion` on a second suggestion → REJECT, no WA.
5. Confirm suggestion payload columns unchanged after decisions.

Prefer the existing local verify scripts’ scenarios as a checklist; do not invent Facts.

---

## 12. Cross-org denial checks

1. Authenticated user A must not SELECT org B discovery rows (RLS).
2. ACCEPT/REJECT/MODIFY against another org’s suggestion_id must fail as `SUGGESTION_NOT_FOUND` / `FOREIGN_OR_MISSING` (not leak existence).
3. Anon must not EXECUTE decision RPCs.

---

## 13. Immutability checks

1. Terminal run: attempt to change `source_snapshot` → rejected.
2. Suggestion: attempt to change `evidence` / title → rejected.
3. Decision: UPDATE/DELETE → rejected by trigger (and no authenticated UPDATE/DELETE grants on decisions).

---

## 14. Duplicate acceptance check

1. ACCEPT same suggestion twice → second fails (`ALREADY_SCOPE_CREATED` / `ALREADY_ACCEPTED`).
2. Concurrent ACCEPT vs MODIFY → at most one Work Area (partial unique `scope_discovery_decisions_one_scope_create_uidx`).

---

## 15. No Analyse Job / UI adoption confirmation

After apply:

- No UI exposes discovery actions.
- `saveBriefAndSeedWorkAreas` / Analyse Job path unchanged.
- Feature flag remains off (or unimplemented → effectively off).
- No production Work Areas created except deliberate smoke rows that are deleted or left on disposable Preview projects only.

---

## 16. Rollback before data

If **no** discovery rows / no discovery-created Work Areas:

```sql
-- 029 first
drop function if exists public.accept_scope_discovery_suggestion(uuid, uuid, text, text, text);
drop function if exists public.modify_accept_scope_discovery_suggestion(uuid, uuid, text, text, text, text, text, text);
drop function if exists public.reject_scope_discovery_suggestion(uuid, uuid, text, text, text);
drop function if exists public.scope_discovery_require_auth_org();
drop function if exists public.scope_discovery_decision_fail(text);
drop function if exists public.scope_discovery_supported_work_area_type(text);
drop index if exists public.scope_discovery_decisions_one_scope_create_uidx;

-- 028
drop table if exists public.scope_discovery_decisions cascade;
drop table if exists public.scope_discovery_suggestions cascade;
drop table if exists public.scope_discovery_runs cascade;
-- then drop leftover 028 trigger functions if orphaned
drop function if exists public.set_scope_discovery_runs_updated_at();
drop function if exists public.enforce_scope_discovery_suggestion_run_match();
drop function if exists public.enforce_scope_discovery_decision_match();
drop function if exists public.enforce_scope_discovery_run_refs_match();
drop function if exists public.enforce_scope_discovery_run_immutability();
drop function if exists public.enforce_scope_discovery_suggestion_immutability();
drop function if exists public.enforce_scope_discovery_decision_append_only();
```

Then repair migration history only with an explicit owner-approved history procedure (out of scope of casual rollback). Prefer reverting via a new forward migration in production practice.

---

## 17. Rollback after data

**Do not** drop tables with customer decisions / discovery-created Work Areas.

1. Disable `SCOPE_DISCOVERY_ENABLED` (feature off).
2. Preserve runs, suggestions, decisions, and any Work Areas already created.
3. Analyse Job continues as today.
4. Destructive drop requires separate owner approval and data export.

---

## 18. Sign-off template

| Field | Value |
| --- | --- |
| Target project ref | |
| Environment (Preview / Production) | |
| Commit SHA | |
| Operator | |
| Backup / PITR confirmed | ☐ |
| Migration list pre-check (001–027 remote; 028/029 pending) | ☐ |
| Conflict / diff reviewed (no apply of DROP diff) | ☐ |
| Owner approval #1 (028) | ☐ date: |
| Owner approval #2 (029) | ☐ date: |
| 028 applied at | |
| 028 verified | ☐ |
| 029 applied at | |
| 029 verified | ☐ |
| Same-org smoke | ☐ |
| Cross-org denial | ☐ |
| Immutability | ☐ |
| Duplicate accept | ☐ |
| Analyse Job / UI still unchanged | ☐ |
| Feature flag still off | ☐ |
| Result | Pass / Fail / Aborted |
| Notes | |

---

## Residual note (non-blocking)

028 trigger functions use fully-qualified `public.*` relations but do **not** set `search_path = public` (unlike 029 RPCs). Accepted residual aligned with several existing Stage 2A triggers; optional hardening may be a follow-up migration if owner requires explicit `SET search_path` on all new trigger functions before production.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_3_1B_REMOTE_MIGRATION_028_029_RUNBOOK.md` |
| Created | 2026-08-06 |
| Executed | **No** |
