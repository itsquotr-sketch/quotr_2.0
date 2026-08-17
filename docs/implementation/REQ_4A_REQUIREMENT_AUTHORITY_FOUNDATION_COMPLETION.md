# REQ-4A Requirement Authority Foundation — Completion

**Status:** COMPLETE / TECHNICALLY VALIDATED (REQ-4A-R1 + remote 035 + Preview snapshot proof)  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**Commit:** `69c2431fbba688445e1c1c97cf056df2d5c0dc0e`  
**Verify:** `npx tsx scripts/verify-req-4a-requirement-commercial-authority.ts`  
**DB verify:** `npx tsx scripts/verify-migration-035-requirement-snapshots.ts`  
**Remote proof:** `npx tsx scripts/verify-req-4a-remote-preview-snapshot-proof.ts`

REQ-4 is **IN PROGRESS**. REQ-4A is snapshot + authority + reconciliation infrastructure. **No live component promotion.**

REQ-SNAPSHOT-01 = **COMPLETE / REMOTE VALIDATED**.  
REQ-TXN-01 = **COMPLETE / REMOTE VALIDATED** (`persist_estimate_generation_v1`; 036 applied on `lxvnylhsbvudzzupxeqr`).

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
- Remote apply of 035 on linked `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)
- Preview snapshot persist + A/B lineage + Pricing P1/A P2/B proof

## What did not land

- No Deck surface or Deck labour promotion
- No line suppression
- No requirement cost in totals
- No quote snapshot column (Quote → Pricing → snapshot is sufficient)
- No UI
- No remote migration remaining for REQ-4A (035 applied)
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

## REQ-4B readiness

REQ-4B is **READY / NOT STARTED**. Preview remains SHADOW until Owner starts REQ-4B.

## REQ-4B success condition (document only)

Before: Decking materials line = money authority; requirement = shadow.  
After: requirement = money authority; legacy path suppressed or fallback; **no double-count**; component cost identical for semantic scenarios.
