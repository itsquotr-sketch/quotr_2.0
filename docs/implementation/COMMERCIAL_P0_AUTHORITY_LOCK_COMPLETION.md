# COMMERCIAL-P0 — Cost-First Commercial Authority Lock Completion

**Status:** Complete Local  
**Date:** 2026-08-13  
**Branch:** `hardening/stage-2a-security`  
**Audit commit (prior):** `820c77c76cbaa5354434559859145635f31eace3`  
**Owner decisions:** `docs/decisions/COMMERCIAL_P0_OWNER_DECISIONS.md` (CF-D1–D7 **OWNER APPROVED**)  
**Verify:** `npx tsx scripts/verify-commercial-p0-authority-lock.ts`

**Does not:** start Stage 3.2.3; MaterialRequirement; Deck takeoff; cost-first Rates UI conversion; Company DNA; PERF-FUTURE-01; Production SD; migrations.

---

## What shipped

### Authority contract
- `lib/commercial-engine/core/cost-first-authority.ts` — three paths only:
  1. NORMAL: cost + GM → sell (F-SFM)
  2. EXPLICIT OVERRIDE: provenanced sell override
  3. LEGACY COMPAT: grandfathered paired cost/sell
- Snapshot kind helpers for Pricing / Quote

### Rate resolution lock
- `resolveRate` / `resolveLabourRate` / `resolveMaterialRate` return:
  - `sellAuthority`, `grossMarginPercent`, `isLegacyPairedRate`, `isExplicitSellOverride`
  - retain `sellDerivedFromMargin` for compatibility
- Paired company/benchmark/default rates labelled **legacy_paired_rate** (CF-D2)
- Cost-only rates derive sell via org GM (CF-D1 / CF-D3)

### CM-02 fix (CF-D4)
- `updateEstimateMargin` now calls `markPricingDocumentsNeedingRecalibration`
- Non-archived Pricing → `needs_recalibration: true`, `recalibration_status: "estimate_changed"`
- Quotes **not** rewritten (sent/accepted remain historical; draft refresh remains explicit)

### Spec-only (next batches)
- Rates UI direction: `docs/plans/COST_FIRST_RATES_UI_NEXT_BATCH.md`
- Snapshot safety: `docs/architecture/COMMERCIAL_SNAPSHOT_SAFETY.md`

---

## Migrations

**None.** No schema changes required for P0.

---

## Status map

| Item | Status |
| --- | --- |
| Stage 3.2.2-R5 | Owner Demo Preview Pending (unchanged) |
| **COMMERCIAL-P0** | **Complete Local** |
| Cost-first Rates implementation | Not Started |
| MaterialRequirement foundation | Not Started |
| Deck Takeoff | Not Started |
| Stage 3.2.3 | Not Started |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
| Production Scope Discovery | Disabled |

---

## Next batch (recommended)

**Cost-first Rates implementation** — UI + transition per `COST_FIRST_RATES_UI_NEXT_BATCH.md` (no MaterialRequirement yet).

Do **not** commit/push this completion until Owner reviews the P0 report.
