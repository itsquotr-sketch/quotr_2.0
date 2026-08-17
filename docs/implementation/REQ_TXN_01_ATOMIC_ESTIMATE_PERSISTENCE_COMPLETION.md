# REQ-TXN-01 Atomic Estimate Persistence — Completion

**Status:** COMPLETE / REMOTE VALIDATED  
**Date:** 2026-08-18  
**Branch:** `hardening/stage-2a-security`  
**Code commit:** `a6d3502f12a381aaba935a5de4a1f79364353fc8`  
**Verify:** `npx tsx scripts/verify-req-txn-01-atomic-estimate-persistence.ts`  
**Remote proof:** `npx tsx scripts/verify-req-txn-01-remote-preview-atomic-proof.ts`  
**Migration:** `supabase/migrations/036_persist_estimate_generation_v1.sql`  
**Local apply:** 001–036  
**Remote 036:** **REMOTE APPLIED** on `quotr_2.0` (`lxvnylhsbvudzzupxeqr`)

REQ-4 remains **IN PROGRESS**. REQ-4B is **READY / NOT STARTED**. No component promotion. No UI. Production Scope Discovery **DISABLED**. Atomic estimate generation is **ACTIVE**.

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

## Remote proof

- Preview Ready: unique `https://quotr-2-0-7yehizi4n-quotr1.vercel.app`; stable `https://quotr-2-0-git-hardening-stage-2a-security-quotr1.vercel.app`
- Dry-run then `db push --linked --yes` applied **only** `036_persist_estimate_generation_v1.sql`
- Remote function: `persist_estimate_generation_v1(p_payload jsonb)`, `prosecdef=false`, `search_path=public`
- Grants: authenticated execute **true**; anon **false**; service_role **false**
- Remote proof: **37 passed, 0 failed** (authenticated RPC path, missing/invalid snapshot rollback, Fence `requirements: []`, A/B, P1/A P2/B, Q1→P1→A, cross-org)

## REQ-4B

**READY / NOT STARTED.** Deck surface shadow reconciliation still exact. Do not start REQ-4B in this batch.
