# Commercial Engine Contract

**Status:** Authoritative for Batch 2B.3C+  
**Engine package:** `lib/commercial-engine/`  
**Engine version:** `2B.3C.0`  
**Formula version:** `2B.mvp.1`  
**Adoption:** Not wired to the live application  

---

## 1. Purpose

Define the canonical, technology-independent public contract for Quotr’s standalone commercial calculation engine so every result is deterministic, immutable, replayable, explainable from structured inputs, versioned, and commercially correct — before legacy parity or application adoption.

## 2. Engine boundary

**In boundary**

- Pure arithmetic for line items and document aggregates
- Validation, warnings, structured steps, override metadata, learning hooks
- Normalization, serialization, deep immutability, same-version replay

**Out of boundary**

- React, Supabase, persistence, server actions, UI
- Reading company settings from a database
- AI narrative, confidence, market advice
- Company DNA rule writes
- Automatic constraint/contingency modifiers not supplied as inputs
- Credits and discounts (Stage 2B)

Arithmetic depends only on values present on the request. Wall-clock time and random IDs must not affect money.

## 3. Request contract

`CommercialCalculationRequest`

| Field | Role |
| --- | --- |
| `requestId` | Traceability only — not arithmetic |
| `calculationKind` | `line_item` \| `document_aggregate` |
| `calculationMode` | Mode or `document_aggregate` |
| `engineVersionRequested` | Optional requested engine version |
| `formulaVersionRequested` | Optional requested formula version |
| `currency` | Currently `NZD` |
| `input` | Explicit line or aggregate body |
| `commercialSettings` | Snapshot of settings (defaults advisory; explicit input fields drive math) |
| `source` | Provenance / source references |
| `manualOverrides` | Structured override captures |
| `explicitModifiers` | e.g. waste percent |
| `calculationTimestamp` | Snapshot metadata only — never used in arithmetic |

Builders: `buildLineRequest`, `buildAggregateRequest`.

## 4. Calculation record contract

`CommercialCalculationRecord` is the authoritative snapshot of a calculation.

Identity: `requestId`, `calculationId`, `engineVersion`, `formulaVersion`, `calculationKind`, `calculationMode`, `currency`, `ok`.

Plus input snapshot, settings, modifiers, overrides, provenance, outputs, steps, blocking errors, warnings, assumptions, explanation keys, future-learning hooks, optional timestamp, and `normalizedRequestJson`.

## 5. Input snapshot

Normalised copy of every field that affected (or was declared for) the calculation.

- Line: quantity, rates, totals, productivity, margin target, waste, visibility, assumptions
- Aggregate: inclusion rule, GST rate presence, ordered lines with cost/sell/`cost_known`

**Absent / unknown / zero are distinct:** omitted → `null` in snapshots; numeric `0` means intentional zero.

## 6. Output fields

`CommercialFinancialOutputs` (null when blocking validation fails):

| Field | Notes |
| --- | --- |
| `costKnown` | False when cost unknown — do not fabricate margin |
| `totalCost` / `totalSell` | Money (2 dp) |
| `grossProfit` / `grossMarginPercent` / `markupPercent` | Null when cost unknown |
| `gstExclusiveTotal` | Sell subtotal |
| `gstAmount` / `gstInclusiveTotal` / `gstRatePercent` | Aggregate when GST applied |

## 7. Structured steps

Stable codes in `STEP_CODES` (examples): `BASE_QUANTITY`, `WASTE_QUANTITY`, `LABOUR_HOURS`, `BASE_COST`, `SELL_FROM_MARGIN`, `LUMP_SUM_TOTALS`, `GROSS_PROFIT`, `GROSS_MARGIN`, `PROFIT_UNKNOWN`, `DOCUMENT_SUBTOTAL`, `GST`, `TOTAL_INCLUDING_GST`.

Each step: `code`, `operationType`, `inputReferences`, `values`, `result`, `precisionTreatment`, `explanationKey`, `formulaId`, optional `legacyStepId`.

Only steps that genuinely occurred are emitted. Sell-only unknown-cost paths emit `PROFIT_UNKNOWN`, not fabricated margin derivation.

## 8. Assumptions

Only assumptions explicitly supplied on the input (or deterministically implied by mode metadata passthrough). The engine does not invent project assumptions.

## 9. Warnings and errors

