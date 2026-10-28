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
| Combined package | Net area at a company subcontract rate, only after the job says whether that rate covers underlay, a separate moisture barrier, and requested waste. Each confirmed item is charged once. The rate's existence is not that answer. | 30 m² |
| Preparation, removal, disposal, skirting | Not priced when the brief excludes them | No lines |

## Cost ownership

Separate supply uses the company material rate, the underlay rate, a moisture rate only when that line exists, the laminate installation productivity, and the company carpenter hourly cost.

A project material override in the same purchasing unit beats the company material rate. A mismatched unit is not converted and does not fall through.

The combined package is a company subcontract rate per net m². It prices only this floating click-lock job. There is no Quotr laminate benchmark. The vinyl package is not reused. The unused `laminateFlooringPerM2` pair stays unused. The $60 carpenter benchmark does not price this installation.

Saving the package rate does not mean it covers the underlay, moisture control, or the requested waste. Those three answers are asked. Included means that item stays inside the package. Separate means it is charged once beside the package. Until the answer exists, the package is not priced.

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

## Acceptance

The original brief was priced in the isolated Preview organisation through the signed-in UI. The installation method was chosen as floating click-lock, moisture control as a separate barrier, and price ownership as separate supply and installation. Underlay came from the brief. Company rates were saved from the named “Open this rate” actions: laminate $40/m², underlay $8/m², moisture barrier $3/m², 0.2 h/m², carpenter $75/h. After an explicit regenerate and a reload, the estimate is direct cost $2,100 and sell $2,625 ex GST at 20% margin. Persisted Pricing, after “Update final pricing”, shows laminate 33 m² at $1,650, underlay 30 m² at $300, barrier 30 m² at $112.50, and installation 6 h at $562.50. Skirting stays excluded. The quote was not created and pricing was not marked reviewed.

GST registration is `organisation_settings.gst_registered`. Null means it has not been answered. A stored `default_gst_rate` of 15, or a pricing document that already copied that rate, is not a yes. Registered uses the saved positive rate. Not registered applies 0. Unknown adds no GST and blocks quote creation until the business chooses. The saved pricing document is not rewritten. The setup notice that lists GST is the registration gap, not a stale warning.

A saved laminate package rate does not decide underlay, moisture, or waste coverage. Those answers are required first, and each confirmed item is charged once.

## Materials and labour takeoff

Laminate supply, underlay, a separate moisture barrier, and installation use the shared flooring review groups and the existing materials and labour projections. Supply shows the net area and the waste-adjusted purchase, with the purchasing unit, applied rate, and cost source. Underlay and a separate barrier stay on the net area. Installation stays on the labour takeoff. Each line is counted once. Customer-supplied laminate stays visible and has no contractor purchasing cost. Integrated moisture control does not add the separate barrier.

## Site checks

- Site access is an unanswered site condition. Answer it in Project Conditions. It can change labour hours. Reviewing the price does not answer it.
- Drop-off or carting distance is an unanswered handling condition. Answer it in Project Conditions. It is not a missing material cost.
- Hazardous-materials risk is an unanswered condition. No hazardous-materials cost is included, and an unanswered risk is not treated as zero.
- The 10% waste sentence was a stale unpriced check. That waste is already in the laminate supply quantity. Review the formula in Materials takeoff.

Quote creation remains blocked until pricing is marked reviewed and GST registration is decided. Reviewing the price does not close the three unanswered site conditions, and it does not decide GST.

## Not in this recipe

- Glued or nailed laminate. The area stays visible and unpriced, and this recipe is not applied.
- Carpet tiles.
- Floor preparation, removal, disposal, or skirting unless a later answer includes them.
- An invented pack or roll count.
- A second moisture barrier when the underlay already includes that function.
- Production deployment.
