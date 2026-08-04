# Stage 2B — Batch 2B.3C Completion Report

**Batch:** 2B.3C — Commercial Engine Contract, Replay, Explainability and Snapshot Hardening  
**Date:** 2026-08-04  
**Stage 2B status:** In Progress  
**Engine adoption:** None — disconnected from the live application  

---

## Objective

Freeze and harden the standalone commercial engine’s authoritative public contract so calculation records are deterministic, immutable, replayable, and explainable — before shadow parity or application adoption.

## Audit findings (pre-change)

| Area | Finding |
| --- | --- |
| Public exports | Kernel + fixtures; no canonical request/record |
| Request types | `CalculationLineInput` / `AggregateInput` only |
| Result types | `CalculationResult` / `AggregateResult` — shallow freeze |
| Mutable risks | Nested steps not always deeply frozen |
| Optional / ambiguous | `undefined` vs `null` vs `0` not normalised for snapshots |
| Version fields | Present; bump rules undocumented |
| Steps | Legacy string ids; not stable contract codes |
| Overrides | Metadata on input; not full capture on a canonical record |
| Learning hooks | Signals only; no structured evidence object |
| Serialization | None |
| Replay | None |
| Internal vs public | Fixtures appropriately separate; contract layer needed |

## Contract changes

Introduced `lib/commercial-engine/contract/`:

- `CommercialCalculationRequest` / `CommercialCalculationRecord`
- Deterministic normalize + canonical JSON serialize
- Deep freeze
- Structured step codes + explanation keys
- Warning/error taxonomy
- `executeCommercialCalculation` / `verifyCalculationReplay`
- Manual override captures + future-learning hooks (metadata only)

Kernel arithmetic unchanged (`FORMULA_VERSION` still `2B.mvp.1`). Legacy `calculateLineItem` / `calculateDocumentAggregate` retained for goldens.

## Files changed

### Created

- `lib/commercial-engine/contract/**` (codes, step-codes, types, deep-freeze, serialize, normalize, map-steps, build-record, execute, replay, index)
- `scripts/verify-batch-2b3c-engine-contract.ts`
- `docs/specifications/COMMERCIAL_ENGINE_CONTRACT.md`
- `docs/implementation/STAGE_2B_BATCH_2B3C_COMPLETION.md`

### Modified

- `lib/commercial-engine/versioning/index.ts` → engine `2B.3C.0`
- `lib/commercial-engine/index.ts` — export contract surface
- `docs/plans/STAGE_2B_IMPLEMENTATION_PLAN.md`
- `docs/MVP_HARDENING_GUIDE.md`

## Version changes

| Version | Before | After | Reason |
| --- | --- | --- | --- |
| Engine | `2B.3B.0` | `2B.3C.0` | Contract, steps, replay, immutability semantics |
| Formula | `2B.mvp.1` | `2B.mvp.1` | No arithmetic change |

## Replay support

Same-version exact replay for quantity-rate, productivity, lump (known + sell-only), and aggregate. Unsupported engine/formula versions return controlled statuses without rewriting money. Source records remain unchanged.

## Immutability support

`deepFreeze` recurses into children even when parents were pre-frozen. Contract verification asserts top-level, outputs, steps, hooks, and overrides are frozen.

## Warning/error taxonomy

Stable `BLOCKING_ERROR_CODES` and `WARNING_CODES` (validation, commercial, override, version, replay). Unknown cost → warning + null profit/margin.

## Verification results

`npx tsx scripts/verify-batch-2b3c-engine-contract.ts` → **37 passed / 0 failed**

## Golden regression result

`npx tsx scripts/verify-batch-2b3b-golden-commercial-engine.ts` → **60 passed / 0 failed**

## Known limitations

- Multi-version formula registry not implemented beyond current pack + unsupported response
- Override `override_value` may be null when only previous_values were supplied on legacy input (field + original captured)
- Aggregate commercialSettings GST is advisory; aggregate body `gst_rate_percent` is authoritative
- No persistence schema yet (by design)

## Future-learning compatibility

| # | Question | Answer |
| ---: | --- | --- |
| 1 | Improve customer trust? | Yes — explicit, versioned, replayable records before adoption |
| 2 | Every result explainable? | Yes — structured steps + explanation keys; no AI narrative |
| 3 | Every result replayable? | Yes — same-version exact; historic versions controlled |
| 4 | Manual changes preserved? | Yes — `ManualOverrideCapture` + hooks |
| 5 | Unknown values honest? | Yes — null margin/profit when cost unknown |
| 6 | DNA review without controlling arithmetic? | Yes — hooks metadata only |
| 7 | Historical records protected? | Yes — version mismatch does not rewrite |
| 8 | Independent of AI and persistence? | Yes |

## Confirmation

- No application adoption
- No migrations / database / UI / AI prompt changes

## Recommendation for next batch

Proceed to **Batch 2B.4** (document aggregation deepening if still needed) or **Batch 2B.5 shadow parity** when authorised. Do **not** begin pricing-action, estimate, or quote adoption until shadow parity passes.

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/implementation/STAGE_2B_BATCH_2B3C_COMPLETION.md` |
| Batch | 2B.3C |
| Application adoption | **None** |
