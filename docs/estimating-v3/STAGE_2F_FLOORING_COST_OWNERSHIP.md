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

## Preview acceptance

Application tree `5f789c976315`. Ready Preview `dpl_8WDYgwMBDH6tZkDGqSENZbCJs5sN`, target preview, alias `https://quotr-2-0-git-estimating-v3-stage-2f-quotr1.vercel.app`. Production was not deployed.

Hallway used for every fresh job: 8 m × 1.2 m = 9.6 m² vinyl plank, remove existing vinyl, 10% waste where the brief asks for it. No organisation rates were changed. The live company has no finish material rate, no install productivity, and no adhesive rate, so those lines stay unpriced. The 0.25 h/m² figure is only the verifier fixture for `flooring.finish.install.hours_per_m2`. It does not appear on these jobs.

Independent expected money, 20% margin, sell = cost / 0.8:

| Piece | Quantity | Cost | Client sell |
| --- | --- | --- | --- |
| Vinyl package on net area | 9.6 m² × $95.00 | $912.00 | $1,140.00 |
| Removal | 9.6 m² × 0.1 h/m² × $60/h | $57.60 | $72.00 |
| Known total when the package is the finish price | | $969.60 | $1,212.00 |
| GST 15% / incl GST on that sell | | | $181.80 / $1,393.80 |
| Extra waste quantity | 10.56 − 9.6 = 0.96 m² | not priced | not priced |

10% of the $912.00 package would be $91.20. That amount is not charged. 10.56 m² is not charged at $95.00.

Fresh Preview jobs, saved and reloaded. Quotes were not created and pricing was not marked reviewed.

- Unanswered waste, project `9f2936cf-6a16-44f6-aa6c-51b9e9bc7241`, pricing `75d4f967-4110-4259-b3e2-7dde975aa4ac`. Estimate incomplete. Package note: 9.6 m², $95.00, $912.00, $1,140.00, and the 10.56 m² is not inside the rate. Pricing: package sell $1,140.00, waste 0.96 m² Pricing required and not in the total, removal $72.00. Known cost $969.60. Client sell $1,212.00. Quote creation stays blocked.
- Explicit combined, waste left unanswered, project `9702c02c-117a-446f-8b58-1ec4ad73e405`, pricing `5a2a978f-eba5-4891-8f4d-cdb2ebc3207d`. Same dollars. The package note says choosing the combined package does not include the requested waste. The waste line stays Pricing required and not in the total.
- Package rate confirmed to cover the requested waste, project `e70cfa05-cd29-478c-b98e-a10e6b85e789`, pricing `71a75a05-aa51-4d33-aba7-213bb11c9658`. No waste line. Package stays $912.00 / $1,140.00. The note says the rate was explicitly confirmed, was not increased, and was not split. Persisted pricing is 2 items, direct cost $969.60, client sell $1,212.00, margin 20%, incl GST $1,393.80. All priced.
- Separate supply and installation, project `829d28c1-3575-48b6-b886-2c93510656af`, pricing `b453905d-3fc2-482c-ad8f-e2e0cbd21c3a`. No package. Supply 10.56 m², adhesive 9.6 m², and finish installation 9.6 m² are Pricing required and not in the total. No 0.25 h/m². Removal only: known cost $57.60, client sell $72.00, incl GST $82.80. Three lines block the quote.
- Customer-supplied vinyl, project `f84d68fc-223f-4526-8a49-6a545430bce6`, pricing `f5288fdb-17d2-4735-932b-b7a52dfdaafe`. No package and no finish purchase. Adhesive 9.6 m² and finish installation 9.6 m² stay Pricing required and not in the total. Removal only, same $57.60 / $72.00.

The priced separate and incremental cases stay in the verifier, because writing them would change company rates. With a fixture material rate of $40/m², only the extra 0.96 m² is $38.40. With fixture adhesive of $5/m², ancillary cost is 9.6 × $5 = $48.00 once. With fixture productivity 0.25 h/m² and labour $60/h, installation is 9.6 × 0.25 × $60 = $144.00, and the note names that saved productivity. Without the fixture, installation is unpriced and the note does not contain 0.25.

## Limitations

Carpet roll waste still has no extra purchase quantity, so incremental waste cannot price it. Adhesive, grout, fixings and accessories have no catalogue rate; on a separate or customer-supplied path they stay unpriced until a saved rate exists. A manual Pricing edit can still type a cost onto an unresolved line. That is not a waste treatment and was not used here. Quote creation stays blocked while the line is unpriced. Stored estimates, company rates and issued snapshots were not rewritten. Flooring checks 76–79 stay the pre-existing failures. No laminate, carpet-tile, preliminary-and-general, or calibration work. Production was not deployed.
