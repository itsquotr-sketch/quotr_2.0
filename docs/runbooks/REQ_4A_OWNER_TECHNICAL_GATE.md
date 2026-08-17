# REQ-4A Owner Technical Gate

**Status:** COMPLETE / TECHNICALLY VALIDATED  
**Date:** 2026-08-17  
**Batch:** REQ-4A snapshot + authority + reconciliation + commercial lineage (no promotion)  
**Commit:** `69c2431fbba688445e1c1c97cf056df2d5c0dc0e`  
**Migration 035:** Applied remote on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Preview:** https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app  

REQ-4A has **no customer-facing UI**. Automation is the principal gate.

Do **not** start REQ-4B or REQ-TXN-01 in this gate. Do not promote any component.

---

## Confirm

1. App still loads.
2. Deck generates; totals unchanged.
3. Deck surface and Deck labour lines still own money.
4. Pricing money unchanged; Pricing now links snapshot at create.
5. Quote unchanged (lineage via Pricing parent).
6. No authority badges / Materials / snapshot history UI.
7. Local migration 035 verification passes.
8. Remote 035 applied; Preview snapshot persist proven.

## Goldens (unchanged)

| Scenario | Sell |
| --- | --- |
| Deck 1 | $48,340 |
| Fence 2 | $8,782 |
| Pergola 1 | $15,374 |
| Retaining Wall 2 | $7,345 |

## REQ-4A-R1 additions

- `pricing_documents.requirement_snapshot_id`
- `estimate_line_items.component_key`, `pricing_items.component_key`
- REQ-TXN-01 documented (blocks REQ-4B; not implemented)

## Not this gate

- REQ-4B promotion of `decking.surface`
- Deck labour promotion
- Remote 035 apply
- REQ-TXN-01 transactional RPC
- Production deploy
- Production Scope Discovery
