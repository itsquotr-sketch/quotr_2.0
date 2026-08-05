# Legacy Commercial Compatibility Matrix

**Batch:** 2B.4 (issued) · **Updated:** 2B.10 (stage close)  
**Date:** 2026-08-05  
**Authority:** Owner commercial decisions · Canonical goldens · Live production adapters  
**Engine:** `lib/commercial-engine/` is authoritative for estimate/pricing/quote money via production adapters  

---

## 1. Totals (after Batch 2B.5 parity refresh; confirmed 2B.10)

| Metric | Count |
| --- | ---: |
| Legacy implementations registered | 25 |
| Parity fixtures | 19 |
| Exact matches | 14 |
| Rounding / input-normalisation matches | 0 |
| Approved engine corrections | 1 |
| Legacy inconsistencies (registered theme) | 1 theme (KM-GP-DUPLICATION) |
| Adoption blockers | **0** (C-28 cleared in 2B.5) |
| Deferred workflow differences | 2 |
| Presentation-only | 2 |

Source: regenerated `docs/implementation/STAGE_2B_BATCH_2B4_PARITY_REPORT.md`  
Historic 2B.4 blocker evidence: `STAGE_2B_BATCH_2B4_PARITY_REPORT_HISTORIC_PRE_2B5.md`

---

## 2. Implementation matrix

