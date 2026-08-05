# Stage 3.1B.4B — Scope Discovery Persistence Architecture

**Status:** Planning complete — **Migration Not Approved**  
**Date:** 2026-08-05  
**Batch:** Stage 3.1B.4B-0 (architecture & security gate only)  
**Next migration number (reserved):** `028` — **Do not create until owner approval**  
**Supersedes / refines:** `docs/specifications/SCOPE_DISCOVERY_PERSISTENCE_PROPOSAL.md`  
**Related:** orchestration `docs/implementation/STAGE_3_1B4A_DISCOVERY_ORCHESTRATION_COMPLETION.md`; integrity patterns `supabase/migrations/023_*`, `025_*`, `026_*`

This document finalises the **minimum durable persistence model** for Intelligent Scope Discovery. It does **not** authorise SQL, migrations, or production wiring.

---

## 1. Design principles (binding)

1. Runs are append-oriented historical records.
2. Original suggestion payloads are immutable after creation.
3. User decisions are append-only events.
4. Accepted Work Areas and authoritative Facts remain **outside** discovery persistence (Fact SoT / WA lifecycle unchanged).
5. Discovery references accepted scope; it does not own it.
6. Rejected suggestions remain suppressible until material source change (OCD-ISD-03).
7. Idempotency is enforced in the database where practical.
8. RLS protects every table.
9. Child records must match parent project and organisation (`enforce_child_project_org_match` pattern from 025).
10. Service-role access remains server-only.
11. No anon table DML (align with 026).
12. No secrets or raw prompt/customer dumps.
13. No commercial totals, rates, margins, or GST.
14. Provider/model changes never rewrite old records (OCD-ISD-16).
15. Prefer the smallest model that preserves correctness.

**Column naming:** Use `org_id` (not `organisation_id`) to match Quotr project-child tables and `auth_org_id()`.

---

## 2. Recommended MVP table model

**Three tables.** Do **not** create `scope_discovery_evidence` in MVP.

| Table | Keep in MVP? | Rationale |
| --- | --- | --- |
| `scope_discovery_runs` | **Yes** | Idempotency, snapshot, provider metadata, run status |
| `scope_discovery_suggestions` | **Yes** | Immutable proposal payload + current lifecycle status |
| `scope_discovery_decisions` | **Yes** | Append-only accept/reject/modify history |
| `scope_discovery_evidence` | **No (MVP)** | Evidence remains validated JSONB on the immutable suggestion payload; separate table only if product later needs filter/query by source type |

This is smaller than a four-table model, preserves auditability, and avoids premature join complexity.

---

## 3. Table specifications

### 3.1 `scope_discovery_runs`

| Aspect | Design |
| --- | --- |
| **Purpose** | One discovery attempt (or reuse pointer) per project analysis |
| **Authoritative owner** | Project (tenant: organisation via `org_id`) |
| **org_id** | `uuid NOT NULL` → `organisations(id)` ON DELETE CASCADE |
| **project_id** | `uuid NOT NULL` → `projects(id)` ON DELETE CASCADE |
| **Primary key** | `id uuid` (runId) |
| **Parent FKs** | `org_id`, `project_id`; optional `reused_run_id`, `superseded_run_id` → self |
| **Immutable after terminal status** | `idempotency_key`, `source_fingerprint`, `source_snapshot`, contract/catalogue/prompt/orchestration versions, `trigger`, `analysis_objective`, `requested_by_user_id`, `started_at` |
| **Mutable (limited)** | While non-terminal: `status`, `updated_at`, `completed_at`, latency/token fields, `failure_*`, `provider_*` flags/metadata; after terminal: **no** mutation of identity/snapshot/versions (status may only soft-archive if owner approves soft-delete) |
| **Timestamps** | `started_at`, `completed_at`, `created_at`, `updated_at` |
| **Status** | Align with orchestration: `RUNNING`, `COMPLETED`, `COMPLETED_WITH_WARNINGS`, `FAILED_VALIDATION`, `FAILED_DETERMINISTIC`, `FAILED_PROVIDER`, `FAILED_MERGE`, `REUSED`, `CANCELLED` (omit ephemeral `VALIDATED` unless useful) |
| **Unique constraints** | See §5 Idempotency |
| **Indexes** | `(org_id, project_id, created_at DESC)`; `(project_id, idempotency_key)`; `(project_id, status)` |
| **Deletion / retention** | No hard delete in normal use; optional `archived_at` soft-archive (owner gate); retain at least while project active |
| **RLS** | `org_id = auth_org_id()` — see §6 |
| **Service-role** | Server workflows only (orchestration persist); never browser |
| **Audit** | Prefer decision table + run metadata; no raw provider dumps |

