# Quotr Atomic Estimate Generation Contract

**Status:** CANONICAL for REQ-TXN-01 / REQ-TXN-01-R1  
**Date:** 2026-08-17  
**RPC:** `public.persist_estimate_generation_v1(jsonb)`  
**Migration:** `supabase/migrations/036_persist_estimate_generation_v1.sql` (**REMOTE APPLIED** on `quotr_2.0` / `lxvnylhsbvudzzupxeqr`)  
**Input contract:** `persist-estimate-generation-v1` (`PersistEstimateGenerationV1`)

This contract makes commercially authoritative estimate persistence safe. It does **not** promote any component, change line-item money, or change Pricing/Quote values.

---

## 1. Primary invariant

**Every successful persist through `persist_estimate_generation_v1` must persist, in one transaction:**

- estimate generation
- current estimate-line set
- immutable requirement/calculation snapshot
- matching `generation_id`
- latest snapshot linkage

This applies for `LEGACY_AUTHORITATIVE`, `SHADOW`, `REQUIREMENT_AUTHORITATIVE`, and mixed generations. There is **no snapshot-optional new atomic generation**.

Empty `requirements: []` is a valid snapshot. Do not invent fake requirements.

Historical/pre-036 rows with `latest_requirement_snapshot_id = NULL` remain valid. No backfill. The next successful RPC generation creates a snapshot.

If any required write fails, the previous completed commercial generation remains current. No partially persisted new generation may become authoritative.

---

## 2. Chosen architecture

**Postgres function / Supabase RPC**, `SECURITY INVOKER`, `search_path = public`.

One invocation receives a fully validated generation payload and performs the required writes in **one transaction**.

Application-level compensating rollback is not the primary safety mechanism.

Repo precedent: `save_calibration_response` (033) and scope-discovery acceptance RPCs (029).

---

## 3. Calculation vs persistence

| Phase | Where | Notes |
| --- | --- | --- |
| A. Calculation | `calculateEstimate` **before** persist | Expensive/deterministic work stays out of the DB transaction |
| B. Serialization / validation | `buildPersistEstimateGenerationV1` **before** persist | Snapshot JSON (always, including empty `requirements[]`) + line rows |
| C. Commercial persistence | `persist_estimate_generation_v1` | Estimate row + line replace + snapshot insert + pointer + `ready` |

Calculation failure: no RPC. Persistence failure: RPC rolls back. Errors are not converted into empty estimates.

---

## 4. Input (`PersistEstimateGenerationV1`)

```
{
  contractVersion: "persist-estimate-generation-v1",
  projectId,            -- uuid; org is NOT accepted from the client
  generationId,         -- uuid, required, unique
  componentAuthorities: [{ workAreaType, componentKey, authority }], -- evidence only
  estimate: { money fields, assumptions, calibrationVersion, ... },
  lineItems: [{ ..., componentKey }],
  snapshot: EstimateRequirementSnapshotV1   -- required; empty requirements[] valid
}
```

`snapshotRequired` is **not** part of v1. If a caller still sends it, the database **ignores** it and still requires a snapshot. `componentAuthorities` must not be used to omit a snapshot.

Org identity is derived from `auth.uid()` → `auth_org_id()`. Payload `orgId` is not part of the contract.

---

## 5. Output

```
{
  estimate_id,
  generation_id,
  snapshot_id,   -- always present on success
  status: "ready"
}
```

The snapshot payload is not returned.

---

## 6. Snapshot rules

**v1 (REQ-TXN-01-R1):** snapshot is **mandatory** for every successful RPC generation, regardless of authority.

Old REQ-4A SHADOW behaviour (snapshot failure may still finalize the legacy estimate) is **retired** for the atomic path. Snapshot failure → transaction failure → previous generation remains current.

**Historical rows** with null snapshot pointers remain valid. No backfill.

**Empty emitters:** `requirements: []` plus generation / authority / contract metadata is valid. Do not invent fake requirements.

Missing, invalid, oversized, or unlinkable snapshot → `REQ_TXN:SNAPSHOT_REQUIRED` / `REQ_TXN:INVALID_SNAPSHOT`.

---

## 7. Estimate row

One estimate row per project (`unique(project_id)`). No estimate-version table. The immutable snapshot is generation history.

The transaction updates the current row, replaces lines, inserts a new snapshot, links the pointer, and sets `status='ready'` / `is_stale=false` atomically. Intra-transaction `draft` is not visible outside the transaction. A failed call leaves the previous `ready` generation untouched. The app does **not** mark the estimate `failed` on RPC failure.

---

## 8. Lines

All lines are validated before delete/insert. One invalid line rolls back the transaction; generation A lines remain. `component_key` is persisted unchanged (null still valid for legacy).

---

## 9. Idempotency

**Decision:** duplicate `generation_id` **fails deterministically** (`REQ_TXN:DUPLICATE_GENERATION`). No upsert-if-same-payload. Retry with a new `generation_id`.

This keeps the implementation simple. Unique snapshot `generation_id` and unique current estimate `requirement_generation_id` remain the database backstop.

---

## 10. Concurrency

`pg_advisory_xact_lock(87230136, hashtext(org:project))` then `SELECT … FOR UPDATE` on the estimate row.

Concurrent generations serialize. The current pointer always references one complete generation. Lines and snapshot cannot mix across generations. Both may commit sequentially; the later current pointer wins; the earlier snapshot remains historical.

---

## 11. Security

| Item | Rule |
| --- | --- |
| Function | `SECURITY INVOKER` |
| `search_path` | `public` |
| Auth | `auth.uid()` and `auth_org_id()` required |
| Execute | `authenticated` only |
| Anon | **revoked** |
| Org | derived from auth; project must belong to that org |
| RLS | unchanged on estimates / lines / snapshots; triggers not disabled |
| Service role | **not granted**. Live caller is the signed-in user session (`createClient` / `requireAuthOrgContext`), not `createAdminClient`. |

---

## 12. Application adapter

`persistEstimateResult` builds the validated payload and calls the RPC.

Unsafe multi-call persist is retained **only** when the RPC is unavailable **and** no component is `REQUIREMENT_AUTHORITATIVE` (Preview before remote 036). After promotion: **no fallback**. Fail safely; the user can retry generation.

---

## 13. Pricing consistency

`assertEstimateGenerationConsistent` / `isEstimateReadyForPricing`:

- New atomic generation: both pointers set and consistent. Missing pointer is not ready.
- Historical pre-036 estimate: both pointers null remains priceable (`!is_stale`).
- Mixed/incomplete pointers are not ready.

Pricing money is unchanged. Pricing copies `requirement_snapshot_id` at create and does not follow later estimate regeneration.

---

## 14. REQ-4B gate

REQ-4B local batch **COMPLETE** (Owner commercial review pending). Remote Preview remains SHADOW until deploy. Do not promote additional components from this contract.
