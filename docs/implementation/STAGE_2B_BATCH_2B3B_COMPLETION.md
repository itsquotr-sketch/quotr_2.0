# Stage 2B — Batch 2B.3B Completion Report

**Batch:** 2B.3B — Golden Scenario Regression Suite and Kernel Hardening  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Engine adoption:** None — `lib/commercial-engine/` remains disconnected from the live application  

---

## 1. Objective

Convert the approved canonical commercial scenarios into executable deterministic fixtures and use them to verify and harden the standalone commercial calculation kernel — without wiring the engine into pricing actions, estimates, quotes, UI, persistence, or migrations.

## 2. Commercial decisions confirmed

Owner-approved MVP commercial model recorded in `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`.

- Blocking decisions required for Batch 2B.3 marked **Confirmed** (including OCD-01, 02, 05, 06, 08, 12–17, 27–30, 32, 35, 40–43, 52, 54, and OCD-GST commercial rule).
- Intentionally deferred items marked **Deferred**.
- Owner approval note dated **2026-08-04**.
- No Pending statuses remain in the register.
- OCD-GST application bug fix remains scheduled for **Batch 2B.6** (rule Confirmed; live fix not in this batch).

## 3. Scenario classification summary

| Classification | Count |
| --- | --- |
| Executable now — line item | 32 |
| Executable now — aggregate/document | 15 |
| Documentation-only — future workflow | 1 (CCS-025) |
| Deferred — requires live persistence | 2 (CCS-019, CCS-020) |
| Deferred — requires pricing-action integration | 1 (CCS-046) |
| Deferred — requires Company DNA | 1 (CCS-052) |
| **Total CCS** | **52** |

Map: `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md`

## 4. Executable line fixtures

**32** CCS line fixtures + **2** margin-boundary EXT line fixtures (`EXT-MARGIN-0`, `EXT-MARGIN-95`) in `canonical-line-fixtures.ts`.

## 5. Executable aggregate fixtures

**15** CCS aggregate fixtures + **4** GST/rounding EXT aggregate fixtures in `canonical-aggregate-fixtures.ts`.

## 6. Validation fixtures

**6** line validation + **1** aggregate GST validation (`LINE_VALIDATION_FIXTURES` + `AGGREGATE_VALIDATION_FIXTURES`).

## 7. Deferred and why

| ID | Why deferred | Future batch |
| --- | --- | --- |
| CCS-019 | Quote revision / snapshot immutability needs persistence | 2B.8 |
| CCS-020 | Historical quote after rate rise needs immutable storage | 2B.8 |
| CCS-025 | Estimate range bands are workflow / heuristic, not pure money kernel | 2B.7 |
| CCS-046 | Recalibration preserve-manual needs pricing-action adoption | 2B.6–2B.9 |
| CCS-052 | Company DNA evidence product must not alter arithmetic | Stage 6 / DNA |

## 8. Comparator capabilities

`fixtures/compare.ts` returns structured field mismatches for:

- cost, sell, gross profit, gross margin, markup
- GST amount, GST-inclusive total, GST rate
- engine / formula versions
- warning codes, validation error codes
- calculation step identifiers
- manual override presence/fields
- null/unknown cost or margin (`cost_known`)
- aggregate totals
- precision tolerance
- learning-hook metadata (signals only; `auto_update_company_rules === false`)

## 9. Kernel defects found

1. **Sell-only lump fabricated 100% margin** when cost unknown (contradicted OCD-30 / approved rule “do not fabricate cost or margin”).
2. **Quantity-rate / productivity sell-only** could similarly fabricate margin when `unit_cost` omitted.
3. Aggregate error path lacked `cost_known` after type expansion.

## 10. Kernel corrections made

| Change | File | Scope |
| --- | --- | --- |
| `deriveProfitMetrics` supports `costKnown`; returns null GP/margin/markup when unknown | `core/profit.ts` | Narrow |
| Outputs / aggregate types include `cost_known` and nullable profit fields | `core/types.ts` | Narrow |
| Lump-sum treats omitted / sell-only cost as unknown; no fabricated margin | `calculations/lump-sum.ts` | Narrow |
| Qty-rate / productivity set `cost_known` from whether unit cost provided | `quantity-rate.ts`, `productivity-labour.ts` | Narrow |
| Aggregate respects per-line `cost_known`; GST still on sell subtotal | `calculations/aggregate.ts` | Narrow |
| Assumption codes surfaced as structured warnings (metadata only) | `calculations/calculate-line.ts` | Narrow |
| Engine version bumped to `2B.3B.0` | `versioning/index.ts` | Version stamp |
| Golden CCS-042 expected margin updated to **null** (aligned to approved truth) | `GOLDEN_PRICING_EXPECTED_RESULTS.md` | Spec parity |

