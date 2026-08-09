# Stage 3.1C.3-R2D.2 — Remote Migration 033 Apply Completion

**Status:** Migration 033 — **Applied and Verified Remote**  
**Date:** 2026-08-10  
**Target:** Linked Supabase `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Migration:** `033_calibration_responses.sql`  
**Application behaviour in this gate:** **Unchanged**  
**R2D.1 Persistence:** **Complete**  
**Calibration Preview E2E:** **Pending Owner Test**  
**R2E:** Ready Next after Preview evidence  
**Company DNA:** Not Started  
**Stage 3.2:** Not Started  
**Production Scope Discovery:** Disabled

---

## 1. Linked remote target

| Field | Value |
| --- | --- |
| Project name | `quotr_2.0` |
| Project ref | `lxvnylhsbvudzzupxeqr` |
| Region | `ap-northeast-1` |
| Status | `ACTIVE_HEALTHY` |
| Linked | `true` |

Inactive legacy project `quotr` (`vwejrzdguuzxdgrvcnox`, `INACTIVE`, `linked=false`) was **not** targeted.

## 2. Migration history before

| Version | Local | Remote |
| --- | --- | --- |
| 001–032 | Present | Present |
| 033 | Present | **Absent** |

No other mismatch → gate continued.

## 3. SQL / security audit

| Check | Result |
| --- | --- |
| Table scope | `calibration_responses` only |
| Additive | Yes — create table/indexes/triggers/function/policies/grants |
| Destructive DDL | None (no DROP TABLE/COLUMN, TRUNCATE, rewrite) |
| Rates/projects/pricing/quotes/facts | Untouched |
| Non-negative commercial checks | Yes; zero permitted |
| Confidence allow-list | `low\|medium\|high` |
| JSONB bounded | engine_snapshot ≤32KB; response_metadata ≤8KB |
| One active per org+scenario | Partial unique index |
| Evidence immutable | Trigger `protect_calibration_response_evidence` |
| Supersede-only UPDATE | status → superseded + superseded_at |
| RPC | `save_calibration_response` |
| SECURITY | **INVOKER** (`prosecdef=false` remote) |
| Identity | `auth.uid()` + `auth_org_id()` — no client org_id |
| Concurrency | `pg_advisory_xact_lock(87230133, …)` |
| Atomic supersede+insert | Single function transaction |

## 4. Grant / RLS audit

Intended (033 SQL, lessons from 030/031):

| Role | Table DML | RPC EXECUTE |
| --- | --- | --- |
| anon | none | false |
| authenticated | SELECT, INSERT, UPDATE | true |
| service_role | SELECT, INSERT, UPDATE, DELETE | true |

Remote verified:

| Check | Result |
| --- | --- |
| authenticated | INSERT,SELECT,UPDATE |
| service_role | DELETE,INSERT,SELECT,UPDATE |
| anon table grants | **none** |
| anon EXECUTE | **false** |
| authenticated/service EXECUTE | **true** |
| RLS enabled | **true** |
| Policies | **3** (select/insert/update; no delete) |

033 already `REVOKE ALL` then narrow `GRANT` (same pattern as 028/031). No deferred ACL fix required.

## 5. Tenant integrity

- Org from `auth_org_id()`; insert requires `created_by = auth.uid()`.
- RLS `org_id = auth_org_id()` on SELECT/INSERT/UPDATE.
- RPC never accepts org_id / user_id arguments.
- Cross-org spoof blocked by RLS + auth-derived org.

## 6. Authority isolation

033 creates calibration storage only. Does not alter rate resolution, estimate/pricing/quote formulas, Facts, or Scope Discovery objects. Calibration remains evidence — not live rate authority.

## 7. Dry-run

```text
npx supabase db push --dry-run --linked
→ Would push these migrations:
  • 033_calibration_responses.sql
```

**033 only.** No unrelated migrations / history repair / destructive diff.

## 8. Remote apply

```text
npx supabase db push --linked --yes
→ Applying migration 033_calibration_responses.sql... OK
```

No remote reset. No history repair.

## 9. History after

| Version | Local | Remote |
| --- | --- | --- |
| 001–033 | Present | Present |

## 10. Remote object verification

| Object | Result |
| --- | --- |
| `calibration_responses` | exists |
| RLS | enabled |
| `calibration_responses_one_active_per_scenario` | present |
| `save_calibration_response` | present; INVOKER; `search_path=public` |
| Triggers | 2 (updated_at + protect evidence) |
| Grants | match intended model |

## 11. Existing-data safety (post-apply counts)

| Table | Count |
| --- | --- |
| organisations | 5 |
| profiles | 5 |
| work_areas | 132 |
| rates | 9 |
| pricing_documents | 10 |
| quotes | 15 |
| scope_discovery_runs | 12 |
| calibration_responses | **0** (empty — expected) |

No customer data rewritten by apply.

## 12. Calibration save / recalibrate remote test

**Not executed in this gate.**

Reason: controlled authenticated Preview smoke requires **app deployment** with R2D.1 Save wiring. This batch does not change application behaviour and does not fabricate service-role calibration rows.

**Owner Preview E2E:** Pending — use `docs/runbooks/STAGE_3_1C3_R2D1_CALIBRATION_PERSISTENCE_PREVIEW_TEST.md` after Preview deploy includes R2D/R2D.1 code.

## 13. Status board

| Item | Status |
| --- | --- |
| Migration 033 | **Applied and Verified Remote** |
| R2D.1 Persistence | **Complete** |
| Calibration Preview E2E | **Pending Owner Test** |
| R2E | **Ready Next** after Preview evidence |
| Company DNA | Not Started |
| Stage 3.2 | Not Started |
| Production Scope Discovery | Disabled |

## 14. Exact owner Preview tests now required

1. Confirm Preview app build includes R2D/R2D.1 calibration Save (not gated).
2. Confirm Preview env → `lxvnylhsbvudzzupxeqr`.
3. Run `docs/runbooks/STAGE_3_1C3_R2D1_CALIBRATION_PERSISTENCE_PREVIEW_TEST.md` (Save, hub status, Recalibrate, dashboard tip, authority checks).
4. Optionally confirm one remote row after save; recalibrate leaves historical superseded row.
5. Then start **R2E** Preview polish only after evidence recorded.
