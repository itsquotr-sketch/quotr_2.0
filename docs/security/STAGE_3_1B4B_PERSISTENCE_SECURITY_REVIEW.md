# Stage 3.1B.4B — Persistence Security Review

**Status:** Planning — **Not Approved for implementation**  
**Date:** 2026-08-05  
**Architecture:** `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`  
**Baseline patterns:** `auth_org_id()` (001); parent/org triggers (023/025); grants (026)

---

## 1. Scope

Threat review for the proposed `scope_discovery_runs`, `scope_discovery_suggestions`, and `scope_discovery_decisions` tables prior to any migration.

Out of scope: implementing SQL, Analyse Job wiring, UI, Company DNA.

---

## 2. Threat register and mitigations

| # | Threat | Impact | Mitigation |
| ---: | --- | --- | --- |
| T1 | **Cross-org ID substitution** (attacker sets another org’s `org_id` / `project_id`) | Data leak / write into foreign tenant | RLS `org_id = auth_org_id()`; server derives `org_id` from profile; `enforce_child_project_org_match` rejects org≠project.org; never trust client org |
| T2 | **Forged suggestion IDs** on decision insert | Decision attached to wrong proposal | FK to suggestion; trigger ensures decision.org/project = suggestion; server loads suggestion by id **and** project before write |
| T3 | **Forged run IDs** on suggestion insert | Orphan / cross-project pollution | FK `run_id`; trigger ensures suggestion matches run org/project |
| T4 | **Duplicate acceptance** | Multiple WAs / inconsistent status | Status check + partial unique active-accept (or transactional RPC); WA create only inside same transaction |
| T5 | **Replayed rejection** | Noise / confused suppression | Append-only decisions allowed historically; application uses **latest** decision; suppression key = identity + snapshot rules (OCD-ISD-03) — replay of identical reject is idempotent no-op at app layer |
| T6 | **Provider-output injection** (malicious brief/notes → crafted JSON) | Bad suggestions / XSS if rendered raw | Treat model output as untrusted; Zod validate before persist; escape in UI; never `eval`; no HTML in stored excerpts without sanitisation at render |
| T7 | **JSONB payload abuse** (oversized / unexpected keys) | Storage DoS / smuggled commercial fields | Size caps; allowlisted keys; reject commercial keys (`assertNoCommercialFields`); CHECK or app validation |
| T8 | **Oversized payloads** | DB bloat / cost | Cap evidence excerpts, warnings count, snapshot fields; provider input limits already in 3.1B.3 |
| T9 | **Status manipulation** (client sets ACCEPTED without WA) | Bypass lifecycle | No broad UPDATE; trigger/RPC only allows status transitions from server; accept requires decision + WA transaction |
| T10 | **Evidence reference fabrication** | False provenance | Persist only after 3.1B.3 validation against allowed refs; do not re-trust client-edited evidence on update (evidence immutable) |
| T11 | **Idempotency collision** (two runs same key) | Double provider spend | Partial unique on `RUNNING`; insert-before-call; loser does not call provider |
| T12 | **Raw error leakage** | Secret/PII in client | Persist safe `failure_code` / `failure_message` only; never stack/provider raw body |
| T13 | **Direct client UPDATE of immutable records** | History rewrite | BEFORE UPDATE triggers freeze terminal run identity + suggestion payload columns; decisions: no UPDATE policy |
| T14 | **Service-role misuse** | Bypass RLS | Service role only on server; never in browser; least-privilege culture; audit server actions |
| T15 | **Anon table DML** | Unauthenticated access | No anon grants (026); verify in migration verification plan |
| T16 | **Soft delete / cascade abuse** | Mass wipe | No client DELETE on discovery tables in MVP; project delete cascades are intentional org lifecycle |
| T17 | **Stale accept after superseded run** | Apply obsolete proposal | Accept path checks suggestion not STALE/SUPERSEDED and run not superseded; optional fingerprint check |
| T18 | **DNA / commercial smuggling via notes fields** | Learning/commercial corruption | Schema forbids commercial columns; decisions are provenance only; no DNA writers in this batch |

---

## 3. RLS and grant posture

| Control | Intent |
| --- | --- |
| RLS enabled on all three tables | Defence in depth |
| Policies use `auth_org_id()` | Do not duplicate helper |
| Authenticated: SELECT/INSERT; limited UPDATE; no DELETE (MVP) | Matches architecture |
| Anon: no grants | Align 026 |
| Service role: server-only DML | Bootstrap/admin patterns only |

---

## 4. Immutability enforcement (security-relevant)

| Layer | Role |
| --- | --- |
| Application Zod + orchestration | First gate |
| RLS | Tenant isolation |
| Triggers | Freeze payload / terminal run fields; org match |
| No decision UPDATE policy | Append-only history |

---

## 5. Residual risks (accepted until implementation)

| Risk | Notes |
| --- | --- |
| Service role BYPASSRLS | Inherent to Supabase; mitigate operationally |
| Partial unique races under serializable anomalies | Extremely rare; document retry |
| Soft-archive semantics undecided | Owner gate |
| Accept RPC design undecided | Owner gate — until then risk of non-atomic accept if naively implemented |

---

## 6. Conclusion

The three-table MVP with JSONB evidence, append-only decisions, partial unique in-flight idempotency, org/project triggers, and no anon grants is **consistent with Stage 2A security posture**. Implementation remains **Not Approved** until owner signs the approval register.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md` |
| Created | 2026-08-05 |
