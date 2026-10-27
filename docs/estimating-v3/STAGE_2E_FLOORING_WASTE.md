# Stage 2E — flooring waste and purchasing quantity

Baseline `estimating/v3` at `513ca44a`. Production is unchanged.

## Reviewed quantities

These were fixed before the calculation change.

| Finish | Net | Waste | Supply | Left on the net quantity |
| --- | --- | --- | --- | --- |
| Vinyl plank | 9.60 m² | 10% | 10.56 m² area allowance | installation, removal, preparation |
| Vinyl plank | 20 m² | 10% | 22.00 m² | installation and removal |
| Tile 600 × 600 | 10 m² | 10% | 31 whole tiles | installation package |
| Hardwood 145 mm | 12 m² | 10% | 91.03 lineal m, no box | installation package |
| Carpet | 11.52 m² | 10% | none priced | installation and underlay |
| Three-room hallway | 9.60 m² vinyl | 10% | 10.56 m² | removal |
| Three-room bedrooms | 11.52 m² and 14.70 m² carpet | 10% | roll layout unresolved | underlay and removal |

The existing finish packages are combined supply-and-install rates per net square metre. Their descriptions do not include a waste percentage, and the physical rows previously forced waste factor 0. Stated waste is applied once, on the finish supply quantity. It is not applied again through `wasteFactor`, and it is not applied to installation, removal, preparation, underlay, substrate sheets, or framing.

Vinyl and other area finishes have no known carton coverage, so the supply quantity stays an area allowance. Tile size is a known unit, so the waste-adjusted area is rounded up to whole tiles. Hardwood board width gives lineal metres only. Carpet roll layout cannot be calculated from a percentage; that purchasing line stays unresolved and is not given a waste-adjusted area.

A company material rate prices the supply quantity. There is no Quotr material benchmark on these supply keys. Bathroom vinyl catalogue rates already describe a purchase area after 10% waste and are not used here, so that allowance is not applied a second time. A missing flooring supply rate stays unresolved. The package rate still prices the net installation quantity. Customer-supplied finish sets contractor purchasing cost to zero and keeps installation on the net area. Installation hours use a company productivity rate only; there is no new benchmark hour rate.

The pile replacement allowance is recorded separately in `PILE_REPLACEMENT_ALLOWANCE_DEFECT.md`. It is an unexplained additional cost and is not changed here.

Existing stored estimates and quote snapshots are not rewritten. These quantities apply to newly calculated estimates.
