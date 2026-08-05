# Scope Discovery Persistence Proposal

**Status:** Proposed, **Not Approved**  
**Date:** 2026-08-05  
**Batch:** Stage 3.1B.4A (design deliverable only)  
**SQL / migrations:** **Do not write** until owner approval  
**Related:** `docs/implementation/STAGE_3_1B4A_DISCOVERY_ORCHESTRATION_COMPLETION.md`

This document proposes the **minimum** future persistence model for Intelligent Scope Discovery. It is **not** authorised for implementation.

---

## 1. Goals

Persist enough to support:

- discovery runs and idempotency;
- immutable historical proposal payloads;
- evidence references;
- user decisions (accept / reject / modify);
- source snapshots and fingerprints;
- latency / token metadata;
- stale / superseded links;
- org + project ownership with RLS.

Non-goals:

- Company DNA writes;
- commercial totals / rates / margins / GST;
- attachment / photo binary content;
- rewriting historical runs after provider upgrades (OCD-ISD-16).

---

## 2. Proposed tables (logical)

### 2.1 `scope_discovery_runs`

| Aspect | Proposal |
| --- | --- |
| **Purpose** | One analysis attempt / reuse record per project |
| **Org ownership** | `organisation_id` NOT NULL |
| **Project ownership** | `project_id` NOT NULL |
| **Lifecycle** | Insert on start; update status/timestamps/metrics; never delete silently — soft-archive or retain |
| **RLS** | Org members can select/insert/update own org rows; no cross-org |
| **Indexes** | `(organisation_id, project_id, created_at desc)`; unique `(project_id, idempotency_key)` where status in completed family **or** partial unique for in-flight |
| **Uniqueness / idempotency** | `idempotency_key` + project; in-flight unique constraint / advisory lock owned by application layer |
| **Retention** | Product default TBD (e.g. retain while project active); purge policy owner-gated |
| **Data minimisation** | Store snapshot hashes/revisions, not full customer dumps; brief text only if already project-owned and needed for audit — prefer revision pointers |
| **Migration risk** | Medium — new table + RLS |
| **Rollback** | Drop table if unused; feature flag off leaves Analyse Job unchanged |
| **Shape** | Normalised columns for status, versions, fingerprint, keys; JSONB for `source_snapshot` and `provider_metadata` |

**Suggested columns (logical):**

- `id` (uuid, PK) — runId  
- `organisation_id`, `project_id`  
- `trigger`, `status`  
- `idempotency_key`, `source_fingerprint`  
- `contract_version`, `catalogue_version`, `prompt_version`, `orchestration_version`  
- `source_snapshot` JSONB (material revisions only)  
- `provider_called`, `provider_repair_attempted`  
- `provider_metadata` JSONB (provider, model, request id — no secrets)  
- `token_input`, `token_output`, `latency_ms`  
- `reused_run_id`, `superseded_run_id`  
- `failure_code`, `failure_message` (safe messages only)  
- `requested_by_user_id`, `started_at`, `completed_at`, `created_at`, `updated_at`  
- `analysis_objective` (short text)

**Append-only vs mutable:**

- Immutable after `COMPLETED*` / `FAILED*` / `REUSED` / `CANCELLED`: snapshot, fingerprint, versions, proposal set linkage.  
- Mutable while `RUNNING`: status, completed_at, metrics only.

---

### 2.2 `scope_discovery_suggestions`

| Aspect | Proposal |
| --- | --- |
| **Purpose** | Immutable proposal payload at emit time + current status pointer |
| **Org / project** | Denormalised `organisation_id`, `project_id` + `run_id` FK |
| **Lifecycle** | Insert as `PROPOSED`; status transitions via decisions; payload frozen |
| **RLS** | Same org scope as runs |
| **Indexes** | `(project_id, status)`; `(run_id)`; `(project_id, identity_key)` |
| **Uniqueness** | `(run_id, suggestion_id)` PK; identity uniqueness enforced per active run in app |
| **Retention** | Follow run retention |
| **Minimisation** | No commercial fields; evidence excerpts capped |
| **Migration risk** | Medium–high (volume) |
| **Rollback** | Drop with runs |
| **Shape** | Normalised status/kind/confidence; JSONB for evidence array + missing_information |

