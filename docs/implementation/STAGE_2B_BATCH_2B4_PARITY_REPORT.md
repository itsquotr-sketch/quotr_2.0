# Shadow Parity Report — Batch 2B.4

Generated: 2026-08-05

## Totals

| Metric | Count |
| --- | ---: |
| Fixtures run | 20 |
| Exact matches | 15 |
| Rounding / normalisation | 0 |
| Approved engine corrections | 1 |
| Legacy inconsistencies | 0 |
| Adoption blockers | 0 |
| Deferred differences | 2 |
| Presentation-only | 2 |
| Runner failures | 0 |

## Results

| Fixture | Legacy ID | Classification | Blocking | Authority |
| --- | --- | --- | --- | --- |
| PAR-P-GP-001 | LEG-P-01 | EXACT_MATCH | no | canonical_golden_results |
| PAR-E-MARGIN-001 | LEG-E-15 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-QTY-001 | LEG-P-02 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-PROD-001 | LEG-P-02 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-LUMP-001 | LEG-P-02 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-SELLONLY-001 | LEG-P-02 | APPROVED_ENGINE_CORRECTION | no | owner_commercial_decisions |
| PAR-P-ZERO-001 | LEG-P-02 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-MANUAL-SELL-001 | LEG-P-02 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-DOC-001 | LEG-P-03 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-DOC-MIXED-001 | LEG-P-03 | EXACT_MATCH | no | canonical_golden_results |
| PAR-P-DOC-GST0-001 | LEG-P-03 | EXACT_MATCH | no | owner_commercial_decisions |
| PAR-P-GST-BUG-C28 | LEG-P-05 | EXACT_MATCH | no | owner_commercial_decisions |
| PAR-E-SFM-001 | LEG-E-01 | EXACT_MATCH | no | canonical_golden_results |
| PAR-E-AGG-001 | LEG-E-16 | EXACT_MATCH | no | canonical_golden_results |
| PAR-E-TO-P-001 | LEG-E-21 | EXACT_MATCH | no | canonical_golden_results |
| PAR-Q-DOC-001 | LEG-Q-01 | EXACT_MATCH | no | canonical_golden_results |
| PAR-Q-ITEM-001 | LEG-Q-02 | DEFERRED_WORKFLOW_DIFFERENCE | no | live_legacy_behaviour |
| PAR-PQ-DIVERGENCE-001 | LEG-P-03 | DEFERRED_WORKFLOW_DIFFERENCE | no | mixed_documented_disagreement |
| PAR-UI-PROFIT-001 | LEG-UI-01 | PRESENTATION_ONLY_DIFFERENCE | no | canonical_golden_results |
| PAR-UI-UNROUNDED-001 | LEG-UI-02 | PRESENTATION_ONLY_DIFFERENCE | no | canonical_golden_results |

## Explanations

### PAR-P-GP-001
Legacy and engine financial outputs match within tolerance. Notes: LEG-P-01 triad

### PAR-E-MARGIN-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-QTY-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-PROD-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-LUMP-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-SELLONLY-001
Fixture declares APPROVED_ENGINE_CORRECTION: sell-only lump — legacy 100% margin vs engine null Notes: KM-SELL-ONLY-MARGIN

### PAR-P-ZERO-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-MANUAL-SELL-001
Legacy and engine financial outputs match within tolerance. Notes: manual sell preserved as unit_sell input

### PAR-P-DOC-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-DOC-MIXED-001
Legacy and engine financial outputs match within tolerance. Notes: KM-AVERAGED-MARGINS guard

### PAR-P-DOC-GST0-001
Legacy and engine financial outputs match within tolerance.

### PAR-P-GST-BUG-C28
Legacy and engine financial outputs match within tolerance. Notes: KM-GST-C28; corrected_2B.5; labelled=0; recalcWith=0; historicBugRecalcWith=15; historicPostGst=1200; correctedPostGst=0

### PAR-E-SFM-001
Legacy and engine financial outputs match within tolerance. Notes: deriveSell=26666.67

### PAR-E-AGG-001
Legacy and engine financial outputs match within tolerance. Notes: estimate excl GST — compared with engine gstRate 0

### PAR-E-TO-P-001
Legacy and engine financial outputs match within tolerance. Notes: estimate recommended 300/400 from 5h×60/80; pricing conversion must use rates — not re-apply margin on totals

### PAR-Q-DOC-001
Legacy and engine financial outputs match within tolerance. Notes: KM-PRICING-QUOTE-DIVERGENCE; cost fields copied from engine for sell/GST-focused compare

### PAR-Q-ITEM-001
Fixture declares DEFERRED_WORKFLOW_DIFFERENCE: quote item prefers supplied total over qty×price Notes: CD-22 decided 2B.8: retain prefer supplied total as quote-domain policy; Engine line modes do not implement prefer-total; production uses domain policy + engine for qty×price / aggregates

### PAR-PQ-DIVERGENCE-001
Fixture declares DEFERRED_WORKFLOW_DIFFERENCE: pricing all vs quote visible on same basket Notes: KM-PRICING-QUOTE-DIVERGENCE; pricingSell=22000; quoteSell=20000

### PAR-UI-PROFIT-001
Fixture declares PRESENTATION_ONLY_DIFFERENCE: client profit preview matches rounded triad Notes: KM-CLIENT-DUP — numbers match; classification presentation

### PAR-UI-UNROUNDED-001
Fixture declares PRESENTATION_ONLY_DIFFERENCE: unrounded work-area margin vs 2dp engine Notes: unrounded margin% vs roundPercent
