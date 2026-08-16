# FOUNDATION-R2-R1 — Material rate authority completion

**Status:** Complete Local / Owner Preview Pending  
**Date:** 2026-08-16  
**Branch:** `hardening/stage-2a-security`  
**Verify:** `npx tsx scripts/verify-foundation-r2r1-material-rate-authority.ts`

Do not mark Owner PASS from this document. Do not start REQ-1 from this document.

---

## Purpose

Reconcile physical material quantity with priced quantity/rate unit after Owner Preview found Deck showing 126.65 lm takeoff while pricing 16.12 m².

---

## Delivered

1. **Invariant** — priced qty unit must match rate unit (or documented conversion).
2. **Hierarchy** — company exact → category (explicit + unit) → Quotr material benchmark → package fallback. Removed work-area first-match in `resolveMaterialRate`.
3. **Deck decking fix** — lm takeoff × `$/lm` when board width known; m² package only as fallback.
4. **Honest UI** — Breakdown heading distinguishes priced takeoff vs display-only; cost/charge rates show `/unit`.
5. **Rates UI** — unused specific rates marked **Planned**; decking lm **Used now** is now true.
6. **No** REQ-1, no MaterialRequirement emit, no Catalogue V2, no fascia rewrite, no migration.

---

## Golden change

Outdoor calibration **Deck 1 sell $53,440 → $48,340**. Cause: 70 m² × $340/m² replaced by 550 lm × $34/lm (same hardwood, 140 mm, 10% waste). Fence 2 $8,782 / Pergola 1 $15,374 / RW 2 $7,345 **unchanged**.

---

## Verification (this batch)

See completion report in chat / re-run:

`npx tsx scripts/verify-foundation-r2r1-material-rate-authority.ts`

Expected: **28 passed, 0 failed**.

---

## Status

| Item | Status |
| --- | --- |
| FOUNDATION-R1 | Complete |
| FOUNDATION-R1-R1 | Complete — Owner Preview Validated |
| FOUNDATION-R2 | Complete Local / Owner Preview remediation pending R2-R1 |
| FOUNDATION-R2-R1 | **Complete Local / Owner Preview Pending** |
| REQ-1 | Not Started — wait for Owner R2-R1 PASS |
| MaterialRequirement | Not Started |
| LabourRequirement | Not Started |
| Deck transparent estimator | Not Started |
| Production Scope Discovery | Disabled |

**Exact next:** Owner R2-R1 Preview including R2-R1-R1 tests (`docs/runbooks/FOUNDATION_R2R1_OWNER_PREVIEW.md`) on the same Deck job. Then remaining R2 question sampling if still needed. REQ-1 only if authorised after PASS.
