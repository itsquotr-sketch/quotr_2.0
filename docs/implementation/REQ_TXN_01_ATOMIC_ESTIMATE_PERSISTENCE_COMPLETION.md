# REQ-TXN-01 Atomic Estimate Persistence — Completion

**Status:** COMPLETE LOCAL / READY FOR COMMIT  
**Date:** 2026-08-17  
**Branch:** `hardening/stage-2a-security`  
**HEAD at start:** `dc448602bc15dc4113155d97cf48e7cc504f2208`  
**Verify:** `npx tsx scripts/verify-req-txn-01-atomic-estimate-persistence.ts`  
**Migration:** `supabase/migrations/036_persist_estimate_generation_v1.sql` (amended locally for R1; not 037)  
**Local apply:** function replaced in place (`CREATE OR REPLACE`); schema_migrations still 036  
**Remote 036:** **NOT APPLIED**

REQ-4 remains **IN PROGRESS**. REQ-4B remains **BLOCKED**. No component promotion. No UI. Production Scope Discovery **DISABLED**.

---

## R1 lock

Every successful `persist_estimate_generation_v1` call persists estimate + lines + immutable snapshot + matching generation_id + latest pointer in one transaction.

`snapshotRequired` is **removed** from `PersistEstimateGenerationV1`. If still sent, the DB ignores it. Caller `componentAuthorities` are evidence only.

Empty `requirements: []` is a valid snapshot. Historical null pointers remain valid (no backfill).

Old REQ-4A “snapshot failure may still finalize” is **retired** on the atomic path.

Execute: **authenticated only**. Live caller is the signed-in user session (`requireAuthOrgContext` → `createClient`), not service-role.

v1 contract kept (pre-remote). v1 requires snapshot.

---

## Verification

REQ-TXN-01 verifier: **90 passed, 0 failed (58 DB checks)** against local Postgres.

Goldens (unchanged, no restamp):

| Scenario | Sell |
| --- | --- |
| Deck 1 | $48,340 |
| Fence 2 | $8,782 |
| Pergola 1 | $15,374 |
| Retaining Wall 2 | $7,345 |

## REQ-4B blockers

1. Commit + push of REQ-TXN-01
2. Apply migration 036 on remote `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)
3. Preview atomic persist proof
4. Rollback behaviour validated as far as safely possible remotely
5. Deck surface shadow reconciliation still exact

Do not start REQ-4B in this batch.
