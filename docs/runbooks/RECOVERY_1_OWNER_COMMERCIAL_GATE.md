# RECOVERY-1 Owner commercial gate

**Status:** COMPLETE / COMMERCIAL CONTRACT VALIDATED  
**Date:** 2026-08-19  
**Branch:** `hardening/stage-2a-security`  
**Contract:** `docs/architecture/QUOTR_COMMERCIAL_COST_TO_SELL_CONTRACT.md`  
**Audit:** `docs/audits/RECOVERY_1_DECK_COMMERCIAL_AUTHORITY_AUDIT.md`  
**Verify:** `npx tsx scripts/verify-recovery-1-commercial-authority.ts`

Owner decisions applied:

| ID | Decision |
| --- | --- |
| C1 | R1 — project GM owns current sell through Estimate → Pricing → Quote |
| C2 | Grandfather paired sell when no target GM |
| C3 | Persist `sellAuthority` in line metadata / snapshot (no migration) |

Do not start RECOVERY-2, UX rebuild, DECK-2C, DECK-3, or Production deploy from this gate.

---

## Owner Preview smoke

On the same REAL-JOB-01 estimate (no new rates):

1. Confirm estimate recommended sell.
2. Prepare final pricing.
3. Confirm Pricing **initial** total equals the estimate sell **without an explicit Pricing edit**.
4. Optional: draft quote projection equals Pricing customer totals.

Expected controlled shape: cost ≈ $8,126.88, GM 23.5%, sell ≈ $10,623.37.

$13,000 + GST is evidence only.

---

## Four gates (programme rule)

A. Calculation · B. Commercial · C. Persistence · D. User  

Promotions and major estimator releases need all applicable gates. RECOVERY-1-R1 is **B + C**. D is RECOVERY-2 / UX.
