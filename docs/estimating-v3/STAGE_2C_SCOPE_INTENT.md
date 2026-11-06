# Stage 2C — scope intent and specification provenance

Parent is the accepted Stage 2B integration `97c39bd90d7feac7c86947bcd10fa9e6ef50aaa1` on `estimating/v3`. Production was not deployed. Recipes, calibration, preliminaries pricing, and fascia length are unchanged.

The first Stage 2B live sample was incomplete. This slice does not treat that sample as a paired before/after.

## What changed

Explicit exclusion language is stored on the existing deck facts: stairs, balustrade, demolition, and painting. A missing mention stays unknown. "No demolition" does not become "no preparation". Those exclusions stay on the work card, suppress the matching inclusion questions, and stay out of the generated tasks. The estimate still lists them as exclusions. A new pricing draft also copies an explicit false for stairs, balustrade, demolition, or painting into the client exclusion lines. A missing mention does not. A saved draft is left as the builder saved it.

"Existing piles may be retained if sound after inspection" stays conditional. It is not stored as replacement and not stored as retention. No pile count is invented. Details asks whether the quote should assume replacement or wait for inspection, and that question blocks a complete price. An explicit "replace the piles" instruction still means replacement, including a count the brief actually states.

A door leaf is hollow-core only when the brief or a saved answer says so. The partition brief leaves the leaf unresolved. Height 1980 stays the disclosed application default. A later analysis that names a different leaf keeps the saved answer and records the disagreement.

## Checks

`scripts/verify-estimating-v3-stage-2c.ts` covers the original low deck, elevated deck, and partition briefs, plus reworded exclusions, inspection wording, mixed demolition and new work, explicit replacement, an explicit hollow-core door, and two doors with different leaf treatments. Those checks run through deck and door estimate assembly.

Also re-run: `verify-doors-02-extraction-details.ts` (53), `verify-deck-journey-closeout.ts` (42), `verify-estimating-v3-stage-2b.ts` (41), and `verify-recovery-4-r2-estimate-readiness.ts` (55).

## Preview acceptance

Accepted on Preview at `d7d9fdc009d5fbd040032410f46798b205b9f138` (`estimating/v3-stage-2c`). Ready deployment `dpl_Dj4nEE61W3JbrviRfy6GX238WFDL`. Integrated into `estimating/v3` by merge `c4049d14953d8bfb2c05ce5b89f1f18726d9591c`. Production was not deployed and remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` (`bc0a7667422927d87368bc151a4e442e61562d5c`, `release/website-estimating-stage-1`).

Conditional piles: the inspection sentence stays visible, with Leave until inspection, Assume replaced, and Assume retained. Leave until inspection persists and is neither replacement nor retention. Assume replaced persists. A replacement without a count stays an open count question; entering 4 uses the existing each-rate allowance ($180 × 4 = $720) inside the partial total. That line is a provisional allowance, not a complete pile-replacement price. New framing and the other included substructure stay priced. The existing flat $1,200 allowance (notes "Count subject to confirmation") is the calculator path when replacement is assumed and no count is stored. Details does not show that lump, because a new substructure still requires a post or pile count before the estimate is created.

Door leaves: an unspecified leaf is asked in Details (Hollow core, Solid core, Other). Choosing hollow core persisted after reload as one 1980 × 810 mm hollow-core prehung set. Height 1980 stayed the disclosed assumed default. A second door kept its own unanswered leaf and was not stored as hollow core. That leaf is still a hard minimum, so Create estimate stays blocked while it is open. The generated estimate and unsent pricing draft `1963a27f-b9ae-451f-ab5f-0a2c0bf70a98` were created after that second door was removed. They price one hollow-core set (1 each) plus that same set's hardware and labour. Nothing was sent.

Exclusions: low deck `f33aab0b-b854-4400-a01b-ac4dfc72b4ee` kept stairs, balustrades, demolition, and painting not included. The generated estimate ($6,356 sell, $5,086 direct cost) and unsent draft `102c9503-db71-4a35-9807-9fbfd7855be0` price decking, framing, piles, and hole excavation only. No stair, balustrade, demolition, or painting task is priced. Nothing was sent. Fascia was answered "No" only to clear the estimate gate; the brief did not exclude it.

This continuation: Stage 2C verifier passed, including the client-exclusion seed; `tsc --noEmit` passed earlier on `d7d9fdc0`; doors-02 53, deck journey 42, Stage 2B 41, recovery-4-r2 55. `build:safe` still refuses the Production Supabase host. On a junction worktree Turbopack panics before compile. The established compile is `npx next build --webpack` after that same guard.

## Closing verification

`estimating/v3` at the start of this close was `0937e1372db5d969c3b2c5f05595c6e7a2f0cafb`. That commit only names the merge. Its parent is merge `c4049d14953d8bfb2c05ce5b89f1f18726d9591c`, whose stage parent is `2f067753b4371d17cbed53ba861b9b184b21ee0d`, whose parent is the product commit `d7d9fdc009d5fbd040032410f46798b205b9f138`. From `d7d9fdc0` to `0937e137` the only file change was this note.

Integration Preview `dpl_Hd2hHUoiSETWNhCnzhDtmV7SKRaB` is Ready, target preview, serving `0937e1372db5d969c3b2c5f05595c6e7a2f0cafb` at `https://quotr-2-0-git-estimating-v3-quotr1.vercel.app`. Production is still `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ`.