**Logical columns (normal):** `id`, `org_id`, `project_id`, `trigger`, `status`, `idempotency_key`, `source_fingerprint`, `contract_version`, `catalogue_version`, `prompt_version`, `orchestration_version`, `provider_called`, `provider_repair_attempted`, `token_input`, `token_output`, `latency_ms`, `reused_run_id`, `superseded_run_id`, `failure_code`, `failure_message`, `requested_by_user_id`, `analysis_objective`, timestamps.

**JSONB:** `source_snapshot` (material revisions only), `provider_metadata` (provider, model, request_id, prompt version — **no secrets**), optional `warnings` (capped array).

---

### 3.2 `scope_discovery_suggestions`

| Aspect | Design |
| --- | --- |
| **Purpose** | Immutable proposal as emitted for a run; current status for UI/lifecycle |
| **Authoritative owner** | Run (and project/org denormalised for RLS/integrity) |
| **org_id / project_id** | Required; must match parent run |
| **Primary key** | `id uuid` (suggestionId) |
| **Parent FKs** | `run_id` → `scope_discovery_runs(id)` ON DELETE CASCADE; `org_id`, `project_id` |
| **Immutable fields** | Payload: kind, type, titles, confidence, confidence_band, rationale, catalogue_edge_id, origin, evidence JSONB, missing_information, dependency/conflict refs, source_snapshot copy, provider_metadata, identity_key, versions at emit |
| **Mutable (limited)** | `status`, `stale_reason`, `superseded_by_suggestion_id`, `updated_at`, optional `latest_decision_id` pointer — **never** overwrite payload/evidence |
| **Timestamps** | `created_at`, `updated_at` |
| **Status** | `PROPOSED`, `ACCEPTED`, `REJECTED`, `MODIFIED`, `SUPERSEDED`, `STALE`, `FAILED` (contract-aligned) |
| **Unique constraints** | `UNIQUE (run_id, identity_key)` for active proposal uniqueness within a run; PK on `id` |
| **Indexes** | `(run_id)`; `(project_id, status)`; `(project_id, identity_key)`; `(org_id, project_id)` |
| **Deletion** | Cascade with run; no client DELETE in normal product path |
| **RLS** | Org-scoped; see §6 |
| **Related WA** | `related_work_area_id` nullable UUID **reference only** — no ownership of Work Areas |

---

### 3.3 `scope_discovery_decisions`

| Aspect | Design |
| --- | --- |
| **Purpose** | Append-only user decision events (accept / reject / modify) |
| **Authoritative owner** | Suggestion (project/org denormalised) |
| **org_id / project_id** | Required; must match suggestion |
| **Primary key** | `id uuid` |
| **Parent FKs** | `suggestion_id` → suggestions; `org_id`, `project_id`; optional `resulting_work_area_id` → `work_areas(id)` SET NULL |
| **Immutable** | Entire row after insert (append-only) |
| **Mutable** | **None** under normal use |
| **Timestamps** | `decided_at`, `created_at` |
| **Status** | N/A — `decision_type` ∈ `accept` \| `reject` \| `modify` |
| **Unique constraints** | Soft uniqueness via application + optional exclusion: at most one **active** accept per suggestion (partial unique where `decision_type = 'accept'` AND `superseded_by_decision_id IS NULL`) — owner gate on exact shape |
| **Indexes** | `(suggestion_id, decided_at)`; `(project_id, identity_key)`; `(org_id, project_id)` |
| **Deletion** | No hard delete; corrections = new rows |
| **RLS** | Org SELECT/INSERT; no UPDATE/DELETE for authenticated clients |

---

### 3.4 Evidence (not a table in MVP)

Evidence stays as **validated JSONB** on `scope_discovery_suggestions.evidence`, matching the 3.1B.1 contract (capped excerpts, sourceType, sourceId, provenance, authoritative flag).

**Why not separate rows in MVP:**

- Evidence is part of the immutable proposal identity for audit.
- Query-by-source-type is not a P0 product need.
- Fewer RLS/integrity surfaces.