## 11. Golden results

```
npx tsx scripts/verify-batch-2b3b-golden-commercial-engine.ts
→ 60 fixtures executed, 60 passed, 0 failed
→ CCS executable coverage 47/52 = 90.4%
```

## 12. Coverage result

- All required quantity-rate, productivity, lump-sum, margin, GST (0%/15%/non-15%/100%), rounding-drift, aggregate, validation, and versioning/explainability acceptance paths covered by CCS and/or EXT fixtures.
- Expected results independent of engine output (sourced from golden docs / approved arithmetic).

## 13. Files changed

### Created

- `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md`
- `docs/implementation/STAGE_2B_BATCH_2B3B_COMPLETION.md`
- `lib/commercial-engine/fixtures/fixture-types.ts`
- `lib/commercial-engine/fixtures/expected-results.ts`
- `lib/commercial-engine/fixtures/scenario-map.ts`
- `lib/commercial-engine/fixtures/canonical-line-fixtures.ts`
- `lib/commercial-engine/fixtures/canonical-aggregate-fixtures.ts`
- `scripts/verify-batch-2b3b-golden-commercial-engine.ts`

### Modified

- `docs/decisions/STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`
- `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md` (CCS-042 null margin)
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`
- `docs/specifications/SCENARIO_COVERAGE_MATRIX.md`
- `lib/commercial-engine/core/profit.ts`
- `lib/commercial-engine/core/types.ts`
- `lib/commercial-engine/calculations/*` (lump, qty, productivity, aggregate, calculate-line)
- `lib/commercial-engine/versioning/index.ts`
- `lib/commercial-engine/fixtures/compare.ts`
- `lib/commercial-engine/fixtures/index.ts`
- `lib/commercial-engine/fixtures/types.ts`
- `lib/commercial-engine/index.ts`

## 14. Commands run

```
npx tsx scripts/verify-batch-2b3b-golden-commercial-engine.ts
npx tsc --noEmit
npm run lint
npm run build
```

(No separate 2B.3A verify script existed to re-run.)

## 15. Known limitations

- 5 CCS scenarios remain non-executable in the pure kernel (persistence / estimate ranges / pricing-action / DNA).
- Automatic labour-floor product, Company DNA, discounts/credits, and live GST overwrite bug (C-28) are still out of scope.
- Assumption warning codes are structured metadata passthrough — not AI narrative.

## 16. Confirmation engine remains disconnected from app

Grep shows no application, server-action, React, or Supabase imports of `@/lib/commercial-engine`. Only the golden verification script and the library itself reference it. Live pricing still uses existing `lib/pricing/*` paths.

## 17. Recommendation for Batch 2B.3C or 2B.4

Proceed to **Batch 2B.4** (document aggregation adoption prep / deeper aggregate APIs if needed) or a thin **2B.3C** documentation/parity checklist batch if desired — but **do not** begin shadow parity (2B.5) or application adoption (2B.6+) until explicitly authorised. Prefer starting **2B.4** only if aggregate API gaps remain; otherwise **2B.5 shadow parity** is the next behaviour-safe step after kernel + goldens.

---

## Future Learning Compatibility Check

| # | Question | Answer |
| ---: | --- | --- |
| 1 | Does this improve current customer trust? | Yes — commercial truth is now executable and fail-closed against approved goldens, before any live adoption. |
| 2 | Are expected commercial outcomes explicit? | Yes — golden docs + fixtures encode cost/sell/GP/margin/GST. |
| 3 | Are results explainable? | Yes — deterministic step IDs and formula IDs; no invented AI narrative. |
| 4 | Can calculations be replayed? | Yes — pure inputs → outputs; version fields stamped. |
| 5 | Can future manual corrections be compared to golden truth? | Yes — override metadata + golden comparator support. |
| 6 | Are historical results protected? | Spec/deferred scenarios encode immutability; kernel does not rewrite history (no persistence yet). |
| 7 | Is Company DNA kept separate from arithmetic? | Yes — learning hooks are metadata only (`auto_update_company_rules: false`). |
| 8 | Is backward compatibility preserved? | Yes — live app pricing unchanged; engine disconnected. |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2B_BATCH_2B3B_COMPLETION.md` |
| Batch | 2B.3B |
| Application adoption | **None** |