Webpack on that application tree, after the Preview env guard (host `shhpjsoldmqtkdbgrbtm.supabase.co`; the Production ref is refused), was `npx next build --webpack` on Next.js 16.2.9. Exit 0. An earlier inline script failed to parse and never started webpack. It is not a compile result.

Two doors, project `d18c5eb4-eb68-4be3-b96a-5ae695f9e2f8`, on that Ready Preview. After save and reload, Door set 1 remained `1 × 1980 × 810 mm` hollow-core and Door set 2 remained `1 × 1980 × 760 mm` solid-core. Height 1980 stayed the disclosed assumed default on both. Neither included door was removed. The materials takeoff prices one hollow-core set (1 each, $240 cost) and one solid-core set (1 each, $380 cost), each with its own hardware set. Unsent pricing draft `290fecd7-470e-4dee-8a22-3ddd8288a2e6` prices those two sets once each (sell $300 and $475) and one 1.5 h installation per door (`1 door × 1.5 h/door`). Nothing was marked reviewed or sent. Analysis had stored quantity 2 on the first portion; Details does not re-ask a stored quantity, so that quantity was saved as 1 through the same fact write the quantity field uses, and the reload kept 1. An unresolved leaf is still `HARD_MINIMUM` and still blocks Create estimate for the whole job. That policy was not changed in this pass. It is a separate product decision: one open leaf stops a partial estimate even when the other door is complete.

Exclusion handoff on the existing low-deck draft `102c9503-db71-4a35-9807-9fbfd7855be0`: the eleven priced items omit stairs, balustrades, demolition, and painting. The client exclusions field does not name them. It holds the organisation template only. The four words are in internal notes, which the page labels as not client quote copy. That is not client-facing scope. New drafts now add `Excluded from this job:` for an explicit false on those four facts. A missing mention does not add a line. Declining fascia in Details does not add one. A draft that already exists is not rewritten, so `102c9503` stays as saved and was not sent.

## Still open

The flat pile allowance without a count is the existing $1,200 substructure allowance and stays incomplete. Details does not present it as the total when new substructure requires a count. An unresolved door leaf still blocks Create estimate; that hard-minimum policy is unchanged. Fascia length, carpet-tile recipes, preliminaries pricing, calibration, and flooring reanalysis checks 76–79 stay out of this slice. The first Stage 2B live sample remains incomplete. Draft `102c9503` was created before the client-exclusion seed, so its client field still lacks the four lines.
