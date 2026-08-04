# Golden Scenario Execution Map

**Batch:** 2B.3B — Golden Scenario Regression Suite  
**Date:** 2026-08-04  
**Authority:** `CANONICAL_COMMERCIAL_SCENARIOS.md` · `GOLDEN_PRICING_EXPECTED_RESULTS.md` · `STAGE_2B_OWNER_COMMERCIAL_DECISIONS.md`  
**Engine:** `lib/commercial-engine/` (standalone; not wired to app)

Every CCS-001…CCS-052 scenario has exactly one execution classification.

**Classifications:**

| Code | Meaning |
| --- | --- |
| `Executable now — line item` | Pure line kernel fixture |
| `Executable now — aggregate/document` | Pure aggregate kernel fixture |
| `Documentation-only — future workflow` | Spec truth only; no pure-kernel executable path yet |
| `Deferred — requires live persistence` | Needs snapshot/persistence behaviour |
| `Deferred — requires UI` | Needs UI-only behaviour |
| `Deferred — requires Company DNA` | Needs DNA / learning product |
| `Deferred — requires pricing-action integration` | Needs live pricing-action adoption |

Expected results source for all executable scenarios: `docs/specifications/GOLDEN_PRICING_EXPECTED_RESULTS.md` (unless noted).

---

## Summary

| Classification | Count |
| --- | --- |
| Executable now — line item | 32 |
| Executable now — aggregate/document | 15 |
| Documentation-only — future workflow | 1 |
| Deferred — requires live persistence | 2 |
| Deferred — requires pricing-action integration | 1 |
| Deferred — requires Company DNA | 1 |
| **Total** | **52** |

Executable kernel coverage: **47 / 52 (90.4%)**.  
Deferred / documentation-only: **5 / 52 (9.6%)**.

Supplemental coverage fixtures (EXT-*) exercise GST bounds, rounding drift, and extra validation paths required by Batch 2B.3B acceptance. They are not part of the 52 CCS IDs.

---

## Scenario map

