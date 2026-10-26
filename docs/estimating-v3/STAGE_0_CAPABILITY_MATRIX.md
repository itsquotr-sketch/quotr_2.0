# Estimating V3 Stage 0 — capability and protection inventory

Catalogue source: `lib/scopes/catalogue.ts` on `40d98384`. “Calculator” in the catalogue means a calculator module exists. It does not mean every subtype has a priced recipe. Rows marked “not re-run” were identified from the module map and were not executed in this pass.

## Rate and productivity precedence

From `resolveRate`, `resolveLabourRate`, and `classifyResolvedSell`:

1. Active company row with the same `item_key` and `rate_type`, including an approved alias. Its cost is used. If that row also has a sell, the sell is `legacy_paired_rate` and gross margin is not applied. If it has cost only, sell is derived from the organisation gross margin.
2. For a lookup with an empty item key only, a blank-key company rate of the same work-area type, rate type, and unit. Named components do not accept a blank key. `BLANK_ITEM_KEY_NAMED_COMPONENT_COMPATIBILITY` is empty.
3. Quotr benchmark cost when `allow_benchmark_rates` is not false. Sell is derived from gross margin unless the caller passed a fallback sell, which becomes a paired sell.
4. Otherwise the line is missing and stays Pricing Required. The benchmark is not invented in that case.

Labour, when no company labour row matches the trade order:

| Trade lookup | Cost | Sell |
| --- | --- | --- |
| Carpenter, then general | $60 / hour | Gross margin on that cost |
| Labourer, then general, then carpenter | $35 / hour when the labourer benchmark is the one used | Gross margin on that cost |
| Apprentice, then general, then carpenter | The first company row in that order, otherwise the carpenter fallback | Same sell rule |

Company labour cost and a paired company sell stay above those benchmarks. Units on the rate row must match the lookup unit after `m²` / `m2` normalisation. A `$/lm` row does not satisfy a `$/m²` lookup.

Deck decking has an extra material rule in `resolve-material-rate.ts`: a company `$/m²` for the same boards may convert to `$/lm` by `board_width_mm / 1000` when width is known. Waste already in the purchase quantity is not applied again. That conversion is specific to that rule. It is not a general unit converter.

Productivity keys follow the same company-over-benchmark idea inside each recipe (`user_rate` or `calibrated_productivity` before the Quotr hours). This pass did not re-read every productivity key.

## Sell authority

`deriveSellFromCost` is `cost / (1 - margin/100)`. Default margin when settings are null is 20%. That is gross margin, not markup.

The bathroom case in the fixture:

| Path | Cost | Sell | Authority |
| --- | --- | --- | --- |
| Live `resolveRate` for `bathroom.tiling.m2` | 180 | 225 | `derived_from_gross_margin` |
| Stored `BATHROOM_BENCHMARKS.tilingPerM2.sell` if it were passed in | 180 | 280 | `legacy_paired_rate` |
| 20% markup on 180 | 180 | 216 | Not what the live fallback does |

`applyProjectGrossMarginToCost` replaces a paired sell from cost. It does not stack margin on top of the paired sell. Existing paired company sells are left as stored until a user or an explicit project-margin action changes them. This pass did not run that action on stored rows.

## Shared ownership and double counting

| Pair | What the code does | Double-count finding |
| --- | --- | --- |
| Deck post count and hole count | Different facts. The posts gap reads one and the focused field writes the other. | Not a double charge. An unanswered post count beside a saved hole count. |
| Deck hole excavation, post install, concrete place | Separate hour keys in the deck recipe. | Separate when each key is priced once. Not re-totalled in this pass. |
| Bathroom floor and Flooring | `clauseIsBathroomOwnedFloor` and `clauseIsKitchenOwnedFloor` skip those snippets inside `extractFlooringPortionsFromBrief`. | The skip exists. A combined brief was not priced in this pass, so no dollar double count is claimed. |
| Carpet tiles and broadloom carpet | Carpet tiles take the carpet finish and the carpet subcontract identity. | One recipe, the wrong product. Not two charges. |
| Laminate benchmark and laminate specialist line | The 110/165 pair is unused. The nested line is unpriced. | No double charge. The priced total stays 0. |
| Internal walls, plastering, ceilings | Separate catalogue types. Internal-wall extraction owns frame and lining on the partition brief. | No combined estimate was run. Do not assume they deduct each other. |
| Project conditions and work-area access | `site_access` is a constraint. Some deck facts also describe access and steps. | Two stores. Answering one does not write the other. |
| Project-wide P&G | No calculator emits `preliminary_allowance`. | No P&G line to double count. Work-area allowances remain local. |

