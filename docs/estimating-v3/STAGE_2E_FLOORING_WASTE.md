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

## Acceptance

Application commit `a84d146215ead083068804a72b68a5a1c5cb75eb` is the tree that passed `next build --webpack` after the Preview env guard (Next.js 16.2.9, host `shhpjsoldmqtkdbgrbtm`, exit 0). Ready Preview `dpl_ExnY2Qk9RNcYpvMTCtoqqKx2wkQr` serves that SHA at `https://quotr-2-0-kx6sdgkg9-quotr1.vercel.app` and the branch alias `https://quotr-2-0-git-estimating-v3-stage-2e-quotr1.vercel.app`. Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` on `release/website-estimating-stage-1`.

Fresh Preview project `a0acd7aa-a40d-4be6-8900-4fddeae3064b`, pricing `c3796eff-eef2-43da-8502-47f63a7ca469`. The quote was not created and pricing was not marked reviewed.

The three-room brief kept Bedroom 1 carpet 11.52 m², Bedroom 2 carpet 14.7 m², and Hallway vinyl 9.6 m², with existing-carpet removal, carpet underlay, 10% waste on finish supply, unpriced transitions, and skirting plus major subfloor repairs excluded. Pricing shows the vinyl installation package at the net 9.6 m² and the finish supply at 10.56 m² with the formula `Net 9.6 m² × (1 + 10% waste) = supply 10.56 m²`. Carpet roll purchasing stays unresolved at the installed area. Removal hours stay on the net area. The three supply lines are Pricing required and are not in the known direct cost. Controlled single-finish fixtures cover vinyl area allowance, whole-tile rounding, hardwood lineal metres, carpet’s unresolved roll purchase, customer-supplied finish, and a missing material rate.
