# Stage 3A — flooring pricing recovery

Baseline `estimating/v3` at `c4b5a2a50167`. Stage 2E quantities and the Stage 2F ownership and waste contract stay. No new flooring recipe, no P&G change, and no calibration overhaul. Production is unchanged.

## What the user can do

An unresolved flooring line names the room and the item, says what is missing, and opens the existing editor for that item.

| Gap | Action |
| --- | --- |
| Finish material rate | Company material editor for `flooring.vinyl_plank.supply.m2`, `flooring.tile.supply.each`, or `flooring.hardwood.supply.lm` |
| Installation productivity | Company productivity editor for `flooring.finish.install.hours_per_m2` |
| Carpenter hourly cost, once productivity is saved | Existing labour editor for `labour.carpenter.hour` |
| Adhesive or ancillary rate | Company material editor for the exact ancillary key, per net m² |
| Package ownership or requested waste | The existing job answer, on that work area. It does not open a generic Rates page |

The Rates link includes the item key and a return path to the project. It is not a generic Rates page.

These catalogue rows have no Quotr benchmark and no default hours. The planned keys `flooring.vinyl.m2`, `flooring.carpet.m2`, and `flooring.material.m2` stay unused by the calculator. Carpet still has no priced roll quantity.

## Scope and units

- A save in the rate editor is a company rate for future estimates.
- An existing project material override still wins when its unit matches the purchasing unit. There is no new project-rate store and no project-rate editor.
- Add price on a missing finish, adhesive, or installation cost is a manual amount on that pricing draft only. Recalibration keeps a manually edited pricing row.
- A typed amount cannot close an unanswered waste treatment, package ownership choice, or a missing purchase quantity. “All priced” does not mean those choices are resolved.
- Material cost is accepted only in the purchasing unit: m² for vinyl supply and ancillaries, each for tiles, lineal metres for hardwood. m² and m2 match. Pack, litre, sheet, and each are not converted into one another.
- Installation productivity is hours per net m². A saved rate in another unit stays unresolved and the line says why.
- A project override whose unit does not match is not applied, and it does not fall through to a company rate in a different unit.

Saving a company rate does not rewrite the estimate, an edited pricing draft, or a quote snapshot. The return path says the estimate has not changed and offers the existing Update estimate action.

## Separate vinyl example

Hallway 9.60 m², 10% waste, separate finish supply, controlled rates only:

| Line | Quantity | Rate | Direct cost |
| --- | --- | --- | --- |
| Vinyl supply | 10.56 m² once | $40.00/m² | $422.40 |
| Adhesive and accessories | 9.60 m² once | $5.00/m² | $48.00 |
| Installation | 9.60 m² × 0.25 h/m² | $60.00/h | $144.00 |
| Removal | 9.60 m² × 0.10 h/m² | $60.00/h | $57.60 |
| Included total | | | $672.00 |

The combined package stays off this path. On the combined path the package remains 9.60 m² × $95.00 = $912.00 direct cost and $1,140.00 client sell. The extra 0.96 m² stays unresolved until an explicit waste treatment is chosen, and it is not a percentage of the package.
