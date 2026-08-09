# Stage 3.1C.3-R2C — Rate Consumer Audit

**Date:** 2026-08-10  
**Status:** Complete — Local (R2C)

## Authority stack (runtime)

| Priority | Authority | Storage |
| --- | --- | --- |
| Highest (project) | Project override | Pricing / line edits |
| Company | Explicit company rate | `rates` row with `cost_rate` |
| Code | Quotr benchmark | `lib/estimate/benchmark-rates.ts` + catalogue defaults |
| Lowest | Missing / pricing required | No cost; UI must not invent $0 |

**No DB provenance column.** Source labels are computed at resolve/UI time.

## Schema (no migration)

`rates`: `cost_rate`, `sell_rate`, `markup_percent`, `rate_type`, `item_key`, `unit`, …  
Resolution requires **`cost_rate`** for a row to count as company authority. Sell may be margin-derived.

## Core consumers

| Rate key | Unit | Cost/Sell | Consumers | Status |
| --- | --- | --- | --- | --- |
| `labour.carpenter.hour` | hour | both | `resolveLabourRate` → most calculators | **Primary** |
| `labour.general.hour` | hour | both | Labour fallback | **Used** |
| `labour.labourer.hour` | hour | both | Only if `trade: "labourer"` (no calculator passes this) | **Planned / optional** |
| `deck.material.*.m2`, `deck.substructure.m2`, … | m2 | both | Deck calculator via `resolveRate` | **Used** |
| `fence.material.*.lm`, … | lm | both | Fence calculator | **Used** |
| `bathroom.waterproofing.allowance`, `bathroom.tiling.m2`, … | varies | both | Bathroom calculator | **Used** |
| `scope.deck.m2` and other `scope.*` package keys | m2/lm | both | **No production calculator** (catalogue `planned`) | **Legacy** |
| `allowance.subcontractor.default` | markup % | markup | Not read by estimate path | **Unused / deferred** |

## Material resolve helpers

`resolveMaterialRate` / `getScopeKeyForWorkArea` exist but are **not** on the production calculator path (verify-script / planned).

## Org settings

| Setting | Edited where | Note |
| --- | --- | --- |
| `default_margin_percent` | Rates → Defaults | Commercial default (20% / max 95%) |
| `default_gst_rate` | Company settings / Basics | Not owned by Rates UI |
| `prefer_user_rates` | Rates Defaults | Persisted; not read by resolve (user cost always wins) |
| `allow_benchmark_rates` | Rates Defaults | Gates benchmark fallback |

## R2C UX decisions

1. Primary Setup/Rates onboarding = labour + **used_now recommended component** rates for preferred work types.  
2. Generic `scope.*` moved to **Legacy benchmarks**.  
3. Catalogue `defaultCostRate` shown as **Quotr benchmark** until explicit adopt/edit.  
4. `createStarterRates` no longer copies benchmarks into `cost_rate`.
