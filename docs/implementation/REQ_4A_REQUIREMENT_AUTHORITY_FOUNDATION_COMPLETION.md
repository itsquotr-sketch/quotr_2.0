# REQ-4A Requirement Authority Foundation — Completion

**Status:** COMPLETE LOCAL / READY FOR COMMIT (REQ-4A-R1)  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**Baseline HEAD:** `5c802407ea79252675b2a7501290396f2159b046`  
**Verify:** `npx tsx scripts/verify-req-4a-requirement-commercial-authority.ts`  
**DB verify:** `npx tsx scripts/verify-migration-035-requirement-snapshots.ts`

REQ-4 is **IN PROGRESS**. REQ-4A is snapshot + authority + reconciliation infrastructure. **No live component promotion.**

REQ-SNAPSHOT-01 = **COMPLETE LOCAL** (migration not applied remote).  
REQ-TXN-01 = **BLOCKING REQ-4B / NOT STARTED** (documented; transactional RPC deferred).

---

## What landed

- Append-only `estimate_requirement_snapshots` (migration **035**, local only)
- Versioned `EstimateRequirementSnapshotV1` serialize/parse
- External component authority resolver (Deck surface + Deck labour = SHADOW)
- In-memory + persisted `componentKey` mapping (not description, not rate key)
- `estimate_line_items.component_key`, `pricing_items.component_key` (nullable)
- `pricing_documents.requirement_snapshot_id` immutable at create
- Shadow reconciliation + promotion **eligibility** (never promotion)
- Persist wiring: generation UUID + snapshot insert; legacy estimate still saves if schema missing
- Local DB verification script for migration 035

## What did not land

- No Deck surface or Deck labour promotion
- No line suppression
- No requirement cost in totals
- No quote snapshot column (Quote → Pricing → snapshot is sufficient)
- No UI
- No remote migration
- No REQ-4B
- No REQ-TXN-01 transactional RPC implementation
- No DECK-1/2/3
- No CM-03 change

## Persistence lifecycle (audit)

| Event | Behaviour |
| --- | --- |
| Estimate regenerate | Same estimate row updated; line items deleted then inserted (new UUIDs); new snapshot appended; prior snapshots retained |
| Pricing create | Values copied; `estimate_id` + **`requirement_snapshot_id`** (immutable); `component_key` copied; later regenerate does not mutate pricing money |
| Quote create | Values copied from reviewed pricing; `pricing_document_id` + `estimate_id`; lineage via Pricing → snapshot |

Stable line identity: ephemeral `id`, in-memory `itemKey` (rate), `category`, `label`. **Persisted for migration:** `component_key` when supplied. **Not persisted:** `itemKey`.

## First REQ-4B candidate (not promoted)

Deck `decking.surface` — semantic reimplementation, exact shadow cost parity, explicit quantity. Deck `deck.labour` remains SHADOW.

## REQ-4B blockers

1. Remote apply of migration 035  
2. REQ-TXN-01 transactional safety implemented  
3. Preview snapshot persistence proven on remote

## REQ-4B success condition (document only)

Before: Decking materials line = money authority; requirement = shadow.  
After: requirement = money authority; legacy path suppressed or fallback; **no double-count**; component cost identical for semantic scenarios.