**Future:** add `scope_discovery_evidence` only if Evidence Engine / DNA needs cross-suggestion analytics (aligns with deferred D-S4 spirit — still not DNA writes).

---

## 4. Append-only and immutability model

| Record | Classification | Rules |
| --- | --- | --- |
| **Runs (in-flight)** | Update-limited | Status, metrics, completion fields only |
| **Runs (terminal)** | Immutable identity | Snapshot, fingerprint, versions, objective, trigger frozen; no rewrite on model upgrade |
| **Suggestions (payload)** | Immutable after insert | Original proposal never overwritten |
| **Suggestions (lifecycle)** | Update-limited | Status / stale / supersede pointers only |
| **Decisions** | Append-only | New event per correction; never UPDATE decision body |
| **Soft-delete** | Optional `archived_at` on runs (owner gate) | Prefer archive over hard DELETE |
| **Hard delete** | Not normal use | Cascade only with project/org destruction |

### Supersession / staleness

**Controlled combination:**

- **Run level:** `superseded_run_id` on the newer run; prior run remains readable and immutable.
- **Suggestion level:** `status` ∈ `STALE` \| `SUPERSEDED` + `stale_reason` / `superseded_by_suggestion_id` updated via controlled server path.
- **Derived reads:** UI may also compare current source fingerprint to run fingerprint (orchestration `evaluateStaleRun`) without mutating history.

Do **not** rely on unrestricted client UPDATE policies for these transitions.

---

## 5. Idempotency and concurrency

### 5.1 Database constraints (recommended)

| Concern | Mechanism |
| --- | --- |
| One in-flight run per key | **Partial unique index:** `UNIQUE (project_id, idempotency_key) WHERE status = 'RUNNING'` |
| Reusable completed identity | Application selects latest terminal success with same `idempotency_key`; optional non-unique index `(project_id, idempotency_key) WHERE status IN ('COMPLETED','COMPLETED_WITH_WARNINGS','REUSED')` |
| Duplicate provider calls | Insert `RUNNING` row first under partial unique; loser fails insert → reuse/wait; only winner calls provider |
| Failed-run retry | New run row (new `id`) with same key allowed because prior is not `RUNNING`; link via `superseded_run_id` / retry metadata |
| Material source change | New fingerprint → new idempotency key → new run |
| Suggestion identity within run | `UNIQUE (run_id, identity_key)` |
| Duplicate acceptance | Partial unique on decisions for active accept **or** transactional check in accept RPC |

### 5.2 Race: two simultaneous Analyse requests

1. Both compute same idempotency key.  
2. Both attempt `INSERT … status='RUNNING'`.  
3. One succeeds; other hits unique violation.  
4. Loser: read winner; if still `RUNNING`, return controlled `DUPLICATE_IN_FLIGHT` / wait policy; if completed, `REUSE`.  
5. **No distributed lock required** beyond partial unique + transactional insert.

Provider must not be called until `RUNNING` row is committed.

---

## 6. Organisation and project integrity

| Rule | Enforcement |
| --- | --- |
| Every row has `org_id` + `project_id` | NOT NULL + FKs |
| `run.org_id` = `projects.org_id` for `run.project_id` | BEFORE INSERT/UPDATE trigger: reuse `public.enforce_child_project_org_match()` (migration 025) |
| Suggestion org/project = parent run | Trigger: load run by `run_id`; require match |
| Decision org/project = parent suggestion | Trigger: load suggestion; require match |
| Client must not trust supplied `org_id` | Server actions derive `org_id` from `profiles` / `auth_org_id()` |

Do **not** invent a second `auth_org_id()` — reuse existing SECURITY DEFINER helper (migration 001).

---

## 7. RLS design (intent)

Reuse pattern: `using (org_id = public.auth_org_id())` / `with check (org_id = public.auth_org_id())`.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| **runs** | Org members | Org members (server-preferred) | Org members **but** DB trigger rejects immutable-field changes when terminal | **No** authenticated DELETE (or owner-only archive later) |
| **suggestions** | Org members | Org members (with run) | Org members for status/stale fields only; trigger blocks payload mutation | **No** client DELETE |
| **decisions** | Org members | Org members | **No** | **No** |