| Legacy ID | Audit | File / function | Responsibility | Parity coverage | Typical result | Approved authority | Adoption risk | Remediation | Target batch | Rollback | Historical impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEG-E-01 | C-01 | `rates.ts` `deriveSellFromCost` | Sell from gross margin | PAR-E-SFM-001 | EXACT_MATCH | golden / OCD | Low | **Adopted 2B.7** (prod margin via engine; pure export for parity) | 2B.7 | Keep export wrapper | None |
| LEG-E-08 | C-08 | `line-items.ts` `deriveMargins` | GP triad | Deferred (via item fixtures) | EXACT when inputs match | golden | Low | **Adopted 2B.7** (`buildAmounts` → engine) | 2B.7 | Restore local triad | None |
| LEG-E-13 | C-13 | `summary.ts` finalize | Estimate aggregate | Deferred (≈ LEG-E-16) | EXACT | golden | Low | **Adopted 2B.7** (engine aggregate no GST) | 2B.7 | Keep finalize | None |
| LEG-E-15 | C-15 | `margin-override.ts` recalculateSellFromCost | Target margin | PAR-E-MARGIN-001 | EXACT_MATCH | golden | Low | **Adopted 2B.7** (`applyMarginToAmounts` → engine; pure helper for parity) | 2B.7 | Keep helper | None |
| LEG-E-16 | C-16 | `sumLineItemTotals` | Estimate sum | PAR-E-AGG-001 | EXACT_MATCH | golden | Low | **Adopted 2B.7** (`aggregateEstimateLineTotals`; pure sum for parity) | 2B.7 | Keep helper | None |
| LEG-E-19 | C-19 | calculators/* | Domain qty/rates | Deferred workflow | Domain | mixed | Med | Feed lines to engine (unchanged) | 2B.7 | Keep calculators | None |
| LEG-E-21 | C-21 | `runEstimateGeneration` | Persist orchestrator | Deferred | N/A | live | Med | **Adopted 2B.7** (money via factories/finalize) | 2B.7 | Estimate authority switch | Snapshot new rows |
| LEG-E-24 | C-42 | category-breakdown | Partial profit display | Deferred | PRESENTATION | golden | Low | **Adopted 2B.9** — rounded presentation helper | 2B.9 | Keep UI helper | N/A |
| LEG-P-01 | C-24 | `computeProfitFields` | Item GP triad | PAR-P-GP-001 | EXACT_MATCH | golden | Low | **Adopted 2B.6A** via engine | **2B.6A** | Authority switch / revert | None |
| LEG-P-02 | C-25 | pricing-item-calculation | Line modes | Multiple PAR-P-* | EXACT / APPROVED corr. | golden / OCD | Med | **Adopted 2B.6A** item CRUD | **2B.6A** | Authority switch / revert | Preserve edits |
| LEG-P-03 | C-26 | `calculateDocumentTotals` | Doc aggregate + GST | PAR-P-DOC-* | EXACT_MATCH | golden | Med | **Adopted 2B.6A** after item mutations | **2B.6A** | Authority switch / revert | None |
| LEG-P-04 | C-27 | pricing actions recalc | Persist | Via 2B.6A helper | Engine aggregate | live | Med | Authoritative helper | **2B.6A** | Keep actions | Careful |
| LEG-P-05 | C-28 | `createPricingFromEstimate` | Estimate→pricing GST source | PAR-P-GST-BUG-C28 | **EXACT_MATCH** (corrected 2B.5) | OCD / CD-09 | Low | Done: org/doc GST for insert+recalc | **2B.5** fix; adopt engine **2B.6** | Revert GST helper wiring | Pre-2B.5 anomalies not bulk-rewritten |
| LEG-P-06 | C-29 | recalibration | Sync estimate→pricing | Deferred | Uses C-26 | live | Med | Engine + preserve manual | 2B.6 | Keep | Preserve flags |
| LEG-P-07 | C-41 | PricingWorkAreaSection | Section display GST=0 | Deferred | PRESENTATION | golden | Low | **Adopted 2B.9** — authoritative section totals | 2B.9 | Keep | N/A |
| LEG-Q-01 | C-30 | `calculateQuoteTotals` | Visible + GST | PAR-Q-DOC-001 | EXACT_MATCH | golden | Med | **Adopted 2B.8** (prod adapter; pure helper for parity) | 2B.8 | Keep | Quotes immutable |
| LEG-Q-02 | C-31 | `calculateQuoteItemTotal` | Prefer client total | PAR-Q-ITEM-001 | DEFERRED | CD-22 retain | Med | **CD-22 confirmed prefer-total**; qty×price via engine | 2B.8 | Keep | Edits |
| LEG-Q-03 | C-32 | from-pricing map | Transform | Deferred | Transform | live | Low | Keep transform | 2B.8 | Keep | None |
| LEG-Q-04 | C-33 | build-from-pricing | Payload | Deferred | Uses Q-01 | live | Low | **Adopted 2B.8** engine totals | 2B.8 | Keep | Snapshot |
| LEG-Q-05 | C-34 | quotes/actions | Persist/revise | Deferred | Side-effect | live | Med | **Adopted 2B.8** aggregates; revise-copy immutable | 2B.8 | Authority switch | **Immutable** |
| LEG-Q-06 | C-38 | QuoteSummary/print | Display stored | Deferred | Snapshot | live | Low | **Confirmed 2B.9** — stored snapshot only | 2B.9 | Keep | Protected |
| LEG-UI-01 | C-35 | PricingItemEditForm | Client GP preview | PAR-UI-PROFIT-001 | PRESENTATION | golden | Low | **Adopted 2B.9** — engine preview helper | 2B.9 | Keep | N/A |
| LEG-UI-02 | C-36 | EstimateBreakdownModal | Unrounded margin | PAR-UI-UNROUNDED-001 | PRESENTATION | golden | Low | **Adopted 2B.9** — estimate aggregate adapter | 2B.9 | Keep | N/A |
| LEG-CONST-01 | — | `DEFAULT_GST_RATE` | Constant 15 | Via C-28 | Fallback only when unset | OCD | Low | Never override valid doc/org rate | 2B.5 clarified | Keep constant | — |
| LEG-DB-01 | C-39 | migrations | Schema only | Deferred | N/A | n/a | None | No formula change | n/a | — | — |

---

## 3. Known mismatch register (summary)

| ID | Classification | Blocks adoption? | Target |
| --- | --- | --- | --- |
| KM-GST-C28 | EXACT_MATCH (corrected 2B.5; historic blocker archived) | **No** | 2B.5 |
| KM-SELL-ONLY-MARGIN | APPROVED_ENGINE_CORRECTION | No | 2B.6 UI mapping |
| KM-GP-DUPLICATION | LEGACY_INCONSISTENCY | No | 2B.6–2B.9 |
| KM-CLIENT-DUP | PRESENTATION_ONLY_DIFFERENCE | No | 2B.9 |
| KM-PRICING-QUOTE-DIVERGENCE | DEFERRED_WORKFLOW_DIFFERENCE | No | 2B.8 / Stage 6 |
| KM-AVERAGED-MARGINS | EXACT_MATCH (guard) | No | n/a |

---

## 4. Adoption gates (before any live caller uses the commercial engine)

1. Golden regression 100% (`verify-batch-2b3b-golden-commercial-engine.ts`)
2. Contract verification 100% (`verify-batch-2b3c-engine-contract.ts`)
3. Legacy path has parity fixtures
4. Differences classified
5. Commercial authority identified
6. Persisted-field mapping explicit
7. Historical records protected
8. Rollback path exists
9. No client-side caller remains financially authoritative
10. GST source is explicit (document/org — never silent hardcoded overwrite)
11. Unknown-cost behaviour explicit (null margin)
12. Manual overrides preserved

### Per-batch gates

| Batch | Additional gates |
| --- | --- |
| **2B.6 Pricing adoption** | **2B.6A+2B.6B complete** for pricing-domain server paths; estimates/quotes/UI remain |
| **2B.7 Estimate adoption** | **Complete** — production estimate money via adapter; confidence/ranges out of money engine; LEG-E parity helpers retained |
| **2B.8 Quote adoption** | **Complete** — LEG-Q-01 EXACT `visible_only`; revise-copy immutable; CD-22 prefer-total retained |
| **2B.9 UI removal** | **Complete** — no client GP/aggregate authority; display server/engine/preview-adapter only |
| **2B.10 Stage close** | **Complete — Local** — dead wrappers removed; switches retained; full regression green; deploy owner-gated |

---

## 5. Historical snapshot treatment

- Sent/accepted **quotes** must never be recomputed into new commercial values.
- Pricing documents created under C-28 may store GST amounts inconsistent with `gst_rate` when org ≠ 15 — do not silently rewrite; forward path fixed in **2B.5**; optional deliberate repair later.
- Sell-only lines may historically store fabricated margin % — retain snapshot; new engine writes null/`cost_known=false`.

---

## 6. Future-learning compatibility

- Parity data is **engineering evidence**, not Company DNA.
- Legacy mismatches must not become learning signals.
- Manual corrections become DNA evidence only after adoption with structured hooks.
- Golden truth remains independent of customer behaviour.
- Company DNA must never change deterministic arithmetic silently.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/LEGACY_COMMERCIAL_COMPATIBILITY_MATRIX.md` |
| Live adoption | Pricing + estimate + quote server (2B.6–2B.8) + UI presentation (2B.9); stage closed 2B.10 Complete — Local |
| Parity package | `lib/commercial-engine/parity/` (not public engine API) |
| Retained legacy | Documented in `STAGE_2B_COMPLETION_REPORT.md` §18 |
