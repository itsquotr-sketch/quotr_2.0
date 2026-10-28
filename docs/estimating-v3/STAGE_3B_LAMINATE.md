# Stage 3B — floating click-lock laminate

Baseline `estimating/v3` at `d3c7c83766ef29110a9c7338cf91f460eac6dbef`. This is one laminate assembly. Glued and fastened laminate stay visible and unpriced. Production is unchanged. No carpet-tile recipe, no P&G change, and no calibration overhaul.

## Supported assembly

Floating click-lock laminate on a ready substrate.

An unstated installation method is asked. The proposed assumption is floating click-lock. It is not stored as something the brief said. A brief that names exactly one method may store that method as extracted. Conflicting method phrases stay unanswered.

## Quantities

Net area is the agreed room area. For the original brief, 6 m × 5 m and the stated 30 m² agree, so the net area is 30 m².

| Component | Basis | Original brief |
| --- | --- | --- |
| Laminate supply | Net × (1 + stated waste). Whole packs only when that pack's coverage is known. No second waste and no invented pack count. | 33 m², or 15 packs when a pack covers 2.2 m² |
| Underlay | Net area, or whole rolls when that roll's coverage is known. Laminate waste is not copied onto it. | 30 m² |
| Moisture barrier | Concrete only, and only when moisture control is confirmed as a separate product. Not added when the underlay includes that function. Timber gets no moisture line. | 30 m² when separate |
| Installation | Net area × company hours per m² × company carpenter hourly cost | 30 m² |
| Combined package | Net area at a company subcontract rate. The material rate is not added on top. | 30 m² |
| Preparation, removal, disposal, skirting | Not priced when the brief excludes them | No lines |

## Cost ownership

Separate supply uses the company material rate, the underlay rate, a moisture rate only when that line exists, the laminate installation productivity, and the company carpenter hourly cost.

A project material override in the same purchasing unit beats the company material rate. A mismatched unit is not converted and does not fall through.

The combined package is a company subcontract rate per net m². There is no Quotr laminate benchmark. The vinyl package is not reused. The unused `laminateFlooringPerM2` pair stays unused. The $60 carpenter benchmark does not price this installation.

Customer-supplied laminate keeps the supply quantity visible at a contractor purchasing cost of 0. Underlay is still charged when included. Installation stays on the net area. The combined package is not also charged.

## Rates

These catalogue rows have no default cost and no default hours:

- `flooring.laminate.click_lock.supply.m2`
- `flooring.laminate.click_lock.supply.pack`
- `flooring.laminate.underlay.m2`
- `flooring.laminate.underlay.roll`
- `flooring.laminate.moisture_barrier.m2`
- `flooring.laminate.moisture_barrier.roll`
- `flooring.laminate.click_lock.install.hours_per_m2`
- `flooring.laminate.click_lock.supply_install.m2`

A missing value stays on the estimate with its quantity and opens that rate. Pack, roll, and m² are not converted into one another.

## Controlled example

Separate supply, 20% margin, company rates only: laminate $40/m², underlay $8/m², separate moisture barrier $3/m², 0.2 h/m², carpenter $75/h.

| Line | Quantity | Direct cost | Sell |
| --- | --- | --- | --- |
| Laminate supply | 33 m² | $1,320.00 | $1,650.00 |
| Underlay | 30 m² | $240.00 | $300.00 |
| Moisture barrier | 30 m² | $90.00 | $112.50 |
| Installation | 30 m², 6.0 h | $450.00 | $562.50 |
| Total |  | $2,100.00 | $2,625.00 |

Changing one setting changes only its own money. Laminate $50/m² makes supply $1,650 and the total $2,430. A project override of $45/m² makes supply $1,485 and is labelled as the work-area rate. Productivity 0.3 h/m² makes labour $675. Carpenter $80/h makes labour $480. Integrated moisture control removes the $90 barrier. Customer-supplied laminate leaves purchasing at $0 and the remaining direct cost at $780.

## Not in this recipe

- Glued or nailed laminate. The area stays visible and unpriced, and this recipe is not applied.
- Carpet tiles.
- Floor preparation, removal, disposal, or skirting unless a later answer includes them.
- An invented pack or roll count.
- A second moisture barrier when the underlay already includes that function.
- Production deployment.