## Work areas

| Type | Recognition | Details | Quantities and money | Known gap from this pass |
| --- | --- | --- | --- | --- |
| `deck` | Brief enrichment and deck facts | Clarify for non-REFINE deck facts. Post holes editor for hole facts. Generic hole questions are hidden. | `calculators/deck.ts`. Labour and material precedence as above. Subcontract is not the deck surface path. Customer-supplied boards are a supply fact, not re-audited here. | Post-count gap versus hole-count write. Excavation and concrete share one unfinished count. |
| `retaining_wall` | Catalogue calculator | Retaining information contract | `calculators/retaining-wall.ts` and the sleeper/timber/masonry modules | Not re-run. Spoil and excavation are a different contract from deck holes. |
| `bathroom` | Mature `bathroom.job_scope` path | Bathroom hard-minimum geometry and scope inside Clarify | `calculators/bathroom.ts`. Waterproofing and several trades are subcontractor allowances. Tiling uses `resolveRate`. Customer fixtures are PC sums in the fixture catalogue. | Live tiling sell is margin. Stored 280 sell is not the fallback. Floor ownership versus Flooring was not priced together. |
| `kitchen` | Catalogue calculator | Kitchen questions in the older template path | `calculators/kitchen.ts` | Not re-run. Kitchen-owned floor snippets are removed from Flooring extraction. |
| `fence` | Catalogue calculator | Fence extras in Clarify when length, height, and system are supported | `calculators/fence.ts` | Not re-run. |
| `pergola` | Catalogue calculator | Template questions | `calculators/pergola.ts` | Not re-run. |
| `external_stairs` | Catalogue calculator | Template questions | `calculators/external-stairs.ts` | Not re-run. |
| `demolition` | Catalogue calculator | Scope-item questions | `calculators/demolition.ts` | Not re-run. |
| `internal_walls` | `extractInternalWallsTypesFromBrief` | Nested wall-type fields | Calculator support is declared. Frame, lining, openings, and length are separate facts. | The 4.2 m partition brief stored height and timber frame only. Length and the door stayed null. |
| `ceilings` | Portion collection | Nested ceiling portion questions | Portion physical module | Not re-run. Same collection-write pattern as flooring. |
| `doors` | Portion collection | Nested door-set questions | Fitout/doors commercial module | Not re-run. |
| `flooring` | `extractFlooringPortionsFromBrief` | One candidate per missing portion field | Ordinary carpet, vinyl plank, tile, and hardwood can price. Specialist kinds do not. | Laminate unpriced. Carpet tiles become carpet. Second room dropped unless the next sentence starts with a finish verb. Board width and tile size cannot be saved from their option labels. |
| `painting` | Catalogue calculator | Template questions | Painting rates inside fitout | Not re-run. |
| `cladding` | Portion collection | Nested cladding questions | `calculators/cladding.ts`. Custom portions stay Pricing Required by the catalogue description. | Not re-run. |
| `plastering` | Catalogue calculator | Template questions | Fitout/plastering allowances | Not re-run. Overlap with internal-wall lining is unverified. |

Customer-supplied handling that is in the flooring model: `specialist_kind: client_supplied` and the logical key `flooring.client_supplied`. A client-supplied brief was not executed in the fixture. Do not describe its price from this pass.

Calibration rows are company productivity and rate overrides. They win under the precedence above. This pass did not read or write organisation rate tables.

## Protections this programme must keep

Saved work areas, portion JSON, scalar facts, constraints, company rates, productivity overrides, inclusions, exclusions, and issued quote snapshots stay readable. A calculation change does not rewrite them. Generate and quote issue remain explicit. Permissions, billing, signup, consent, and the Android play-surface gate are outside this branch’s parent and stay outside Stage 1.
