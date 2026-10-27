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

## Preview acceptance

Ready Preview deployment `dpl_3FQqn3M5tfSMDXyyvyZ9Uf6t22mj`, target preview, SHA `9fef22a857fd`, alias `https://quotr-2-0-git-estimating-v3-stage-2f-quotr1.vercel.app`. Production was not deployed.

Fresh project `3e2e680e-c0f4-4119-813b-c63fa4c9a6d7`, pricing `df1969b2-a2d4-4238-bd2d-7a76d12719f7`. The original three-room brief was used. Finish price owner was left unanswered, so each finish stayed on the combined package. Substrate and preparation were answered no. Pricing was not marked reviewed and no quote was created.

Estimate and Pricing agree:

- Hallway vinyl package quantity 9.6 m², internal unit cost $95.00/m², direct cost $912.00, client sell $1,140.00 at 20% gross margin.
- The note states 10% waste and supply quantity 10.56 m², and that this quantity is not a second charge and is not inside the rate.
- Carpet packages stay on 11.52 m² and 14.7 m². The roll-waste limitation is disclosed and is not a second price.
- Underlay and removal stay on the net area.
- Persisted Pricing is 8 priced lines, direct cost $3,415.20, client sell $4,269.01. That matches the Stage 2E known total. The previous unpriced finish-supply lines are absent, so a later material rate cannot be entered on top of the package.
