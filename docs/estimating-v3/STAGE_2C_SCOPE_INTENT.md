# Stage 2C — scope intent and specification provenance

Parent is the accepted Stage 2B integration `97c39bd90d7feac7c86947bcd10fa9e6ef50aaa1` on `estimating/v3`. Production was not deployed. Recipes, calibration, preliminaries pricing, and fascia length are unchanged.

The first Stage 2B live sample was incomplete. This slice does not treat that sample as a paired before/after.

## What changed

Explicit exclusion language is stored on the existing deck facts: stairs, balustrade, demolition, and painting. A missing mention stays unknown. "No demolition" does not become "no preparation". Those exclusions stay on the work card, suppress the matching inclusion questions, and stay out of the generated tasks. The estimate still lists them as exclusions.

"Existing piles may be retained if sound after inspection" stays conditional. It is not stored as replacement and not stored as retention. No pile count is invented. Details asks whether the quote should assume replacement or wait for inspection, and that question blocks a complete price. An explicit "replace the piles" instruction still means replacement, including a count the brief actually states.

A door leaf is hollow-core only when the brief or a saved answer says so. The partition brief leaves the leaf unresolved. Height 1980 stays the disclosed application default. A later analysis that names a different leaf keeps the saved answer and records the disagreement.

## Checks

`scripts/verify-estimating-v3-stage-2c.ts` covers the original low deck, elevated deck, and partition briefs, plus reworded exclusions, inspection wording, mixed demolition and new work, explicit replacement, an explicit hollow-core door, and two doors with different leaf treatments. Those checks run through deck and door estimate assembly.

Also re-run: `verify-doors-02-extraction-details.ts` (53), `verify-deck-journey-closeout.ts` (42), `verify-estimating-v3-stage-2b.ts` (41), and `verify-recovery-4-r2-estimate-readiness.ts` (55).

## Preview acceptance

Accepted on Preview at `d7d9fdc009d5fbd040032410f46798b205b9f138` (`estimating/v3-stage-2c`). Ready deployment `dpl_Dj4nEE61W3JbrviRfy6GX238WFDL`. Production was not deployed and remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` (`bc0a7667422927d87368bc151a4e442e61562d5c`, `release/website-estimating-stage-1`).

Conditional piles: the inspection sentence stays visible, with Leave until inspection, Assume replaced, and Assume retained. Leave until inspection persists and is neither replacement nor retention. Assume replaced persists. A replacement without a count stays an open count question; entering 4 uses the existing each-rate allowance ($180 × 4 = $720) inside the partial total. That line is a provisional allowance, not a complete pile-replacement price. New framing and the other included substructure stay priced. The existing flat $1,200 allowance (notes "Count subject to confirmation") is the calculator path when replacement is assumed and no count is stored. Details does not show that lump, because a new substructure still requires a post or pile count before the estimate is created.

Door leaves: an unspecified leaf is asked in Details (Hollow core, Solid core, Other). Choosing hollow core persisted after reload as one 1980 × 810 mm hollow-core prehung set. Height 1980 stayed the disclosed assumed default. A second door kept its own unanswered leaf and was not stored as hollow core. That leaf is still a hard minimum, so Create estimate stays blocked while it is open. The generated estimate and unsent pricing draft `1963a27f-b9ae-451f-ab5f-0a2c0bf70a98` were created after that second door was removed. They price one hollow-core set (1 each) plus that same set's hardware and labour. Nothing was sent.

Exclusions: low deck `f33aab0b-b854-4400-a01b-ac4dfc72b4ee` kept stairs, balustrades, demolition, and painting not included. The generated estimate ($6,356 sell, $5,086 direct cost) and unsent draft `102c9503-db71-4a35-9807-9fbfd7855be0` price decking, framing, piles, and hole excavation only. No stair, balustrade, demolition, or painting task is priced. Nothing was sent. Fascia was answered "No" only to clear the estimate gate; the brief did not exclude it.

This continuation: Stage 2C verifier 64 checks passed; `tsc --noEmit` passed; doors-02 53, deck journey 42, Stage 2B 41, recovery-4-r2 55. `build:safe` still refuses the Production Supabase host. On this worktree Turbopack panics because `node_modules` is a junction. The established compile is `npx next build --webpack` after that same guard. That webpack build passed before the count-only Details candidate and was not repeated after `d7d9fdc0`.

## Still open

The flat pile allowance without a count is the existing $1,200 substructure allowance and stays incomplete. Details does not present it as the total when new substructure requires a count. An unresolved second door leaf still blocks Create estimate. Fascia length, carpet-tile recipes, preliminaries pricing, calibration, and flooring reanalysis checks 76–79 stay out of this slice. The first Stage 2B live sample remains incomplete.