**Suggested columns:**

- `id` (suggestion_id), `run_id`, `organisation_id`, `project_id`  
- `identity_key`, `suggestion_kind`, `proposed_work_area_type`, titles  
- `confidence`, `confidence_band`, `rationale_key`, `catalogue_edge_id`, `origin`  
- `status`  
- `evidence` JSONB  
- `dependency_references`, `conflict_references` (text[] or JSONB)  
- `missing_information` JSONB  
- `source_snapshot` JSONB (copy at emit)  
- `provider_metadata` JSONB nullable  
- `stale_reason`, `superseded_by_suggestion_id`  
- `created_at`, `updated_at`  

**Immutable historical proposal payload:** title/description/type/evidence/rationale frozen at insert. Modifications create decision rows + optionally a new derived suggestion id — do not overwrite original payload (OCD-ISD-01 / modify provenance).

---

### 2.3 `scope_discovery_decisions`

| Aspect | Proposal |
| --- | --- |
| **Purpose** | Append-only user accept / reject / modify records |
| **Org / project** | Required |
| **Lifecycle** | Insert-only preferred |
| **RLS** | Org scoped; write by authenticated member |
| **Indexes** | `(suggestion_id, decided_at)`; `(project_id, identity_key)` |
| **Uniqueness** | No silent overwrite; latest decision wins in application reads |
| **Retention** | Long-lived learning/evidence substrate — no DNA auto-write |
| **Minimisation** | Store reason codes + optional short user note; no commercial values |
| **Migration risk** | Low–medium |
| **Rollback** | Drop table |
| **Shape** | Normalised decision_type, user_id, timestamps; JSONB for modify fields |

**Columns:** `id`, `organisation_id`, `project_id`, `suggestion_id`, `identity_key`, `decision_type`, `decided_by_user_id`, `decided_at`, `reason_code`, `user_note`, `modified_*`, `resulting_work_area_id`, `source_revision`.

---

### 2.4 Evidence storage

**MVP recommendation:** evidence embedded as JSONB on suggestions (already capped excerpts).

**Future normalised table** `scope_discovery_evidence` only if querying/filtering by source type becomes a product requirement.

| Aspect | Proposal |
| --- | --- |
| **Purpose** | Cite brief/note/fact/constraint/WA/rule refs |
| **No attachment content** | Store reference ids only for future documents/photos |
| **Authoritative flag** | Mirror contract; AI excerpts never become Facts by persistence alone |

---

## 3. Cross-cutting rules

| Topic | Rule |
| --- | --- |
| **RLS** | Every table: `organisation_id` isolation; project membership checks consistent with existing Quotr patterns |
| **Idempotency** | Unique completed key per project; reject duplicate in-flight (app + DB constraint) |
| **Provider upgrades** | New run rows; never rewrite prior suggestion payloads (OCD-ISD-16) |
| **Stale/supersede** | Links via `superseded_run_id` / `superseded_by_suggestion_id`; accepted WAs/Facts untouched |
| **No DNA** | Decisions are provenance only — no Company Defaults mutation |
| **No commercial data** | Forbidden columns: rates, margins, GST, totals, quote ids |
| **Documents/photos** | Reference-only fields later; requires D-S6 Storage + DB RLS before content |

---

## 4. JSONB vs normalised

| Use JSONB | Use columns |
| --- | --- |
| Source snapshot structure | status, versions, fingerprint, org/project ids |
| Evidence list, missing_information | suggestion_kind, confidence_band, identity_key |
| Provider metadata | timestamps, token ints, latency |

---

## 5. Approval gate

| Item | Status |
| --- | --- |
| Persistence migration | **Proposed, Not Approved** |
| Table creation | **Not Approved** |
| RLS policies | **Not Approved** |
| Production wiring | **Not Started** |

Owner must approve schema + RLS review before any SQL migration.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/SCOPE_DISCOVERY_PERSISTENCE_PROPOSAL.md` |
| Created | 2026-08-05 |
| SQL written | **No** |