| Scenario ID | Category | Execution classification | Engine capability tested | Fixture file | Expected result source | Deferred dependency | Reason for deferral | Future batch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CCS-001 | A | Executable now — line item | quantity_rate + sell-from-margin | `canonical-line-fixtures.ts` | Golden CCS-001 | — | — | — |
| CCS-002 | B, C | Executable now — line item | productivity_labour | `canonical-line-fixtures.ts` | Golden CCS-002 | — | — | — |
| CCS-003 | A, C | Executable now — line item | waste before money | `canonical-line-fixtures.ts` | Golden CCS-003 | — | — | — |
| CCS-004 | C | Executable now — aggregate/document | labour + materials package + GST | `canonical-aggregate-fixtures.ts` | Golden CCS-004 | — | — | — |
| CCS-005 | D | Executable now — aggregate/document | labour + materials + subcontractor | `canonical-aggregate-fixtures.ts` | Golden CCS-005 | — | — | — |
| CCS-006 | E | Executable now — line item | lump sum cost+sell | `canonical-line-fixtures.ts` | Golden CCS-006 | — | — | — |
| CCS-007 | F | Executable now — line item | allowance lump + warning | `canonical-line-fixtures.ts` | Golden CCS-007 | — | — | — |
| CCS-008 | G | Executable now — line item | provisional lump + warning | `canonical-line-fixtures.ts` | Golden CCS-008 | — | — | — |
| CCS-009 | H | Executable now — line item | intentional zero / no-charge | `canonical-line-fixtures.ts` | Golden CCS-009 | — | — | — |
| CCS-010 | I | Executable now — line item | informational zero-money line | `canonical-line-fixtures.ts` | Golden CCS-010 | — | — | — |
| CCS-011 | J | Executable now — line item | travel lump | `canonical-line-fixtures.ts` | Golden CCS-011 | — | — | — |
| CCS-012 | K | Executable now — line item | airport loading lump | `canonical-line-fixtures.ts` | Golden CCS-012 | — | — | — |
| CCS-013 | L, C | Executable now — aggregate/document | occupied productivity package | `canonical-aggregate-fixtures.ts` | Golden CCS-013 | — | — | — |
| CCS-014 | M, B | Executable now — line item | access-adjusted hours (input) | `canonical-line-fixtures.ts` | Golden CCS-014 | — | — | — |
| CCS-015 | N | Executable now — line item | restricted-hours allowance | `canonical-line-fixtures.ts` | Golden CCS-015 | — | — | — |
| CCS-016 | O | Executable now — line item | long-carry allowance | `canonical-line-fixtures.ts` | Golden CCS-016 | — | — | — |
| CCS-017 | P, D | Executable now — aggregate/document | steep-site package | `canonical-aggregate-fixtures.ts` | Golden CCS-017 | — | — | — |
| CCS-018 | Q, C | Executable now — aggregate/document | multi work-area totals | `canonical-aggregate-fixtures.ts` | Golden CCS-018 | — | — | — |
| CCS-019 | R, S | Deferred — requires live persistence | quote revision immutability | — | Golden CCS-019 | persistence / quote revisions | Pure kernel cannot assert snapshot immutability | 2B.8 |
| CCS-020 | S | Deferred — requires live persistence | historical quote after rate rise | — | Golden CCS-020 | persistence / snapshots | Needs immutable stored quote | 2B.8 |
| CCS-021 | T | Executable now — aggregate/document | GST 15% once at document | `canonical-aggregate-fixtures.ts` | Golden CCS-021 | — | — | — |
| CCS-022 | T | Executable now — aggregate/document | document GST rate authority | `canonical-aggregate-fixtures.ts` | Golden CCS-022 | — | — | — |
| CCS-023 | U | Executable now — line item | target margin 25% override | `canonical-line-fixtures.ts` | Golden CCS-023 | — | — | — |
| CCS-024 | V | Executable now — aggregate/document | mixed margins → blended from totals | `canonical-aggregate-fixtures.ts` | Golden CCS-024 | — | — | — |
| CCS-025 | W | Documentation-only — future workflow | estimate range bands | — | Golden CCS-025 | estimate workflow | Range heuristics outside pure money kernel | 2B.7 |
| CCS-026 | X | Executable now — line item | manual hours override metadata | `canonical-line-fixtures.ts` | Golden CCS-026 | — | — | — |
| CCS-027 | B, Y | Executable now — line item | labour-only productivity | `canonical-line-fixtures.ts` | Golden CCS-027 | — | — | — |
| CCS-028 | A, Y | Executable now — line item | material-only quantity_rate | `canonical-line-fixtures.ts` | Golden CCS-028 | — | — | — |
| CCS-029 | D, Y | Executable now — line item | subcontractor-only lump | `canonical-line-fixtures.ts` | Golden CCS-029 | — | — | — |
| CCS-030 | C, Z | Executable now — aggregate/document | multi-trade package | `canonical-aggregate-fixtures.ts` | Golden CCS-030 | — | — | — |
| CCS-031 | A | Executable now — line item | timber framing qty×rate | `canonical-line-fixtures.ts` | Golden CCS-031 | — | — | — |
| CCS-032 | D | Executable now — aggregate/document | steel portal sub + labour | `canonical-aggregate-fixtures.ts` | Golden CCS-032 | — | — | — |
| CCS-033 | A | Executable now — line item | concrete pad qty×rate | `canonical-line-fixtures.ts` | Golden CCS-033 | — | — | — |
| CCS-034 | B | Executable now — line item | window install productivity | `canonical-line-fixtures.ts` | Golden CCS-034 | — | — | — |
| CCS-035 | C | Executable now — aggregate/document | cladding labour + materials | `canonical-aggregate-fixtures.ts` | Golden CCS-035 | — | — | — |
| CCS-036 | A, C | Executable now — aggregate/document | roofing waste + labour | `canonical-aggregate-fixtures.ts` | Golden CCS-036 | — | — | — |
| CCS-037 | A | Executable now — line item | vinyl waste qty×rate | `canonical-line-fixtures.ts` | Golden CCS-037 | — | — | — |
| CCS-038 | Q, D, Z | Executable now — aggregate/document | commercial package totals | `canonical-aggregate-fixtures.ts` | Golden CCS-038 | — | — | — |
| CCS-039 | E, J | Executable now — line item | site establishment lump | `canonical-line-fixtures.ts` | Golden CCS-039 | — | — | — |
| CCS-040 | R, C | Executable now — line item | variation line money (not workflow) | `canonical-line-fixtures.ts` | Golden CCS-040 | — | Variation workflow deferred; money executable | 2B.8 workflow |
| CCS-041 | E | Executable now — line item | zero-qty lump allowed | `canonical-line-fixtures.ts` | Golden CCS-041 | — | — | — |
| CCS-042 | E | Executable now — line item | sell-only; null margin | `canonical-line-fixtures.ts` | Golden CCS-042 (2B.3B null margin) | — | — | — |
| CCS-043 | validation | Executable now — line item | reject negative credit | `canonical-line-fixtures.ts` | Golden CCS-043 | — | — | — |
| CCS-044 | validation | Executable now — line item | reject margin > 95% | `canonical-line-fixtures.ts` | Golden CCS-044 | — | — | — |
| CCS-045 | Q, R | Executable now — aggregate/document | visible_only vs all | `canonical-aggregate-fixtures.ts` | Golden CCS-045 | — | — | — |
| CCS-046 | X, U | Deferred — requires pricing-action integration | recalibration preserve manual | — | Golden CCS-046 | pricing actions | Needs live recalibration path | 2B.6–2B.9 |
| CCS-047 | E | Executable now — line item | scaffold lump | `canonical-line-fixtures.ts` | Golden CCS-047 | — | — | — |
| CCS-048 | F | Executable now — line item | contingency allowance | `canonical-line-fixtures.ts` | Golden CCS-048 | — | — | — |
| CCS-049 | Q, C, Z | Executable now — aggregate/document | extension multi-area | `canonical-aggregate-fixtures.ts` | Golden CCS-049 | — | — | — |
| CCS-050 | N, F, Z | Executable now — line item | weekend allowance lump | `canonical-line-fixtures.ts` | Golden CCS-050 | — | — | — |
| CCS-051 | B, Y | Executable now — line item | minimum labour hours (pre-applied) | `canonical-line-fixtures.ts` | Golden CCS-051 | — | Auto floor product deferred; floored input executable | DNA / later |
| CCS-052 | Y, Z, X | Deferred — requires Company DNA | DNA fencing uplift evidence | — | Golden CCS-052 | Company DNA | Learning product must not alter arithmetic | Stage 6 / DNA |

