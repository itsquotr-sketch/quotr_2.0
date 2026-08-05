# Scope Discovery Persistence Proposal

**Status:** Refined by Stage 3.1B.4B-0 — **Migration Still Not Approved**  
**Date:** 2026-08-05  
**Batch origin:** Stage 3.1B.4A (initial proposal)  
**Architecture gate:** Stage 3.1B.4B-0 — `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`  
**Owner approval:** `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md` (all Pending)  
**SQL / migrations:** **Do not write** until owner approval  

This document remains the product-facing summary. The **authoritative design** for implementation is the 3.1B.4B architecture + security review. Do not treat this file alone as approval to create SQL.

---

## 1. Goals

Persist enough to support:

- discovery runs and idempotency;
- immutable historical proposal payloads;
- evidence references (as JSONB in MVP);
- user decisions (accept / reject / modify);
- source snapshots and fingerprints;
- latency / token metadata;
- stale / superseded links;
- org + project ownership with RLS.

Non-goals:

- Company DNA writes;
- commercial totals / rates / margins / GST;
- attachment / photo binary content;
- rewriting historical runs after provider upgrades (OCD-ISD-16);
- separate evidence table in MVP.

---

## 2. Recommended MVP table model (3.1B.4B-0)

**Three tables** using Quotr-standard `org_id`:

| Table | Role |
| --- | --- |
| `scope_discovery_runs` | Analysis attempt; snapshot; idempotency; provider metadata |
| `scope_discovery_suggestions` | Immutable proposal + limited status/stale fields |
| `scope_discovery_decisions` | Append-only accept/reject/modify events |

**Evidence:** validated JSONB on suggestions — **not** a fourth table in MVP.

**Reserved migration number:** `028` (after `027_remote_baseline_reconciliation.sql`) — **Not created**.

See architecture doc for full column, RLS, trigger, and immutability detail.

---

## 3. Cross-cutting rules

| Topic | Rule |
| --- | --- |
| **RLS** | `org_id = auth_org_id()`; no anon DML |
| **Integrity** | Reuse `enforce_child_project_org_match`; child must match parent run/suggestion |
| **Idempotency** | Partial unique on `RUNNING` per `(project_id, idempotency_key)` |
| **Provider upgrades** | New runs only; never rewrite suggestion payloads |
| **No DNA** | Decisions are provenance only |
| **No commercial data** | Forbidden columns and JSONB keys |
| **Documents/photos** | Reference-only later; requires D-S6 |

---

## 4. Approval gate

| Item | Status |
| --- | --- |
| Architecture / security gate (3.1B.4B-0) | **Complete — Planning** |
| Owner decisions #1–#15 | **Pending** |
| Persistence migration `028` | **Not Approved** |
| Table creation | **Not Approved** |
| Production wiring | **Not Started** |
| Analyse Job | **Unchanged** |

---

## 5. Related documents

- `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md`
- `docs/security/STAGE_3_1B4B_PERSISTENCE_SECURITY_REVIEW.md`
- `docs/runbooks/STAGE_3_1B4B_PERSISTENCE_VERIFICATION_PLAN.md`
- `docs/decisions/STAGE_3_1B4B_PERSISTENCE_OWNER_APPROVAL.md`
- `docs/implementation/STAGE_3_1B4B0_PERSISTENCE_GATE_COMPLETION.md`

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/SCOPE_DISCOVERY_PERSISTENCE_PROPOSAL.md` |
| Created | 2026-08-05 |
| Last updated | 2026-08-05 (3.1B.4B-0 gate) |
| SQL written | **No** |
