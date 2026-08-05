# Stage 2B — Batch 2B.9 Completion Report

**Batch:** 2B.9 — Remove Client-Side Financial Authority and Consolidate Financial Presentation  
**Date:** 2026-08-05  
**Stage 2B status:** In Progress  
**Live adoption:** UI displays authoritative persisted/server/preview-adapter values only  

---

## 1. Objective

Remove remaining client-side and presentation-layer financial authority so React components format and collect inputs only. Commercial engine + server adapters remain the sole commercial truth.

## 2. Client calculations audited

| ID | Location | Class | Disposition |
| --- | --- | --- | --- |
| LEG-UI-01 | PricingItemEditForm inline GP triad | financial_authority | **Removed** → presentation preview |
| PRES-EDIT-01 | calculatePricingItemEdit in form | financial_authority / preview | **Replaced** with `previewPricingItemEdit` |
| LEG-P-07 | PricingWorkAreaSection + calculateDocumentTotals | financial_authority | **Replaced** with authoritative section totals |
| LEG-UI-02 | EstimateBreakdownModal unrounded margin | financial_authority | **Replaced** with estimate aggregate adapter |
| LEG-E-24 | category-breakdown partial profit | financial_authority | Rounded; consumed via presentation helper |
| LEG-Q-06 | Quote summary/template/print | snapshot_display | **Retained** (stored only) |
| PRES-SUM-* | Pricing summary / rows | snapshot_display | View models + unknown-cost labels |
| PRES-BRK-02/03 | Share bars / grouping | non_financial | Retained |
| PRES-VAL-01 | MarginEditControl validation | UX validation | Retained |
| PRES-FMT | format helpers | formatting_only | Retained / extended |

## 3. Presentation boundary

See `docs/specifications/FINANCIAL_PRESENTATION_BOUNDARY.md`.

## 4. Estimate UI changes

- Work-area totals via `presentEstimateWorkAreaTotals` (engine aggregate, rounded margin)
- Category totals via `presentEstimateCategoryTotals` (rounded)
- Profit/margin display uses unknown-cost honesty labels
- Header metrics via `estimateDocumentViewModel`
- Confidence remains separate metadata

## 5. Pricing UI changes

- Edit form preview via `previewPricingItemEdit` (engine adapter) labelled “Preview until saved”
- Section totals via `presentPricingSectionTotals` (authoritative aggregate, GST 0 at section)
- Summary / rows via `pricingDocumentViewModel` / `pricingItemViewModel`
- Unknown-cost shows “Profitability unavailable” / “Margin unavailable”
- Row qty label uses persisted quantity (no client money re-resolve)

## 6. Quote UI changes

- Summary uses `quoteDocumentViewModel` (stored snapshot fields)
- Template/print unchanged in calculation behaviour (still stored totals)
- No browser recalculation of sent/accepted quotes

## 7. Print/export treatment

Quote print continues to render persisted snapshot values only.

## 8. View models created

- `lib/pricing/financial-view-model.ts`
- `lib/estimate/financial-view-model.ts`
- `lib/quotes/financial-view-model.ts`
- Presentation helpers: `presentation-item-preview`, `presentation-section-totals`, `presentation-breakdown`
- Formatting: `lib/financial-presentation/format.ts`

## 9. Formatting consolidation

- Shared profitability labels for unknown cost
- Existing `formatPricingMoney` / `formatPricingPercent` retained
- Assistant AUD formatters retained for estimate UI (no redesign)

## 10. Unknown-cost presentation

Consistent labels when `cost_known === false` or sell-only inference. No fabricated 100% / misleading 0% as real margin.

## 11. Client arithmetic removed

- Inline GP triad in PricingItemEditForm
- Direct `calculateDocumentTotals` / `calculatePricingItemEdit` from components
- Unrounded work-area margin formula in EstimateBreakdownModal

## 12. Client arithmetic retained and why

| Helper | Why |
| --- | --- |
| `previewPricingItemEdit` → engine | Approved draft preview |
| `validateTargetMarginPercent` | Input validation only |
| Category cost-component split | Non-authoritative display allocation; rounded |
| Formatting helpers | Presentation only |
| Server legacy helpers | Parity / rollback (not UI) |

## 13. Files changed

**Created:** boundary doc, financial-presentation format, pricing/estimate/quote view models & presentation helpers, verify script, this report.

**Modified:** PricingItemEditForm, PricingWorkAreaSection, PricingSummaryPanel, PricingItemRow, EstimateBreakdownModal, EstimatePanel, QuoteSummaryPanel, category-breakdown (round profit), audit/matrix/plan/MVP guide.

## 14. Tests and results

`scripts/verify-batch-2b9-client-financial-authority.ts` — **20/20**  
Full regression chain including 2A.3B and 2B.3–2B.8 — see run log.

## 15. Remaining UI authority

- Optional AUD vs NZD formatter consolidation (cosmetic)
- `itemToForm` still uses `resolvePricingItemCalculation` to seed edit fields (then preview overwrites money via engine) — acceptable input shaping at editor open
- S1-010 pricing/quote visible divergence UX remains Stage 6

## 16. Historical snapshot protection

Quotes and print never recalculate. Pricing/estimate displays use persisted fields except labelled edit preview.

## 17. Rollback

Git revert Batch 2B.9. Server authority switches unaffected.

## 18. Future-learning compatibility

1. UI displays structured authoritative outputs? **Yes.**  
2. Unknown values honest? **Yes.**  
3. Manual overrides visible? **Yes** (badges / target margin).  
4. Confidence separate from money? **Yes.**  
5. Historical snapshots protected? **Yes.**  
6. DNA can recommend without controlling arithmetic? **Yes.**  
7. Explanation hooks for future UI? **Available on engine records; not fully surfaced in UI yet.**  
8. Customer gets more consistent totals? **Yes.**

## 19. Recommendation for Batch 2B.10

Final Stage 2B regression, documentation freeze, optional legacy-helper retirement plan (without deleting parity/rollback paths), and deployment readiness — no DNA, no schema, no AI redesign.