**Anon:** no table grants (026 model).  
**Service role:** server-only; still subject to application discipline (BYPASSRLS exists — never expose to client).  
**Defence in depth:** RLS + immutability triggers + server actions for lifecycle.

Completed-run / suggestion payload immutability: **triggers preferred** over relying on RLS alone (RLS cannot easily express column-level freeze).

---

## 8. JSONB versus normal columns

| Field | Storage | Validation |
| --- | --- | --- |
| IDs, org_id, project_id, statuses, kinds, versions, keys, fingerprints, confidence_band, timestamps, related_work_area_id | **Columns** | CHECK enums; FKs; indexes |
| `source_snapshot` | **JSONB** | App Zod (orchestration snapshot) before write; optional CHECK for required keys |
| `provider_metadata` | **JSONB** | Allowlist keys only; reject secrets |
| `evidence`, `missing_information` | **JSONB** | 3.1B.1 Zod before insert; size caps |
| `warnings` | **JSONB** array or `text[]` | Cap count/length |
| Token usage | **Columns** (`token_input`, `token_output`) | Non-negative ints |

JSONB must not hide ownership or lifecycle — those stay columns.

---

## 9. Data minimisation and retention

### Must not persist

- API keys / secrets  
- Raw unbounded provider prompts/responses (MVP default: **discard after validation**)  
- Full unrelated DB dumps  
- Raw error objects / stacks  
- Attachments / photo bytes  
- Commercial data (rates, margins, GST, totals, quote ids)  
- Company DNA rules  

### Persist

- Validated canonical suggestions  
- Version pins + usage/latency metadata  
- Safe failure codes/messages  
- Decision events  

### Retention (recommended MVP pending owner)

- Retain while project exists.  
- Soft-archive runs after product-defined inactivity (TBD).  
- Account deletion: out of scope (document only).

---

## 10. Accept / reject / modify integration (future — do not implement)

### Accept

1. Verify suggestion `PROPOSED` (or eligible) in org/project.  
2. In one **DB transaction** (recommended RPC or server action with transaction):  
   - INSERT decision `accept`;  
   - CREATE Work Area via existing authenticated WA lifecycle;  
   - UPDATE suggestion status → `ACCEPTED` + `resulting_work_area_id` on decision;  
3. Must **not** fabricate Facts.  
4. Prevent double accept via unique/active-accept constraint + status check.

### Reject

1. INSERT decision `reject` with rationale.  
2. UPDATE suggestion → `REJECTED`.  
3. Suppression uses `identity_key` + source snapshot (OCD-ISD-03).  
4. No DNA / Company Defaults write.

### Modify

1. Preserve original suggestion payload.  
2. INSERT decision `modify` with modified fields.  
3. Create corrected Work Area through existing lifecycle.  
4. UPDATE suggestion status → `MODIFIED` (payload unchanged).  
5. User correction is provenance only.

**Atomicity:** Accept (and modify-with-WA) **should** use a single transaction / SECURITY DEFINER RPC so WA creation and decision cannot diverge. Exact RPC is an **owner gate** (see approval register).

---

## 11. Migration safety plan

| Item | Value |
| --- | --- |
| **Number** | `028_scope_discovery_persistence.sql` (after `027_remote_baseline_reconciliation.sql`) |
| **Scope** | Tables, FKs, CHECKs, partial unique indexes, RLS enable + policies, integrity triggers (reuse `enforce_child_project_org_match` + suggestion/run match), restricted grants, comments, verification SQL |
| **Must not** | Backfill fake history; mutate projects/facts/estimates/pricing/quotes; add commercial columns; touch Analyse Job |
| **Local-first** | Apply on Docker local only until Preview owner gate |
| **Remote** | Explicit owner approval (same discipline as Stage 2A) |
| **Rollback before adoption** | Drop empty tables + policies (straightforward) |
| **Rollback after data** | Feature-flag off; **preserve data**; do not destructive-drop production history |

---

## 12. Relationship to Fact SoT and commercial engine

- Discovery persistence never becomes Fact SoT.  
- Accept may seed questions later via existing WA flows — not silent Fact invent.  
- No estimate/pricing/quote columns or formulas.  
- No Company DNA learning writes from decisions in this schema.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/architecture/STAGE_3_1B4B_PERSISTENCE_ARCHITECTURE.md` |
| Created | 2026-08-05 |
| SQL written | **No** |
| Status | Planning — Migration **Not Approved** |
