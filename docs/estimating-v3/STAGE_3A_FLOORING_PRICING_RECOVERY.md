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

## Preview acceptance

Browser acceptance ran on Preview deployment `dpl_77HFoMMjcggx2Qxrdmc4DXfU25n9`, commit `81f5f680769484907dfd5b5f860d57250839f91d`, target preview. Production was not deployed.

Isolated organisation only. Two jobs, no customer, no quote, and neither pricing draft was marked reviewed.

### Separate supply

Project `9cec79f4-e30f-4156-99b7-0dabf6c6679f`, work area `f3d7f041-1230-41aa-8738-966f3aeb1372`, estimate `4e9db1f6-e585-49bb-ac9c-b9102aa93489`, pricing draft `18b29410-ab5d-47ff-a1d6-00d25290064a`.

Hallway 8 m × 1.2 m = 9.60 m², vinyl plank, 10% waste, separate finish supply, removal of existing vinyl. Company rates saved from the named recovery links: vinyl supply $40.00/m², adhesive $5.00/m², installation 0.25 labour-hours per m². Carpenter hourly cost stayed the Quotr benchmark $60.00/h. Margin 20%. The organisation is not GST registered.

| Line | Expected | Actual |
| --- | --- | --- |
| Vinyl supply | 10.56 m² × $40.00 = $422.40 cost, $528.00 sell | 10.56 m², $422.40, $528.00, company rate |
| Adhesive | 9.60 m² × $5.00 = $48.00 cost, $60.00 sell, once | 9.60 m², $48.00, $60.00, company rate |
| Installation | 9.60 × 0.25 h = 2.40 h × $60.00 = $144.00 cost, $180.00 sell | 2.40 h, productivity 0.25 h/m², $144.00, $180.00 |
| Removal | 9.60 × 0.10 h = 0.96 h × $60.00 = $57.60 cost, $72.00 sell | 0.96 h, $57.60, $72.00, independent of the finish |
| Total | $672.00 cost, $840.00 sell, 3.36 h | $672.00, $840.00, 3.36 h |

Saving each rate returned to this work area and left the previous estimate unchanged until Regenerate estimate. Reload kept the same totals. Pricing lists the same four lines. The draft status is draft.

### Combined package

Project `2d0802ae-c363-457c-ae8e-2af58f3bdbb9`, work area `df9ca0c1-c161-4f43-9b09-0fed5fbe271d`, estimate `a1e768e3-4006-4834-b12d-6636b49b496d`, pricing draft `f0e2bc48-9391-41ca-8af2-f1312f5377f0`.

The same hallway, with combined supply and installation chosen and waste left open. The saved $40.00/m² finish rate was not applied.

| Line | Expected while waste is open | Actual |
| --- | --- | --- |
| Package | 9.60 m² × $95.00 = $912.00 cost, $1,140.00 sell | 9.60 m², $912.00, $1,140.00, benchmark |
| Extra waste | 0.96 m², not in the total | 0.96 m², cost $0, not in the total |
| Removal | $57.60 cost, $72.00 sell | $57.60, $72.00 |
| Included total | $969.60 cost, $1,212.00 sell | Known cost $969.60, shown as $970, sell $1,212.00 |

Readiness stayed Partial. The attention named Hallway and the waste choice, and said a typed amount does not answer it. Pricing hid Add price on that line and kept Create quote disabled.

On a phone-width viewport the same choice was saved. The estimate stayed at the previous $970 until Regenerate estimate. After that explicit update the package still costs $912.00, the note says the package was confirmed to cover the 10% waste, and the waste line is gone from the estimate. Removal stays $57.60. Readiness becomes All priced because the scope choice is answered.

The pricing draft was not rewritten by that regenerate. Regenerating deletes the estimate lines, and the pricing source link is cleared by the database. The waste row stayed because its sell was $0 and its label no longer matched a line, so the money difference was $0. Preview changes on the corrected Preview (`ed5f583d`, deployment `dpl_3bAFMpzJpBo5aVabEz5BUZt8nTeu`) showed the package and removal unchanged, one removed item, and a $0 difference. Update final pricing removed the waste row. Pricing then showed two items, direct cost $969.60 and client sell $1,212.00, and stopped asking for a price. The draft stayed unreviewed and Create quote stayed locked. A reload kept that result on desktop and at 390 × 844. A typed amount was not entered and no quote was sent.

### Mobile

At 390 × 844 the combined waste choice, the save notice, Regenerate estimate, and a reload all kept the totals above. The vinyl supply editor opened on `flooring.vinyl_plank.supply.m2`, saved the existing $40.00/m² company rate, and returned to the hallway work area. The notice said the estimate had not changed. The previous direct cost stayed $672.00 until Regenerate estimate, which produced the same $672.00, $840.00, and 3.36 h.

## Remaining limitations

- Carpenter labour on these jobs is the Quotr benchmark $60.00/h. The saved figure is the installation productivity, not a company carpenter rate.
- The second regenerate flagged the separate-supply pricing draft as needing recalibration. It was not rewritten and was not marked reviewed. Its totals remain $672.00 cost and $840.00 sell.
- No quote was created. Production was not deployed. No new flooring recipe, P&G change, or calibration change.
