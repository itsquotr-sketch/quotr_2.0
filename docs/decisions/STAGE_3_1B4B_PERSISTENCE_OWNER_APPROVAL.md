# Stage 3.1B.4B — Persistence Owner Approval Register

**Status:** Approved for local implementation — **Remote apply still Not Approved**  
**Date:** 2026-08-05  
**Architecture:** `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`  
**Implementation:** `docs/implementation/STAGE_3_1B4B_PERSISTENCE_COMPLETION.md`  
**Migration:** `028_scope_discovery_persistence.sql` (local only)

---

## Decision register

| # | Decision | Approved rule | Status | Approved date |
| ---: | --- | --- | --- | --- |
| 1 | Final table count | Three MVP tables: `scope_discovery_runs`, `scope_discovery_suggestions`, `scope_discovery_decisions` | **Approved** | 2026-08-05 |
| 2 | Evidence storage | Validated capped JSONB on suggestions; no evidence table in MVP | **Approved** | 2026-08-05 |
| 3 | Decisions model | Append-only events; corrections = new rows | **Approved** | 2026-08-05 |
| 4 | Soft-delete | Runs may soft-archive (`archived_at`); suggestions/decisions not normally hard-deleted | **Approved** | 2026-08-05 |
| 5 | Raw provider output | Not persisted | **Approved** | 2026-08-05 |
| 6 | Idempotency | DB prevents duplicate active (`RUNNING`) runs; completed reuse application-controlled | **Approved** | 2026-08-05 |
| 7 | Completed-run immutability | Snapshot, fingerprints, versions, provider/model identity immutable after terminal | **Approved** | 2026-08-05 |
| 8 | Suggestion immutability | Original payload and evidence immutable | **Approved** | 2026-08-05 |
| 9 | Acceptance RPC | Future accept must use DB transaction/RPC (decision + WA + linkage). **Not implemented in 3.1B.4B** | **Approved** (design) | 2026-08-05 |
| 10 | Retention | Indefinite for MVP; account deletion deferred | **Approved** | 2026-08-05 |
| 11 | RLS | Existing org ownership + `auth_org_id()` | **Approved** | 2026-08-05 |
| 12 | Grants | No anon DML; least privilege; service_role server-only | **Approved** | 2026-08-05 |
| 13 | Migration number | `028_scope_discovery_persistence.sql` | **Approved** | 2026-08-05 |
| 14 | Local-only until Preview | Yes — local Docker only until later owner approval | **Approved** | 2026-08-05 |
| 15 | Rollback | Pre-adoption drop OK; after production data preserve + disable feature | **Approved** | 2026-08-05 |

### Additional approval

| ID | Decision | Status | Approved date |
| --- | --- | --- | --- |
| ORCH-POL-01 | Deterministic success + provider failure → `COMPLETED_WITH_WARNINGS` with deterministic suggestions preserved | **Approved** | 2026-08-05 |

---

## Explicit non-approvals (carry forward)

| Item | Status |
| --- | --- |
| Remote / Preview apply of migration 028 | **Not Approved** |
| Production Analyse Job adoption | **Not Started** |
| Accept/reject UI | **Not Started** |
| Acceptance RPC implementation | **Not Started** (design approved) |
| Company DNA writes | **Forbidden** |
| Commercial columns | **Forbidden** |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md` |
| Created | 2026-08-05 |
| Last updated | 2026-08-05 |
| Local implementation | Authorised |
| Remote apply | **Not Approved** |
