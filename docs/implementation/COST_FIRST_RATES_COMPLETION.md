# Cost-first Rates — Completion

**Status:** Complete Local / Owner Preview Pending  
**Date:** 2026-08-14  
**Baseline:** COMMERCIAL-P0 `280be453b66b938413429218a0a2ea39a14ffb89`  
**Verify:** `npx tsx scripts/verify-cost-first-rates.ts`  
**Owner preview:** `docs/runbooks/COST_FIRST_RATES_OWNER_PREVIEW.md`

**Does not:** MaterialRequirement, Deck takeoff, catalogue expansion, Stage 3.2.3, Company DNA, PERF-FUTURE-01, Production SD, migrations, bulk legacy conversion.

---

## What shipped

### Contractor UX
- Rates edit dialog: **Your cost** primary; **Recommended charge-out** live from company gross margin (shared F-SFM helper).
- **Custom charge-out** secondary/advanced.
- Legacy/custom retained sell shown with **Use recommended rate** (clears sell → derive).
- Table/mobile: Your cost + Charge-out (recommended or custom label).
- Setup `RateInputRow` aligned.
- Company defaults: **Company gross margin %** (canonical `default_margin_percent`).

### Persistence (CF-D3)
- New / recommended path: persist `cost_rate`, `sell_rate = null` → resolve derives.
- Retained / explicit: persist sell; never silently rewrite on open or company GM change.
- Adopt benchmark: **cost only** (null sell) going forward.

### Authority
- Reuses COMMERCIAL-P0 `classifyResolvedSell` / `deriveSellFromGrossMargin`.
- Presentation helpers: `lib/rates/cost-first-presentation.ts`.

---

## Deferred rate types

| Type | Treatment |
| --- | --- |
| Labour / material / scope package (Rates UI) | Cost-first UX applied |
| Subcontractor | Resolve cost-first when cost-only; no dedicated catalogue UI yet |
| Equipment / plant | Not present as Rates catalogue — deferred |
| Quotr benchmark pairs in calculators | Unchanged legacy paired fallbacks (CF-D5) |

---

## Status map

| Item | Status |
| --- | --- |
| COMMERCIAL-P0 | Complete |
| **Cost-first Rates** | **Complete Local / Owner Preview Pending** |
| MaterialRequirement | Not Started |
| Deck Takeoff | Not Started |
| Material catalogue expansion | Not Started |
| Stage 3.2.3 | Not Started |
| Company DNA | Not Started |
| PERF-FUTURE-01 | Planned |
| Production Scope Discovery | Disabled |

---

## Next batch

**MaterialRequirement / takeoff foundation** — after Owner Preview of Rates.
