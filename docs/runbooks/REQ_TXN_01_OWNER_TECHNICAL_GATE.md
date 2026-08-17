# REQ-TXN-01 Owner Technical Gate

**Status:** COMPLETE / REMOTE VALIDATED  
**Date:** 2026-08-18  
**Batch:** Atomic estimate generation persistence (REQ-TXN-01 remote gate)  
**Migration 036:** **REMOTE APPLIED** on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)  
**Preview:** https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app  

REQ-TXN-01 has **no customer-facing UI**. Local verifier + remote disposable-org RPC proof are the gates.

Do **not** start REQ-4B in this gate. Do not promote any component. Do not deploy Production.

---

## Confirm

1. App still loads.
2. Deck generates; totals unchanged.
3. Deck surface and Deck labour remain **SHADOW**; lines still own money.
4. New estimate generation uses `persist_estimate_generation_v1` and **always** inserts a snapshot (empty `requirements[]` is valid).
5. Missing/invalid snapshot fails the generation; previous generation remains current.
6. Pricing money unchanged; P1 snapshot linkage survives a later generation.
7. Quote unchanged (Q1 → P1 → snapshot A after generation B).
8. Local REQ-TXN-01 verifier passes (`scripts/verify-req-txn-01-atomic-estimate-persistence.ts`).
9. Local and remote migration 036 applied.
10. Execute granted to `authenticated` only (not anon, not service_role).
11. Remote Preview atomic proof passes (`scripts/verify-req-txn-01-remote-preview-atomic-proof.ts`).

## Goldens (unchanged)

| Scenario | Sell |
| --- | --- |
| Deck 1 | $48,340 |
| Fence 2 | $8,782 |
| Pergola 1 | $15,374 |
| Retaining Wall 2 | $7,345 |

## Not this gate

- REQ-4B promotion of `decking.surface`
- Deck labour promotion
- Production deploy
- Production Scope Discovery

## After this gate

REQ-4B is **READY / NOT STARTED**. Owner starts it as a separate batch.
