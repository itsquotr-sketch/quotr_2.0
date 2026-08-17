# REQ-TXN-01 Owner Technical Gate

**Status:** COMPLETE LOCAL / READY FOR COMMIT  
**Date:** 2026-08-17  
**Batch:** Atomic estimate generation persistence (REQ-TXN-01-R1: mandatory snapshot; authenticated execute only)  
**Migration 036:** Applied **locally only**. Do **not** apply remote until this gate PASSes and the batch is committed/pushed.  
**Preview:** https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app  

REQ-TXN-01 has **no customer-facing UI**. Automation is the principal local gate. Remote/Preview atomic proof is a **later** gate after commit/push + 036 remote apply.

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
9. Local migration 036 applied; **036 not remote**.
10. Execute granted to `authenticated` only (not anon, not service_role).

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
- Remote 036 apply
- Production deploy
- Production Scope Discovery

## After Owner PASS

1. Commit + push REQ-TXN-01 (do not include `.next/` or secrets).
2. Apply 036 remote on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`).
3. Preview atomic persist + rollback proof as far as safely possible.
4. Only then consider REQ-4B.
