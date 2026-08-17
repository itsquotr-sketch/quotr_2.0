# Quotr Requirement Snapshot Contract

**Status:** CANONICAL for REQ-SNAPSHOT-01 / REQ-4A / REQ-4A-R1  
**Date:** 2026-08-17  
**Migration:** `supabase/migrations/035_estimate_requirement_snapshots.sql` (**applied remote** on `quotr_2.0` / `lxvnylhsbvudzzupxeqr`)

Once a requirement becomes commercial authority, Quotr must answer: **why did this component cost X at that generation?** without joining today’s rates, Project Conditions, or assumptions.

---

## 1. Why this table exists

Live estimates: **one row per project** (`unique(project_id)`). Regeneration **updates** that row, **deletes** all `estimate_line_items`, and **inserts** new lines (new UUIDs). Historical estimate generations are not retained on the estimate itself.

Pricing copies values at create time (`estimate_id` retained). `estimate_id` alone cannot identify which requirement generation produced a Pricing document after later regeneration.

Quotes copy from reviewed pricing (`pricing_document_id`, `estimate_id`). Later rate/estimate changes do not mutate sent/accepted quotes (Phase-9 quote immutability remains a separate gate).

Therefore historical requirement evidence cannot live only on current lines. REQ-4A adds **append-only** `estimate_requirement_snapshots`.

## 2. Payload

Schema version: `estimate-requirement-snapshot-v1`

Contains: `requirementContractVersion` (`foundation-r1.1`), `generatedAt`, `generationId`, `requirements[]` (full structured requirements including rate **outcomes**, hours, waste, conversion, assumptions, confidence, adjustment factors), `componentAuthorities[]` (registered policy at that generation).

Does not contain: AI traces, credentials, live rate rows, UI state, reconciliation debug logs.

Serialize/parse in `lib/estimate/requirement-snapshot.ts`. JSON must be finite, acyclic, no functions. Parse on read; do not trust raw JSONB.

## 3. Linkage

Each persist mints `generation_id` (UUID, not a timestamp).

- `estimates.requirement_generation_id` — current generation
- `estimates.latest_requirement_snapshot_id` — snapshot row for that generation when insert succeeded
- `estimate_requirement_snapshots.generation_id` unique
- `pricing_documents.requirement_snapshot_id` — **immutable** copy of `estimates.latest_requirement_snapshot_id` at Pricing create time (nullable for legacy/pre-REQ-4 pricing)

Current snapshot = pointer whose `generation_id` matches `estimates.requirement_generation_id`, else lookup by generation id. Not “latest by created_at”.

### Pricing lineage (REQ-4A-R1)

Generation A → snapshot A → Pricing P1: `P1.requirement_snapshot_id = A`.

Regenerate → generation B → snapshot B; estimate latest = B; **P1.requirement_snapshot_id remains A**.

Pricing P2 created after B: `P2.requirement_snapshot_id = B`.

No backfill required for historic Pricing rows (`NULL` is valid).

### Quote lineage (REQ-4A-R1)

All live Quote creation derives from a persisted Pricing document and retains `pricing_document_id`.

**Durable path:** Quote → Pricing → `requirement_snapshot_id` → snapshot payload.

No redundant `quote.requirement_snapshot_id` column in REQ-4A. Quote items do not receive `component_key`; Pricing permanently retains component identity and the Pricing parent is durable.

## 4. Component identity (REQ-4A-R1)

`componentKey` = semantic estimate component identity (e.g. `decking.surface`, `deck.labour`). **Not** rate key, **not** label.

Persisted (nullable) on:

- `estimate_line_items.component_key` — written on persist when the calculator supplies `componentKey`
- `pricing_items.component_key` — copied at Pricing create/recalibration

Legacy/unmapped lines remain `NULL`. No artificial keys for every legacy line.

## 5. Immutability

Authenticated app: **INSERT + SELECT only** on snapshots. UPDATE trigger raises `REQ_SNAPSHOT:IMMUTABLE`. No user UPDATE/DELETE policies.

**IMMUTABLE ≠ NEVER DELETABLE:** deletion occurs via project/estimate/organisation **FK cascade** (same retention as estimates). No authenticated DELETE policy.

New generation → new snapshot. Prior snapshot is not overwritten.

## 6. Failure handling (REQ-4A / SHADOW)

No requirement is commercially authoritative yet.

If snapshot persist fails (or migration 035 is not on the remote): **legacy estimate remains usable**; snapshot/promotion readiness reports failure. Estimate generate must not break Preview before remote apply.

## 7. REQ-TXN-01 (blocks REQ-4B)

**Requirement-authoritative estimate persistence safety**

When **any** component is `REQUIREMENT_AUTHORITATIVE`, Quotr must **not** successfully publish/finalize a new commercial estimate generation whose required calculation snapshot failed to persist or whose snapshot cannot be deterministically linked to that generation.

**Primary invariant:** commercial money must never be current/authoritative without its required calculation snapshot.

**Status:** **READY / BLOCKING REQ-4B** (documented in REQ-4A; transactional RPC not implemented).

### Current persist order (partial-failure states)

`persistEstimateResult` uses multiple PostgREST round-trips (not one SQL transaction):

1. Stage estimate row (`requirement_generation_id`, status draft)
2. Delete all line items
3. Insert new line items
4. Insert requirement snapshot
5. Finalize estimate (ready + `latest_requirement_snapshot_id`)

| Failure | State |
| --- | --- |
| A. estimate updated, line delete fails | Estimate failed; lines may be stale |
| B. old lines deleted, insert fails | Estimate failed; **no lines** |
| C. lines inserted, snapshot fails | Lines current; pointer null; OK in SHADOW |
| D. snapshot inserted, finalize fails | Orphan snapshot; pointer may lag; resolve by generation id |
| E. concurrent generations | Each UUID; last successful finalize wins pointer; both snapshots retained |

**Minimum safe strategy (pre-REQ-4B):** database RPC / single transaction persisting generation + line replacement + snapshot + pointers (preferred). Snapshot-first staged generation is acceptable if orphan snapshots are identifiable and non-current.

## 8. REQ-SNAPSHOT-01 completion rule

**COMPLETE** only when:

A. immutable generation snapshots persist successfully  
B. current estimate generation links deterministically  
C. historical snapshot survives regeneration  
D. Pricing created from generation retains exact snapshot linkage  
E. component identity required for migration survives persistence  
F. local DB migration/RLS behaviour verified (`scripts/verify-migration-035-requirement-snapshots.ts`)

## 9. Remote apply

Migration 035 is applied on the linked remote project. Preview persist uses the committed snapshot store. Until REQ-TXN-01, SHADOW snapshot failure may still leave the legacy estimate usable.

QUOTE-IMMUTABILITY-DB-01 remains Phase-9.
