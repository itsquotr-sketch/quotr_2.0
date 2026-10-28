# Stage 3D — straight-lay carpet tiles

Baseline `estimating/v3` at `c1d745bdaa02336e38061890a6244bdece16ce38`. This prices ordinary modular carpet tiles, straight lay, on a ready substrate. Broadloom carpet stays on its own package. Production is unchanged. No P&G recipe and no calibration change.

## Supported assembly

Ordinary modular carpet tiles, straight lay, on a ready substrate.

An unstated pattern is asked. The proposed assumption is straight lay. It is not stored as something the brief said. Herringbone, ashlar, brick, quarter-turn and other patterns stay visible and unpriced.

The original office brief is 120 m² of carpet tiles and does not state a waste percentage. That area stays 120 m². It is not converted to 132 m². Unanswered waste is not treated as zero. The proposed assumption is a 5% supply allowance, applied only after it is confirmed. Explicit zero waste keeps supply at the net area. A stated percentage applies to finish supply only.

## Quantities

| Component | Basis | Office brief before answers | After confirmed 5%, size and box unknown, adhesive, separate supply |
| --- | --- | --- | --- |
| Net area | Agreed area | 120 m² | 120 m² |
| Carpet tile supply | Net × (1 + confirmed allowance), or a tile/box count only when those dimensions are known | Unresolved | 126 m² |
| Tile count | Only when width and length are known. A straight-lay grid from room length and width is not stacked with a second percentage | None | None |
| Boxes | Only when box coverage, or tiles per box plus a tile count, is known | None | None |
| Adhesive or tackifier | Net area, or whole units only when that product's coverage is known | Unresolved | 120 m² |
| Installation | Net area × company hours per m². Supply waste is not added | Unresolved | 120 m², 18.0 h at 0.15 h/m² |
| Combined package | Net area, and only after waste and fixing coverage are confirmed | Not selected | Not this column |
| Underlay | Not added. A request stays visible and unpriced | None | None |
| Preparation, removal, disposal | Only when separately requested | Removal already done, so no removal line | Same |

Controlled company rates, 20% margin: supply $40/m², adhesive $2.50/m², 0.15 h/m², carpenter $75/h. Direct cost $6,690. Sell is derived from that cost. No Quotr carpet-tile benchmark and no broadloom `flooring.carpet.m2` rate.

## Rates

These rows have no default cost and no default hours:

- `flooring.carpet_tile.straight.supply.m2`
- `flooring.carpet_tile.straight.supply.box`
- `flooring.carpet_tile.straight.supply.tile`
- `flooring.carpet_tile.adhesive.m2`
- `flooring.carpet_tile.adhesive.unit`
- `flooring.carpet_tile.tackifier.m2`
- `flooring.carpet_tile.tackifier.unit`
- `flooring.carpet_tile.straight.install.hours_per_m2`
- `flooring.carpet_tile.straight.supply_install.m2`

A missing value stays on the estimate with its quantity and opens that rate. A project material override in the same unit beats the company rate. A mismatched unit is not converted.

Customer-supplied tiles stay visible at a contractor purchasing cost of 0. Selected fixing and installation remain. The package is not also charged.

## Not in this recipe

- Broadloom carpet, including its underlay package.
- Patterns other than straight lay.
- A substrate that is not confirmed ready. Preparation stays visible and unpriced.
- A fixing system other than adhesive, tackifier, or none.
- Invented tile sizes, box sizes, waste percentages, or product coverage.
- P&G, painting, partitions, doors and skirting. Pricing carpet tiles does not make the office job complete.
- Production deployment.

## Hosted office result

Preview project “Stage 3D carpet tiles” on the isolated Preview organisation. The original brief stayed 120 m² of carpet tiles, with existing flooring already removed, so there is no removal line. Straight lay, a ready substrate, the proposed 5% supply allowance, unknown tile size, unknown box coverage, pressure-sensitive adhesive, and separate company supply were answered in Details. No underlay was added.

Before those company rates existed, supply was 126 m² unpriced, adhesive was 120 m² unpriced, and installation stayed on 120 m² with no hours. The known sell on the rest of the job was not a carpet price and was labelled as priced work only.

After the named rate actions and an explicit regenerate:

| Line | Quantity | Direct cost | Client sell |
| --- | --- | --- | --- |
| Carpet tile supply | 126 m² at the company $40/m² | $5,040 | $6,300 |
| Adhesive | 120 m² at the company $2.50/m² | $300 | $375.60 |
| Installation | 19.80 h at the company carpenter $75/h | $1,485 | $1,856.25 |
| Flooring total | | $6,825 | $8,531.85 |

The recipe hours are 120 m² × 0.15 person-hours/m² = 18 h, and the no-condition direct cost is $6,690. This occupied office applies the existing modifiers once: occupied site +5% and restricted hours/delivery windows +5%. Access was Easy and carry was under 10 m, so those addends stay zero. The adjusted hours are 19.8 h, and 19.8 h × $75/h = $1,485 cost. The takeoff names those two contributors. Productivity and the hourly cost are company rates, not a carpet-tile benchmark. The modifier values are unchanged.

Adhesive sell follows the quantity-rate convention. The unit sell is rounded first: $2.50 ÷ 0.80 = 3.125, which rounds half up to $3.13. The extended sell is then 120 × $3.13 = $375.60. The extended cost is 120 × $2.50 = $300.00. Starting from the line cost instead, $300 ÷ 0.80 = $375.00, is a different form and is not used for a quantity rate. A quantity of 3 m² separates the two: the unit-first sell is $9.39, while rounding the $7.50 line cost would be $9.38. Pricing keeps the estimate totals and shows the unit as that total divided by the stored quantity, so the displayed adhesive unit sell is $3.13. A saved company sell rate is extended as entered. A $4.00/m² sell on 120 m² stays $480 and is not replaced by the margin. Extended totals still use whole-dollar display. Unit rates keep cents, so the materials takeoff shows the company cost as $2.50/m².

Straight lay and the 5% supply allowance stay reviewable. Confirming either proposal records it as a disclosed assumption. A later extraction keeps that authority and does not turn it into a statement from the brief. An unanswered pattern or allowance stays unanswered and unpriced. A brief that actually says straight lay remains an extracted fact.

Pricing reconciliation updated the three flooring charges and left the wall, door, skirting, and exclusion lines unchanged. The priced-work recommendation became $12,685.39. Custom framing, insulation labour, and the custom door leaf stay Pricing Required. P&G stays an unpriced gap. GST was not decided, pricing was not marked reviewed, and no quote was created. The office job is not complete.

## Acceptance

Accepted for ordinary modular carpet tiles, straight lay, on a ready substrate, using the company rates above and the existing labour modifiers.

The adhesive charge of $375.60 is the documented unit-first sell: $3.13/m² × 120 m². It is not an early-rounding error, and the money engine is unchanged. The materials takeoff shows the $2.50/m² company cost separately from the $300 extended cost and the $375.60 client sell. The installation explanation is 120 m² × 0.15 person-hours/m² = 18 h, then occupied site and restricted hours/delivery windows once, then 19.8 h × $75/h = $1,485.

Limitations that remain: other laying patterns, an unconfirmed substrate, invented tile or box sizes, underlay, preparation, P&G, painting, partitions, doors and skirting. An unanswered pattern or waste allowance is not a confirmed specification. Production is not deployed. The office job is not complete.