Stable taxonomies in `BLOCKING_ERROR_CODES` and `WARNING_CODES`.

**Blocking** → `ok: false`, `outputs: null` (invalid mode, non-finite, negatives, margin/GST bounds, missing required fields, …).

**Warnings** → calculation may succeed (cost unknown, profitability unknown, sell-only lump, manual override applied, wastage applied, visibility filter, version mismatch on replay, …).

Unknown-cost is a **warning**, never a fabricated 100% margin.

## 10. Manual overrides

`ManualOverrideCapture`: field, original value, override value, reason category, source, user reference, timestamp, `affected_arithmetic`.

Overrides are never silently discarded. Presence emits `manual_override_applied` warning metadata on the contract record.

## 11. Provenance

`SourceProvenance`: `source_references`, optional `actor_ref`, optional `origin`. Traceability only.

## 12. Future-learning hooks

`FutureLearningHook`: `candidateType`, optional target/evidence/constraint/override references, `eligibleForFutureReview`.

**Metadata only.** Hooks must not alter arithmetic. No automatic company-rule write.

## 13. Deterministic normalization

`normalizeRequestFingerprint` / `canonicalizeValue`:

- Strip `undefined`
- Preserve `null`
- Reject non-finite numbers
- Sort object keys
- Preserve array order (line order is commercially meaningful)
- Exclude `requestId` and `calculationTimestamp` from arithmetic fingerprints

## 14. Serialization

`serializeCanonical` → locale-independent JSON. Round-trip via `parseCanonicalJson` / `roundTripCanonical` must preserve replayable values.

## 15. Immutability

`deepFreeze` recursively freezes records (including children of already-frozen parents). TypeScript `readonly` types on the contract. Replay must not mutate the source record.

## 16. Replay

`verifyCalculationReplay(record)` / `replayCalculation(record)`:

1. If engine or formula version ≠ current supported pack → controlled `unsupported_*` status; **do not rewrite** historic money.
2. Else reconstruct request from the record, re-execute, compare outputs and step codes.
3. Return structured differences; confirm `sourceUnchanged`.

Exact replay is required for same-version records. Replay does not recalculate a sent quote into a new commercial value for persistence — it verifies parity only.

## 17. Version governance

| Kind | When to bump | Current |
| --- | --- | --- |
| **Engine** (`ENGINE_VERSION`) | Contract shape, execution behaviour, warning/error semantics, step generation, replay mechanics | `2B.3C.0` |
| **Formula** (`FORMULA_VERSION`) | Margin, GST, waste, rounding sequence, mode arithmetic semantics | `2B.mvp.1` |

Documentation-only changes do not bump versions. Before any bump: run golden regression (`verify-batch-2b3b-golden-commercial-engine.ts`) and contract verification (`verify-batch-2b3c-engine-contract.ts`). Historic snapshots with older versions return unsupported-version on replay; they must not be silently mutated.

## 18. Historical snapshot rules

- Stored records are immutable commercial truth for their version.
- Later engine/formula versions must not rewrite historical totals.
- Adoption layers (quotes) must persist the record/snapshot, not re-derive silently.

## 19. Security boundary

- No secrets in the contract.
- No organisation DB access inside the engine.
- Callers supply org-scoped inputs after authz (when adopted).
- Engine remains free of React/Supabase imports.

## 20. Adoption requirements

Before wiring into pricing/estimate/quote actions:

1. Shadow parity (Batch 2B.5) against legacy paths.
2. Persist `CommercialCalculationRecord` (or equivalent) with versions.
3. Never call the engine with implicit live company reads for arithmetic.
4. Preserve manual overrides and unknown-cost honesty.
5. UI/AI may translate `explanationKeys` / steps — must not invent unsupported commercial claims.

---

## Public API (contract layer)

```
executeCommercialCalculation(request) → CommercialCalculationRecord
verifyCalculationReplay(record) → ReplayVerificationResult
buildLineRequest / buildAggregateRequest
serializeCanonical / deepFreeze
BLOCKING_ERROR_CODES / WARNING_CODES / STEP_CODES / EXPLANATION_KEYS
```

Kernel entry points `calculateLineItem` / `calculateDocumentAggregate` remain available for golden fixtures and internal use.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md` |
| Batch | 2B.3C |
| Application adoption | **None** |
