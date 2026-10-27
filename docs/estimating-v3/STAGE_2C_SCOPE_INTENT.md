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

## Still open

Choosing "assume replacement" without a stated count still uses the existing pile allowance, and the estimate stays incomplete until a count exists. That is not a new allowance feature. Fascia length, carpet-tile recipes, and preliminaries pricing remain out of this slice.