---

## Supplemental executable fixtures (not in CCS-052)

| ID | Classification | Purpose | Fixture file |
| --- | --- | --- | --- |
| EXT-MARGIN-0 | line | 0% margin boundary | `canonical-line-fixtures.ts` |
| EXT-MARGIN-95 | line | 95% margin boundary | `canonical-line-fixtures.ts` |
| EXT-QTY-ZERO | validation | zero quantity invalid for quantity_rate | `canonical-line-fixtures.ts` |
| EXT-QTY-NEG | validation | negative quantity invalid | `canonical-line-fixtures.ts` |
| EXT-PROD-ZERO | validation | zero productivity invalid | `canonical-line-fixtures.ts` |
| EXT-PROD-NEG | validation | negative productivity invalid | `canonical-line-fixtures.ts` |
| EXT-NONFINITE | validation | non-finite input invalid | `canonical-line-fixtures.ts` |
| EXT-INVALID-MODE | validation | invalid mode | `canonical-line-fixtures.ts` |
| EXT-GST-0 | aggregate | GST 0% | `canonical-aggregate-fixtures.ts` |
| EXT-GST-10 | aggregate | non-15% GST (10%) | `canonical-aggregate-fixtures.ts` |
| EXT-GST-100 | aggregate | GST 100% boundary | `canonical-aggregate-fixtures.ts` |
| EXT-GST-INVALID | validation | GST outside 0–100 | `canonical-aggregate-fixtures.ts` |
| EXT-ROUND-DRIFT | aggregate | cumulative rounding drift guard | `canonical-aggregate-fixtures.ts` |

---

## Document control

| Field | Value |
| --- | --- |
| Path | `docs/specifications/GOLDEN_SCENARIO_EXECUTION_MAP.md` |
| Batch | 2B.3B |
| Application code adoption | None |
