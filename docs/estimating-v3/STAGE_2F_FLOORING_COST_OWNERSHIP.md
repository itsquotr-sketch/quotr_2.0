# Stage 2F — flooring cost ownership

Baseline `estimating/v3` at `75c883ea`. Stage 2E quantities stay. Production is unchanged.

## What the package covers

The catalogue description is the coverage, not the line name.

| Package | Internal cost | Includes | Does not include |
| --- | --- | --- | --- |
| Vinyl plank / LVT | $95.00/m² net | ordinary vinyl plank supply allowance, straight-lay installation, standard adhesive/accessories | sheet vinyl, preparation, removal, substrate, framing, disposal, a stated waste percentage |
| Carpet | $75.00/m² net | ordinary carpet supply allowance, straight-lay installation, standard accessories | underlay, preparation, removal, substrate, framing, disposal, a stated waste percentage |
| Floor tile | $150.00/m² net | ordinary tile supply allowance, straight-lay installation, adhesive and grout | waterproofing, preparation, removal, substrate, disposal, a stated waste percentage |
| Hardwood | $190.00/m² net | ordinary prefinished timber supply allowance, straight-lay installation, adhesive/fixings | preparation, substrate, framing, removal, disposal, sanding, a stated waste percentage |
| Carpet underlay | $15.00/m² net | underlay supply and installation | the carpet finish and finish waste |
| Floor preparation | $35.00/m² net | ordinary minor preparation | finish supply and finish waste |

Company subcontract rate on the same key replaces the benchmark. A saved sell rate on that company rate is kept. Otherwise client sell is cost / (1 − gross margin). The default margin is 20%, so the hallway is 9.6 m² × $95.00 = $912.00 direct cost and $1,140.00 client sell. Removal, underlay, preparation and substrate stay separate and stay on the net area.

The package text does not include a waste percentage, and it does not publish a material/labour split. Stated waste is still calculated. It is not treated as already inside the package, and it is not added as a second priced supply line.

A combined-package choice does not cover requested waste. Until an explicit treatment is chosen, Estimate, Pricing and commercial readiness stay information-required. The extra quantity is shown and is not priced. The package dollars are not increased by the waste percentage.

The explicit treatments are:

- Confirm that this package rate already covers the requested waste. The saved rate is unchanged.
- Charge only the extra quantity at a saved finish material rate. The net package stays. Carpet roll waste has no extra quantity, so this treatment cannot price it.
- Price finish supply and installation separately. The package is omitted. Supply uses the waste-adjusted quantity. Installation hours use only a saved company productivity rate. There is no 0.25 h/m² default.

Adhesive, grout, fixings and accessories are inside the combined package. Installation hours do not include them. On the separate and customer-supplied paths they stay visible. They are priced only when a saved rate exists for that exact key. No rate is invented. Customer-supplied finish still keeps installation labour and those ancillary materials, and removes the finish purchase.

## Ownership

- Unanswered finish price owner, and no separate finish material rate: the combined package is the only owner.
- A saved finish material rate with no choice: the package remains, the material rate is not applied, and the estimate stays information-required until the choice is made.
- Combined package: the package stays. The material rate is not applied.
- Separate finish supply: the package is omitted. Supply uses the waste-adjusted quantity and the company or project material rate. Installation uses net area and company productivity. The package rate is not reused as labour.
- Customer-supplied finish: the package is omitted, contractor purchasing cost is 0, and installation remains on the net area.
- Carpet roll waste still cannot be calculated from a percentage. That limitation is disclosed on the package. It is not a second price to enter.

A project material rate wins over the company material rate on the separate path. Bathroom vinyl catalogue rates that already include 10% waste are still not used.

## Before and after the hallway

Before, the vinyl package was 9.6 m² × $95.00 and a separate supply line asked for a price on 10.56 m². Those supply lines were excluded from the known direct cost until a rate was entered. Entering one would have charged finish supply twice.

After, the known package cost and sell are unchanged. The 10.56 m² supply quantity is shown in the package explanation and is not a second charge. The three-room known direct cost does not gain those lines.

Stored estimates, company rates and issued snapshots are not rewritten.

## Earlier preview

`9fef22a857fd` stopped the second finish-supply charge. It still treated a disclosed 10.56 m² as commercially complete. That is not acceptance of the waste contract. The correction above keeps requested waste unresolved until an explicit treatment is chosen.
