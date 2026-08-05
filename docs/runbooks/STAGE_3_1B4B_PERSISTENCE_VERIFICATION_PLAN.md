# Stage 3.1B.4B — Persistence Verification Plan

**Status:** Planning — execute only after migration is owner-approved and created  
**Date:** 2026-08-05  
**Architecture:** `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`  
**Security:** `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md`

This runbook describes **how** to verify a future `028` persistence migration. It does **not** create or apply that migration.

---

## 1. Safety gates (mandatory)

| Gate | Rule |
| --- | --- |
| Environment | **Local Docker Supabase only** for destructive reset / migration apply |
| Remote URL | **Refuse** if `SUPABASE_URL` / DB URL is non-local (not `localhost` / `127.0.0.1` / known local Docker) |
| Production | Never run reset or unverified migration against Preview/production without explicit owner command |
| Analyse Job | Verification must not require Analyse Job behaviour change |
| Data | Do not mutate real customer projects |

Recommended local check before any reset:

```text
Confirm SUPABASE_URL host is local.
Confirm migration 028 exists only after owner approval.
Confirm no production credentials in shell env for the session.
```

---

## 2. Prerequisites (when implementation is authorised)

1. Owner-approved `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md`.  
2. Migration file `supabase/migrations/028_…sql` created in a later batch.  
3. Local Supabase running.  
4. Seed users in **two** organisations for cross-org tests.

---

## 3. Test matrix

### 3.1 Migration reset and existence

| ID | Check | Expected |
| --- | --- | --- |
| V-01 | `supabase db reset` (local only) applies through 028 | Success |
| V-02 | Tables exist: `scope_discovery_runs`, `_suggestions`, `_decisions` | Present |
| V-03 | `scope_discovery_evidence` absent (MVP) | Absent |
| V-04 | Partial unique index on in-flight idempotency | Present |
| V-05 | `UNIQUE (run_id, identity_key)` on suggestions | Present |
| V-06 | FKs to `organisations`, `projects`, self-refs | Present |
| V-07 | RLS enabled on all three | `relrowsecurity = true` |
| V-08 | Comments on tables documenting immutability | Present |

### 3.2 Grants and anon

| ID | Check | Expected |
| --- | --- | --- |
| V-10 | `anon` has no DML on discovery tables | Denied |
| V-11 | `authenticated` has SELECT/INSERT (and limited UPDATE per design) | Granted |
| V-12 | `service_role` has DML | Granted |
| V-13 | No TRUNCATE grant to authenticated on these tables (prefer) | Align with 026 least privilege |

### 3.3 Same-org vs cross-org

| ID | Check | Expected |
| --- | --- | --- |
| V-20 | Org A user SELECT own runs | Allowed |
| V-21 | Org A user SELECT Org B runs | Empty / denied |
| V-22 | Org A INSERT with Org B `org_id` | Rejected (RLS and/or trigger) |
| V-23 | Org A INSERT with own org but foreign `project_id` | Rejected by org-match trigger |

### 3.4 Parent-child integrity

| ID | Check | Expected |
| --- | --- | --- |
| V-30 | Suggestion `org_id` ≠ parent run org | Rejected |
| V-31 | Decision `project_id` ≠ suggestion project | Rejected |
| V-32 | `enforce_child_project_org_match` on runs | Rejects org≠project.org |

### 3.5 Immutability

| ID | Check | Expected |
| --- | --- | --- |
| V-40 | UPDATE terminal run `source_snapshot` | Rejected by trigger |
| V-41 | UPDATE terminal run `idempotency_key` | Rejected |
| V-42 | UPDATE suggestion `evidence` / title / rationale | Rejected |
| V-43 | UPDATE suggestion `status` PROPOSED→REJECTED via allowed path | Allowed (server) |
| V-44 | UPDATE decision row | Denied (no policy / trigger) |

### 3.6 Decisions and acceptance

| ID | Check | Expected |
| --- | --- | --- |
| V-50 | INSERT reject decision | Allowed; suggestion status updated by server path |
| V-51 | Second accept on same suggestion | Rejected |
| V-52 | Append modify after reject | New decision row; history preserved |
| V-53 | Accept does not write Facts | No `project_facts` insert from discovery accept alone |

### 3.7 Idempotency / concurrency

| ID | Check | Expected |
| --- | --- | --- |
| V-60 | Two concurrent INSERT RUNNING same key | Exactly one succeeds |
| V-61 | Failed terminal + retry INSERT new RUNNING | Allowed |
| V-62 | Material fingerprint change → new key → new run | Allowed |
| V-63 | Completed reuse path does not insert second RUNNING | App behaviour + optional DB check |

### 3.8 Content / commercial / adoption guards

| ID | Check | Expected |
| --- | --- | --- |
| V-70 | Columns named rate/margin/gst/total absent | Absent |
| V-71 | Insert commercial key inside JSONB evidence | Rejected by app validation (and documented) |
| V-72 | Analyse Job still does not import orchestration/persistence | Static grep |
| V-73 | No UI routes reading discovery tables yet | Static grep until 3.1B.6 |

### 3.9 Accepted scope reference

| ID | Check | Expected |
| --- | --- | --- |
| V-80 | Suggestion may store `related_work_area_id` to existing WA | Allowed |
| V-81 | Deleting WA with SET NULL on decision.resulting_work_area_id | Decision retained; link nullified |
| V-82 | Discovery tables do not CASCADE-delete Work Areas | WA survives run delete only if FK direction correct (WA is not child of suggestion) |

---

## 4. Automated verification (future batch)

When implementation lands, add:

- `scripts/verify-stage-3-1b4b-persistence.ts` (static + optional local SQL via Docker), **or**  
- extend existing Stage 2A integrity verify patterns.

Must refuse non-local DB URLs for reset/apply helpers.

---

## 5. Sign-off checklist (post-implementation)

- [ ] All V-* checks recorded  
- [ ] Local-only confirmation logged  
- [ ] Owner Preview gate before remote apply  
- [ ] Analyse Job unchanged confirmed  
- [ ] No commercial columns confirmed  

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/runbooks/STAGE_3_1B4B_PERSISTENCE_VERIFICATION_PLAN.md` |
| Created | 2026-08-05 |
| Migration executed | **No** (plan only) |
