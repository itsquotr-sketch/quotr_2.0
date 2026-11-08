# Estimating V3 completion register

This is the only product direction for finishing V3. Stage notes, the capability matrix, and the coordinator handoff do not add another plan. The handoff keeps the session, the QA organisation, and the publish rules. The copy of this file inside `68c5760c` is the register as it stood at that product commit.

Restarted 5 November 2026. Progress recorded 6 November 2026. Website Production `96beddeb` was released on 8 November 2026. Further Production writes still need a named Production QA organisation. Routine development and bounded Preview repairs toward this finish line stay authorised. Ask Jean-Luc only for a material product decision or a protected operation. This register does not reopen an accepted slice without contrary evidence. A missing company rate is not a defect. Passing arithmetic is not proof that a benchmark or company rate is the right market price. A deferred row is a proposed scope decision. It is not an owner-approved exclusion from V3.

Support means a demonstrated assembly path. A recognised work-area label is not support. V3 does not promise every variant of a family.

## Finish line

A release candidate needs all of these for the paths this register marks required:

1. Supported scope survives analysis, clarification, and reload.
2. Measurements, instances, exclusions, and supply responsibilities stay on the right work.
3. Missing information has a reachable question or an explicit unresolved task.
4. Supported assemblies calculate quantities, waste, labour, and money from their contracts.
5. Company rates, productivity, and overrides resolve in one order and show their source.
6. Estimate, takeoffs, and Pricing agree. Incomplete work is shown as incomplete.
7. Regeneration can update an estimate. An explicit Pricing apply can update eligible draft rows. Issued quote snapshots stay immutable. Manual edits stay until that apply.
8. One representative desktop journey and one representative mobile journey pass for each claimed supported path.
9. Website and Android compatibility, required migrations, deployment configuration, and rollback are reviewed before any Production proposal.

## Status meanings

- **Required.** Must be true before a V3 release candidate.
- **Accepted.** Evidence meets the frozen criteria. Do not repeat it without contrary evidence.
- **Deferred.** Proposed for this release. Jean-Luc has not approved it as an exclusion.
- **Owner decision.** Jean-Luc chooses before that repair.

Software correctness and rate calibration are separate rows.

## Verified state

| Item | Value |
| --- | --- |
| Integration branch | `estimating/v3` |
| Accepted integration SHA | `b3520440b6127eaff9aeafbf69a40958a50a4350` |
| Integration Preview | `dpl_7f8JaygJYDWFWHCShoTbPtgjoftH`, Ready, target preview. Alias https://quotr-2-0-git-estimating-v3-quotr1.vercel.app. Fast-forwarded from `68c5760c` on 6 November 2026. |
| Preview alias | https://quotr-2-0-git-estimating-v3-quotr1.vercel.app |
| Kitchen candidate | Included in `b3520440`. The earlier approval was `bb831f4b717005bc2977b4b1645f11144d17d8af`. |
| Batch 3 candidate | Included in `b3520440` through approved `1c9cec426d5016345e77ebe9b89d393370a591ae`. `615af37a` was blocked because the rounding remainder missed the last priced row, and that fix is `1c9cec42`. `3e5efc74` and `2c29ab37` stay off the approved line. |
| Preview database | `quotr_preview` / `shhpjsoldmqtkdbgrbtm` |
| QA organisation | `0767b04e-31c2-4679-a275-16201135df02`, “V3 QA isolated mw2usno8” |
| Production database | `quotr_2.0` / `lxvnylhsbvudzzupxeqr` |
| Website Production | `dpl_5KxnUEhLzT6MJUj4mpGSKSYP6oue`, Ready, target production, `96beddebd40ee572b1865c152aa4f7cfcad40fff` on `release/website-estimating-stage-1`. Previous rollback target `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` (`bc0a7667`). |
| Android release line | `ff39ba31` on `release/android-estimating-stage-1`. Not this Preview. |

The local `estimating/v3` worktree at `C:/Users/Admin/Desktop/quotr-estimating-v3-integration` remains `af4a388b` with unrelated uncommitted files. It was not updated or cleaned. That checkout is not the integration tip. `origin/estimating/v3-preliminaries` is `a0479ef0`, and that commit is an ancestor of `68c5760c`. A branch deployment shares the Preview database. Website Production is the deployment in the table above.

Kitchen release review of `bb831f4b` returned APPROVE FOR PREVIEW INTEGRATION. The combined SHA `b3520440` also returned APPROVE FOR PREVIEW INTEGRATION. Integration now serves that SHA.

Preview service-role redeploy, recorded separately from the readiness fix. The first create on `dpl_CiyRDS5gACYT73BSBEjGeuwPTu9W` failed before any project existed because `estimating/v3-batch-3` had no service-role override and the shared Preview key is not a service_role JWT. A Preview-only branch secret was added for that branch, using the existing Preview service role. The same commit `3e5efc74` was redeployed as `dpl_FH2wSKeZqGPtxspyGAVoV9Xqckic`. That redeploy did not change product code. Production was not changed.

Readiness fix, after that redeploy. `3e5efc74` stayed blocked because a blank pile count stopped the first estimate. `0897404f` lets decking and framing estimate while the count stays unknown. `2c29ab37` lets the generated replacement allowance keep a typed Pricing amount. That save also wrote the allowance sell into the document total. The price card then showed $6,336.88 as an entered price, $600 above the $5,736.88 recommendation. Nothing had been applied. `615af37a` keeps a line with `includedInTotal: false` out of the document total, the work-area header, and final-price allocation. Apply is refused while that row is still visible on the quote, using the existing quote-visible excluded block.

Hosted retest on the same project `48a03529-cee9-47bb-87c9-f836eac8408e`, pricing `efddd432-7dab-464b-8665-dc1d8418499c`, org “V3 QA isolated mw2usno8”. No second project and no pile count. The line was saved again with quantity 0, cost 400, sell 600, client description “Removal of existing piles”, internal basis “Subcontractor price”, and empty client notes, then reloaded. It remains Quantity unknown, not in the total, and visible on the quote. The Deck header is direct cost $4,589.94 and client sell $5,736.88. The price card is “Priced work so far” $5,736.88 on the recommendation. The $6,336.88 figure is gone. Quote stays locked. Mark as reviewed stays disabled. Apply this price was not used. No quote was created, so no client document was rendered.

Client projection is code evidence. `resolveQuoteItemDescription` in `lib/quotes/from-pricing.ts` uses `client_description`, then `notes_client`, and does not use `internal_description`. The regression `scripts/verify-excluded-allowance-total.ts` checks that “Removal of existing piles” is the projection and “Subcontractor price” is not. The hosted quote section stayed locked, which is the hosted evidence that no client document exists.

## Capability and evidence

Every SHA in the historical column below is an ancestor of `68c5760c` unless the cell says otherwise. “On integration” means the commit is in that tree. It does not mean the original hosted deployment is still the one serving Preview. Do not rerun a journey to replace these records.

| Capability | Historical evidence | On integration `68c5760c` | Candidate only | Remaining gap |
| --- | --- | --- | --- | --- |
| Analysis identity and confirmed answers | Stage 2A. Saved Details answers, persistent Not sure, explicit assumptions, work-area UUID reuse, and protection of a confirmed answer on reanalysis. Acceptance parent recorded as `f45eaedf`. | The same commits are in the tree. | None. | Identical measured rooms still have no applied `instance_key`. The proposal was not applied. |
| Not sure is not one rule | Stage 3C, baseline `97dc7c35`. Access Not sure adds 0 and stays unresolved. It is not Easy. Carry Not sure adds 0 and stays unresolved. It is not a confirmed distance under 10 m. An empty carry parses as short and also adds 0. Hazmat Not sure stays unpriced and blocks commercial readiness. | Those commits are in the tree. Bathroom substrate Not sure no longer prices a full replacement, from `bd985540`. | None for these conditions. | A deck-material Not sure on the old low-deck session still priced decking. That session is not a current rule for every Not sure. It was not re-read in code this pass. |
| Deck finish versus internal flooring | Stage 2B, integrated at `97c39bd9`. Conflicting 5 × 4 m and 32 m² both stay stored. The chosen basis prices. The other measurement stays stored. A mixed hardwood deck and lounge floor stay separate work areas. | In the tree. The first live sample was incomplete and is not a paired before/after. | None. | None recorded for this separation. |
| Dropped areas, door height, paraphrased measures, stated waste | `a5ff30d0`. Laminate and partition areas, door height taken from the wall, paraphrased measurements, and stated waste stay on the assembly that named them. The live sample was bounded. | In the tree. | None. | The bound of that live sample is the evidence. It is not a new whole-job claim. |
| Partition exclusions | `2e629a3e`. An explicit exclusion survives later wall details. A mixed job can keep ceiling painting included while new-wall painting stays excluded. Requested stopping stays unresolved when it was not answered. | In the tree. | None. | Unspecified stopping level stays a gap. No level is invented. |
| Provider-status wording | A hosted request recovered on the same deployment. | No stage note in this checkout names a SHA. | None. | Not a Preview blocker unless a current reproduction stops the workflow. |
| Partition quantities | Integration baseline. Project `59d4e9b7-39bd-4ccd-b5e1-e07b0b1e037c`. Two faces, 12 sheets, stopping 12.7962 m² per face and 25.5924 m² combined, each face once. Stated skirting 45 lm versus a derived length. | In the tree. Office hosted example in the checkpoint kept stated 45 lm and one Standard GIB line for both faces. | None. | Opening labour, unspecified stopping level, acoustic insulation labour, and door-to-opening association stay open. Six door sets are not six wall openings. |
| Stated skirting can price | `8e61188d`. Stated 45 lm prices supply and installation. The unallocated edge stays unallocated. Skirting painting stays separate and unpriced. | In the tree. | None. | Painting that skirting still has no invented rate. |
| Door leaf and openings | Stage 2C at `d7d9fdc0`, deployment `dpl_Dj4nEE61W3JbrviRfy6GX238WFDL`, merged by `c4049d14`. Unknown leaf stays unresolved. 1980 mm is the disclosed height default. Door sets are separate from openings. | Opening-count repair is in the tree. Deterministic proof is `1288d9ee` against baseline `01e4b508`, evidence commit `08e21d39`, named preview `dpl_GEhr682QSyVy5t6rFrai9WiPs3ML`. That report’s hosted section was blocked. | None. | Later hosted reload is coordinator commit `6efe4a4c`, project `f87a1677-59d4-4c19-93cb-295acbfffad2`. Deployment id and session SHA are unknown. Mobile was not tested. |
| Flooring waste and ownership | Stage 2E `a84d1462`, deployment `dpl_ExnY2Qk9RNcYpvMTCtoqqKx2wkQr`. Stage 2F `5f789c97`, deployment `dpl_8WDYgwMBDH6tZkDGqSENZbCJs5sN`. Net installation and finish purchasing are separate. Waste is charged once. A package does not also charge the supply line. Customer supply stays visible. Unresolved waste stays unresolved until a treatment is chosen. Broadloom roll purchasing stays unresolved without a layout. | In the tree. | None. | A typed price does not answer an open ownership or waste decision. |
| Named flooring rate recovery | Stage 3A. Browser acceptance `81f5f680`, deployment `dpl_77HFoMMjcggx2Qxrdmc4DXfU25n9`. Separate vinyl persisted at $672 cost and $840 sell. Explicit regenerate. A later visibility pass on `ed5f583d`, deployment `dpl_3bAFMpzJpBo5aVabEz5BUZt8nTeu`, removed the obsolete waste row on apply. | In the tree. | None. | The second regenerate flagged the draft and did not rewrite it. |
| Floating click-lock laminate | Stage 3B, baseline `d3c7c837`. Separate supply on the 30 m² brief: $2,100 cost and $2,625 sell after regenerate and reload. Glued and fastened stay visible and unpriced. The later 20 m² proof was served on `4270f5f5`, Pricing `910191b5-c824-4ec8-bd97-8471ccee948d`, cost $1,400 and sell $1,750. | Both commits are in the tree. | None. | Keep the 20 m² proof separate from the 30 m² $2,100 / $2,625 proof and from the checkpoint partial at $360 / $450. The deployment id for the 20 m² step is not established. |
| Laminate final price | Stage 3C. A draft created at $2,625 stayed until an explicit apply. The later labour change was a stale recommendation, then $2,145 / $2,681.25 after apply. | In the tree. | None. | A genuinely entered override is a different path and stays until the builder applies a change. This diagnosis does not erase an entered override. |
| Straight-lay carpet tiles | Stage 3D office area case accepted at `9335b6b7`: 120 m² net, confirmed 5% supply, company rates. Adhesive sell $375.60 is unit-first rounding, against $375.00 from the line cost. The complete-assembly closeout tree is `bd35b7a8`. That record includes the hosted move from 48 to 56 tiles, the recovered $8/tile rate, the 6¢ unit-first rounding difference, and the protected adhesive edit in Pricing `f255812c`. | Both commits are in the tree. `bd35b7a8` is the accepted closeout. | None. | The exact deployment for each closeout step is not established. Other patterns, an unconfirmed substrate, and broadloom rolls stay unresolved. |
| Preparation beside priced finish | Stage 3D and the checkpoint. Preparation can stay a separate unpriced task when the finish inputs and rates are present. | In the tree. | None. | Missing rates and unsupported fixing, layout, or substrate paths stay bounded gaps. No recipe is added for them. |
| Hazardous materials | `01e4b508`. Unanswered risk on a non-demolition carpet-tile estimate stays visible and does not make that estimate incomplete. Yes or Not sure stays unpriced and can block readiness. | In the tree. | None. | The blocking cases stay. Unanswered risk is not stored as No. |
| Deck exclusions, fascia, and conditional piles | Stage 2C as above. Stage 2D `3a00dbab`, deployment `dpl_2qG738P1HkRvZaCKLNEnZzQMhWUj`. Fascia inclusion alone does not choose the perimeter. Stated fascia and an explicit rectangular perimeter are different recorded bases. Hosted elevated, low, pending-inspection, retention, and replacement jobs are in the 29 October checkpoint. | In the tree, including cost-integrity `8c52b93b`: when supports are already itemised, the $1,440 allowance stays out of the total. The historical Stage 2C path still put $180 × a stated count inside a partial total. | Batch 3 `3e5efc74` is the change that keeps an automatic replacement allowance out, keeps the concrete-exclusion notice, and shows “Priced work so far”. | Hosted save, reload, and the internal-to-client boundary on that candidate. Retaining excavation labour stays Pricing Required. Benchmark arithmetic is not market calibration. |
| Fence and retaining desktop | Timber paling and one raking timber wall. Reports `docs/estimating-v3/candidates/fence-journey-evidence.md` and `retaining-journey-evidence.md`. Coordinator commits `d2a500e2` and `556e64ab`. Projects `f7a1095c-8928-4a6c-82a1-f8603d1e88fd` and `13eaab78-aaf0-445e-a030-61cc37e73e0d`. SHA named there is `68c5760c`, deployment `dpl_HjWgXJ3NbiSyH8DQDjuVUKRA7zDU`. | Accepted for those desktop paths. | None. | Mobile layout is still open. Metal, plastic, sleeper, and masonry are not claimed. The recorded sells were not scored as market prices. |
| Bathroom partial | Generated on `1cb4761a`, project `a027ffe2`, Pricing `630d01c1`. Desktop and 390 px reloads. The later report confirms stored sell $3,106.57. Removals, disposal, vanity installation, floor tiling, and painting were the priced work. Waterproofing and the other open scope stayed out. `6b43ee34` remains the earlier scope-preservation behavior, including mixed-supply job `6ba794d6-0190-4508-a8ff-63e3f85ff1b8`. | `1cb4761a` and `6b43ee34` are in the tree. This is not a whole-bathroom recipe. | None. | Catalogue sentence still says the renovation includes fixtures. `d47a84a0` is a later naming change for occupied-site and restricted-hours adjustments. It is not this partial and it has no deployment id. The deployment for the `1cb4761a` generation is not established. |
| Bathroom substrate | `bd985540`, preview `dpl_3w784NZ3c9mfpYZgmpZ74PYW9XSz`. Unknown, retained, and unmeasured partial repair do not price full replacement. Known cost $3,885 and sell $4,857 on those three fresh jobs. Confirmed 19 mm plywood replacement prices plywood and underlay as separate tasks. The earlier Not-sure mixed job was not rewritten. | In the tree. | None. | “Other” stays an open specification. There is no way to accept a proposed substrate allowance before it is priced. |
| Project preliminaries | First hosted slice behavior `358f5574`. Office job `c2b4e96f-56c2-4559-a8e5-cfad8acfa1ce`: priced preliminaries $2,900 cost and $3,625 sell. A duration change updated daily cleaning only. Bathroom job `80a4b84a-1bde-43af-bb7b-69f9cbb46d8f` captured cleaning and protection once at project level. | In the tree. Company-role capture is `a0479ef0`, the tip of `estimating/v3-preliminaries`, and that commit is an ancestor of `68c5760c`. The integration file labels an explicit project hourly cost “Project hourly cost”. | None. | No deployment id is named for the `a0479ef0` follow-up itself. The first slice names the alias and not a `dpl_` id. |
| Changed conditions and GST | Stage 3C. A price-affecting condition marks the estimate stale. Regenerate and Pricing update are explicit. Unknown GST registration, Apply registration rate, and Keep this document rate are separate decisions. | In the tree. Website candidate `1dae7664` uses `126_pricing_document_tax_basis.sql`. Version 121 stays `account_deletion_requests`. Preview already has the nullable column. Production does not. | None. | File 126 is rehearsed and not applied. |
| Draft reconciliation | `d3c7c837` and `4efc441f`, preview `dpl_8yasoGUEMdGtqXT3cgCgGuVTjutu`. Match by stable identity. Obsolete untouched rows can be removed on apply. Manual and edited rows stay. A visibility-only update can be a $0 difference. Older bathroom draft `31d66ec2` was corrected only by that explicit apply. | In the tree. | None. | Unresolved internal rows and customer-supplied purchases stay out of the client projection where that rule applies. An issued snapshot is not offered the update. |
| Kitchen pricing boundary | On `68c5760c`, “Replace the kitchen.” with no area priced 10 m² labour at $9,600 / $12,000 and a $20,000 / $30,000 materials package, and the client draft named cabinetry, benchtop, and appliances. | The old behaviour was what `68c5760c` served. `b3520440` now serves the kitchen boundary. | `bb831f4b`, now inside `b3520440`. Unstated replacement stays visible at known sell 0. A stated 12 m² holds labour at $11,520 / $14,400 and materials at $20,000 / $30,000 until Full kitchen renovation, when known sell is $44,400. Demolition alone is 8 h at $480 / $600. Splashback is the existing lump $800 / $1,200. | Published on Integration. The catalogue sentence no longer promises cabinetry and trade allowances. |

## Required

### Deck

- **User outcome.** A low or elevated replacement deck prices measured work. Requested pile replacement stays visible. It stays out of the known total until its operation is distinct.
- **Evidence.** Priced low and elevated assemblies are on the integration. Leave-until-inspection and explicit retention do not price a new pile set. Edited drafts and issued snapshots stay until regenerate and Pricing apply. The allowance investigation is `docs/estimating-v3/PILE_REPLACEMENT_ALLOWANCE_DEFECT.md`.
- **Gap.** `deck.post_replacement.each` and the count-free allowance do not name removal of existing piles, temporary support, or any other operation beyond measured new supports. A missing count is not a quantity.
- **Acceptance.** Neither benchmark enters the known total. Measured supports stay when they are present. Uncovered replacement work stays unresolved. A typed Pricing amount needs an explicit scope and basis and must not repeat measured lines. Saved estimates, manual Pricing edits, issued snapshots, the general margin, and saved-sell rules stay as they are.
- **Status.** On Integration in `b3520440`. `3e5efc74` and `2c29ab37` are not the approved candidate. `615af37a` was blocked for the rounding remainder, and `1c9cec42` closes that. A missing count stays “Quantity unknown”. The amount does not enter the priced total or clear the coverage gap. The review and quote gates stay.

### Concrete “No” still leaves support unresolved

- **User outcome.** Answering No to concrete footings removes the concrete material and placement lines. The deck still says the support method, post count, and excavation are unresolved and unpriced.
- **Evidence.** `scripts/verify-deck-maturity-2c.ts` check “28 No suppresses” fails on baseline `68c5760c` and on the pile candidate. The failing notice is `DECK_SUPPORT_DESIGN_UNRESOLVED`: “Concrete footings are excluded. The support method, post count and associated excavation stay unresolved and are not priced.”
- **Impact.** The No answer is honoured for the concrete lines. It does not leave a clean priced support design. The user still sees an incomplete support warning. Matching the baseline shows the pile repair did not introduce it. It does not show the warning is harmless.
- **Status.** Required honesty. The repair is inside `b3520440` and passes the local kwila check. The hosted pile check is the save-and-reload, not a repeat of this local result.

### Fence

- **User outcome.** One timber paling fence keeps the stated run, gate, and quantities through analysis and reload.
- **Evidence.** Durable report: `docs/estimating-v3/candidates/fence-journey-evidence.md`. Desktop quantities are recorded only in coordinator handoff commits `d2a500e2` and `556e64ab`. Project `f7a1095c-8928-4a6c-82a1-f8603d1e88fd`. The handoff names application SHA `68c5760c50e97b3bccb4f3fab314e7b2c37b9c7d` and Preview `dpl_HjWgXJ3NbiSyH8DQDjuVUKRA7zDU`. Do not rerun that desktop journey.
- **Gap.** No standalone QA report. The phone-width read on Integration is BLOCKED. Metal, plastic, and other fence systems are not claimed. Benchmark sell $5,155.97 was not scored as a correct price.
- **Acceptance.** The stored quantities above survive reload. Missing company rates stay unpriced or labelled with their benchmark source. No invented structural specification.
- **Status.** Accepted for this timber path. Mobile evidence and benchmark calibration remain required and are not code repairs.

### Retaining wall

- **User outcome.** One timber raking wall keeps the stated geometry, drainage choice, and excavation quantity.
- **Evidence.** Durable report: `docs/estimating-v3/candidates/retaining-journey-evidence.md`. Same handoff commits as the fence journey. Project `13eaab78-aaf0-445e-a030-61cc37e73e0d`. SHA `68c5760c50e97b3bccb4f3fab314e7b2c37b9c7d`. Preview `dpl_HjWgXJ3NbiSyH8DQDjuVUKRA7zDU`. Do not rerun that desktop journey.
- **Gap.** No standalone QA report. The phone-width read on Integration is BLOCKED. Sleeper and masonry walls are not claimed. Benchmark sell $4,861.33 was not scored.
- **Acceptance.** Those stored quantities survive reload. The excavation labour gap stays explicit. No invented rate.
- **Status.** Accepted for this timber path. Mobile evidence and benchmark calibration remain required and are not code repairs.

### Bathroom

- **User outcome.** Stated floor-tile and painting areas can price. Specialist trades stay allowances. The page does not call that a complete bathroom price.
- **Evidence.** Floor-tile installation and painting can price from stated area. The support contract already says specialist trades remain allowances.
- **Gap.** No whole-bathroom recipe is claimed. No hosted journey on `68c5760c` was recorded.
- **Acceptance.** The partial path stays honest. V3 does not add a new bathroom recipe.
- **Status.** Required honesty is the existing partial path. A new assembly is deferred.

### Flooring

- **User outcome.** Laminate and carpet-tile rooms show readable areas and keep the calculated quantity.
- **Evidence.** Both recipes are accepted. Area headings are accepted at `68c5760c` (`3308d806`). Bedroom 1 `11.52 m²`, Bedroom 2 `14.7 m²`, hallway `9.6 m²`. Stored areas stay `3.6 × 3.2` and `4.2 × 3.5`. A missing company rate stays unpriced.
- **Gap.** Specialist flooring and every other finish are outside this claim.
- **Acceptance.** Do not repeat the heading QA.
- **Status.** Accepted for those recipes and the heading display.

### Internal walls and doors

- **User outcome.** A stated opening count is one unsized opening each. Door sets stay door sets. A sized opening survives reload without resizing the others.
- **Evidence.** Durable report: `docs/estimating-v3/candidates/opening-count-evidence.md`. Deterministic acceptance is in the opening-count evidence checkout at `08e21d39`, tested SHA `1288d9ee`. The later hosted reload is only in coordinator commit `6efe4a4c`. Its deployment id is unknown. Do not rerun the recorded checks.
- **Gap.** No separate hosted QA report. Mobile was not checked. The deterministic hosted section remains BLOCKED in the report file.
- **Acceptance.** Do not edit that project or repeat the check.
- **Status.** Accepted.

### Shared protections

- **User outcome.** Analysis disagreements, exclusions, partial prices, company-rate recovery, Pricing reconciliation, GST gates, and hazardous-materials presentation stay as already accepted. Regeneration can update an estimate. An explicit apply can update eligible draft rows. Issued quote snapshots stay immutable. Manual edits stay until that apply.
- **Evidence.** Accepted on the integration. Hazardous-materials presentation at `01e4b508`. Project preliminaries remain $2,900 cost and $3,625 sell.
- **Gap.** None recorded.
- **Acceptance.** Do not reopen without contrary evidence.
- **Status.** Accepted.

### Release mechanics

- **User outcome.** A Production proposal names the website SHA, the Android SHA, the migrations, the configuration, and the rollback.
- **Evidence.** Website Production is `dpl_5KxnUEhLzT6MJUj4mpGSKSYP6oue`, Ready, target production, commit `96beddeb` on `release/website-estimating-stage-1`. Android is `ff39ba31` on `release/android-estimating-stage-1`. Migration 126 is applied on Production `lxvnylhsbvudzzupxeqr`.
- **Gap.** No Production QA organisation is named, so signed-in estimate, Pricing, customer, and quote checks were not run.
- **Acceptance.** The approved migration and Git Production deployment are complete. Rollback was not used. Further Production writes wait for a named Production QA organisation.
- **Status.** Released. Read-only checks passed.

The readiness check below is the procedure that was executed on 8 November 2026. The completion record is at the end of that section.

### Honest price status

- **User outcome.** A work area with unresolved scope does not read as fully priced.
- **Evidence.** `formatWorkAreaPriceSummary` says “All priced lines” only when the issue model has no missing price and no scope or specification gap. A scope gap changes that summary to “Generated lines priced”. `PricingItemRow` already says a typed amount does not resolve an open scope question.
- **Gap.** An overview can still be read as complete while a card or a scope question is unresolved. That disagreement is not cosmetic.
- **Acceptance.** Unresolved scope stays visible as incomplete. This pile repair marks the replacement line Pricing required so that line is not an all-priced claim.
- **Status.** Required, and not on Integration. Batch 3 at `3e5efc74` shows the known subtotal as “Priced work so far” and withholds the final job price while scope is open. Local checks passed, including the review and quote guards. The hosted session did not reach an estimate, so this wording was not confirmed there.

## Adopted decision

### Pile/post replacement allowance

- **Decision.** Scope-based pricing. Do not invent removal, temporary support, or another operation to justify the existing allowance.
- **What the benchmarks cover.** `deck.post_replacement.each` is the each benchmark, $180 cost / $280 sell, stored in `lib/estimate/benchmark-rates.ts`. The count-free allowance is `substructureReplacementAllowance`, $1,200 cost / $1,800 sell. The partial sibling is `substructurePartialAllowance`, $650 cost / $1,000 sell. None of those notes names work outside new support material, installation, excavation, concrete, or deck-area removal.
- **Rule.** Until a distinct operation is established, neither benchmark enters the known total. The request stays visible and unpriced. Independent measured work can still price. A missing count is not quantity one and not a lump sum. Measured supports remove the allowance only when they cover the requested replacement. New piles do not cover removal or temporary support. A typed Pricing amount needs an explicit scope and basis and must not repeat measured lines.
- **Status.** Adopted. Benchmark dollar values are unchanged.

## Deferred

These rows stay selectable. On 8 November 2026 Jean-Luc approved keeping deferred families selectable where the catalogue describes their limits. They are not approved exclusions.

### Pergola and kitchen

- **Advertised.** Selectable. Catalogue labels “Pergola” and “Kitchen renovation”. Capability label “Developing”.
- **Existing function.** The current calculators remain. No new recipe is proposed.
- **Known limit.** The kitchen catalogue sentence described a renovation, including cabinetry and trade allowances, while the support contract says the calculator is not a mature commercial claim. On `68c5760c`, the brief “Replace the kitchen.” with no area priced 10 m² of labour ($9,600 cost / $12,000 sell) and a $20,000 / $30,000 materials package, and the client draft named cabinetry, benchtop, and appliances.
- **Repair.** `estimating/v3-kitchen-area` keeps an unstated area out of the known total. “Replace the kitchen.” stays visible and asks for the area and the scope choice. “Replace the kitchen. The room is 12 m².” keeps 12 m² on the labour line and shows the existing minimum package, and both stay out of the known total until the kitchen scope is Full kitchen renovation. “Include a splashback.” keeps the existing lump at $800 cost and $1,200 sell. That lump is the same for an unmeasured area, a measured 3 m², and a measured 8 m². An unmeasured splashback does not display 3 m².
- **Why proposed.** Reliable depth in the claimed paths comes first.
- **When it cannot be priced.** The user sees the developing label and any existing Pricing Required line. The page does not gain a new complete-price claim.
- **Status.** Published on Integration in `b3520440`. Scenario QA passed all three briefs on `bb831f4b` and again on the combined SHA. The package is held out of the known total until Full kitchen renovation. The splashback figure is the existing lump, not a price per square metre. The catalogue sentence no longer promises cabinetry and trade allowances.

### Ceilings, cladding, painting, plastering, demolition, and external stairs

- **Advertised.** Selectable from the catalogue. Capability label “Component”.
- **Existing function.** The current component calculators remain.
- **Known limit.** No hosted complete assembly is claimed. External stairs are often nested under a deck.
- **Why proposed.** A new recipe is not required to keep the existing component path.
- **When it cannot be priced.** The user sees Pricing Required or an unresolved component line. The family is not presented as a finished assembly.

### Commercial fit-out

- **Advertised.** The parent type is in the unsupported list. Capability label “Not supported as a work area”.
- **Existing function.** Interior work stays on the component types.
- **Known limit.** A parent calculator would contradict the support contract.
- **Why proposed.** Keep the parent unsupported.
- **When it cannot be priced.** The user does not get a fit-out assembly price. Component work areas remain the pricing surface.

### Roofing, windows, landscaping, earthworks, drainage, plumbing, electrical, and the other unsupported types

- **Advertised.** They remain in the catalogue, so Add Work Area can still offer them. Capability label “Not supported yet”.
- **Existing function.** No supported assembly is claimed. Do not remove a working control that only recognises the type.
- **Known limit.** The catalogue can make a type look selectable while the capability label says it is not supported.
- **Why proposed.** Recognition is not a promise of a priced assembly.
- **When it cannot be priced.** The user sees “Not supported yet” and no supported price.

### Release operations and account answers

- **Advertised.** Not a work-area family.
- **Existing function.** Production, Play Console, schema, RLS, the analysis model, and automatic credit purchases stay untouched.
- **Known limit.** GST registration and company setup answers are account facts, not estimate defects.
- **Why proposed.** They are protected or they belong to the account.
- **When it cannot be priced.** No Production change is made. An undecided GST answer stays an account question.

## Calibration

Jean-Luc prioritised deck support labour. “Quotr benchmark” is an approved source label for an applicable, disclosed benchmark. It is not approval of every existing rate or productivity. Numerical benchmarks stay unchanged until a proposed basis and values are reviewed. Software repairs continue while that review is pending.

Defined removal or temporary-support work uses a company rate, an explicit project rate, or a relevant subcontractor price. No fallback is invented for that work.

Deck support coverage, from the current contracts. A separate rate key is not evidence of separate work.

| Operation | What the current path prices | Overlap |
| --- | --- | --- |
| New support installation | “Pile/post installation”, component `deck.posts.install`. Labour only. The note says hole excavation and concrete are separate, and the time is not inside substructure framing. | Does not include excavation, concrete, or removal. |
| Excavation | “Hole excavation”, bank cubic metres. It is not deck demolition. | Does not include installation or concrete placement. |
| Concrete placement | “Concrete placement”, hours per purchased bag. Material bags are a separate line. | Does not include digging or pile installation. |
| Existing-support removal | Not priced. “Existing deck removal” is deck-area demolition, not pile extraction. | Must not be treated as covered by new piles or by deck removal. |
| Temporary support | Not priced. No line names propping, temporary support, or underpinning. | Must not be inferred from the installation or excavation keys. |

## Finish plan, 6 November 2026

Integration is the combined SHA `b3520440`. Production is unchanged.

### Smallest credible Preview release

Integration as it stands, plus Batch 3 and the kitchen boundary, with catalogue sentences narrowed to the verified path. No new recipe. No new benchmark dollars. Mobile evidence for the already accepted fence and retaining journeys is part of this boundary because those families are already claimed.

After that candidate, a builder who replaces a deck sees an unknown pile count as “Quantity unknown” and does not get an automatic pile-replacement allowance in the total. Priced deck work is labelled “Priced work so far” while that coverage is open, and the final job price stays withheld. Declining concrete removes the concrete charge and still shows that support method, post count, and excavation are open. “Replace the kitchen” stays visible and unpriced until area and scope are stated. A stated 12 m² shows what the labour and minimum package cover and stays out of the known total until the builder chooses Full kitchen renovation. A splashback stays the existing lump and does not assume 3 m². Stated fence, retaining, flooring-room, and opening facts continue to survive as they do on Integration today.

### Remaining work

| Item | User impact | Evidence still needed | Next action | Depends on | Effort | Needs | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kitchen close-out | An unstated kitchen is no longer a 10 m² package, and a stated area is not added until the builder chooses the package. | Hosted PASS on `28f5cc7d` and `96beddeb`. Project `b4c6c06c-8004-4afc-bebd-b930843f3a70`. Before confirmation the known total is $0. After Full kitchen renovation it is $31,520 cost and $44,400 sell, and reload keeps both. | Accepted. | None. | Done. | None. | The package stays out until the explicit Full kitchen renovation choice. The dollars are the existing arithmetic. |
| Batch 3 hosted check | Unknown pile replacement can be saved with an internal basis and reloaded. Its sell stays out of the priced total. The client projection names the work and not the basis. | Same project `48a03529`. After save and reload, the allowance is Quantity unknown, $400 / $600, not in the total. Priced work so far is $5,736.88. Quote locked. Review disabled. No client document. `615af37a` was blocked for rounding, and `1c9cec42` closed it. | Keep the gates. Do not create a quote. | None. | Done. | None. | Basis stays internal, client text omits it, quantity stays unknown, the excluded sell stays out of the total, and the gates stay. |
| One Integration candidate | The builder gets both repairs on the same Preview. | [Release review](3e706da7-6b9b-4827-a77e-e8919d00e8ac) returned APPROVE FOR PREVIEW INTEGRATION for `b3520440`. | Integration fast-forward is done. Serving deployment `dpl_7f8JaygJYDWFWHCShoTbPtgjoftH`. | None. | Done. | None. | Integration serves `b3520440`. |
| Catalogue honesty | Add Work Area no longer describes work the calculator will not price. | The sentences below. No new journey. | Edit descriptions on the combined tip. | The combined candidate, so this does not open a third branch. | Half a day. | Code. | Descriptions match the release boundary. Capability labels stay as they are. |
| Fence and retaining mobile | The accepted timber journeys remain usable on a phone. | BLOCKED on 6 November 2026. Integration was the login page, so projects `f7a1095c-8928-4a6c-82a1-f8603d1e88fd` and `13eaab78-aaf0-445e-a030-61cc37e73e0d` were not opened. Desktop reports stay accepted. | Read both at phone width after the isolated sign-in. Do not edit them. | Isolated QA sign-in on the Integration host. | One session. | Access. | Stated quantities still readable. No new price claim. |
| Deck mobile | The accepted deck partials were desktop hosted jobs. A 390 px note covers the feedback control, not a full deck journey. | One mobile pass of an already priced deck path. Bathroom desktop and 390×844 reloads already exist and are not repeated. | After the combined Preview, only if this remains required for the claimed deck path. | Combined Preview. | One session. | Access. | Stated deck quantities stay readable. No new price claim. |
| Benchmark calibration | A disclosed benchmark is not mistaken for a checked market price. | No dollar proposal exists. Deck support labour was the priority. | Approved 8 November 2026. Ship the current disclosed benchmarks. No new dollar values. | None. | Done. | None. | The release keeps the disclosed arithmetic. It is not a market calibration. |
| Production recommendation | A later release can move without dropping the website or Android lines. | Candidate `96beddeb` passed the kitchen workflow script and the unchanged kitchen boundary script. The five earlier scripts and the disposable migration rehearsal stay carried. | Released 8 November 2026 as `dpl_5KxnUEhLzT6MJUj4mpGSKSYP6oue`. Android and marketing stayed put. | None. | Done. | A named Production QA organisation before any Production write. | Migration 126 is verified. The app serves `96beddeb`. Rollback was not used. |

### Release boundary

Capability labels come from `lib/work-areas/support-contract.ts`. Catalogue descriptions on Integration are wider than those labels. `getEstimateSupportLabel` returns “Developing” for every calculator and is not the customer label.

| Family | Label now | Reliable price | Useful partial | Capture for manual or subcontractor pricing | Boundary |
| --- | --- | --- | --- | --- | --- |
| Deck | Supported | Measured low and elevated timber assemblies already on Integration. | Concrete declined, or pile replacement requested without a distinct operation. | Uncovered removal and temporary support, with an explicit basis. | Accepted measured path. Batch 3 is the required honesty repair. Composite, stairs, balustrades, and “pergolas where relevant” in the catalogue are wider than the verified path. |
| Fence | Supported | One timber paling run with the stated length, height, and gate. | Missing company rates stay unpriced or labelled as a benchmark. | Metal, plastic, and other systems. | Desktop accepted. Mobile and benchmark calibration are open. The catalogue timber sentence matches the claim. |
| Retaining wall | Supported | One timber raking wall, stated geometry and drainage choice. | Excavation labour stays Pricing Required. | Sleeper and masonry. Hole-excavation labour has no invented benchmark. | Desktop accepted. Mobile and the recorded benchmark sell are not a price approval. |
| Bathroom | Supported | Stated removals, disposal, vanity installation, floor tiling, and painting on the accepted partials. | Waterproofing, access, carry, wall scope, and an unknown substrate stay unresolved. Confirmed plywood replacement prices plywood and underlay separately. | A whole-bathroom recipe is not in this release. | Hosted partials exist. The catalogue sentence still says the renovation includes fixtures. Narrow that sentence after the combined candidate. |
| Flooring | Component | Laminate and carpet-tile rooms, with the accepted area headings. Ordinary nested flooring stays as previously frozen. | A missing company rate stays unpriced. | Specialist finishes and exact unpriced substrate. | Accepted. Do not repeat the heading QA. |
| Internal walls and doors | Component | A stated opening count is one unsized opening. A sized opening survives reload. Ordinary nested doors stay as previously frozen. | Custom and specialist door portions stay Pricing Required. | Steel partitions and unstated door sets. | Opening-count path accepted. Do not rerun it. |
| Kitchen | Developing | A stated component whose own inputs are enough, including demolition and the existing splashback lump. | Stated area shows labour and the minimum package and waits for Full kitchen renovation. | Unstated area, cabinetry, benchtop, appliances, plumbing, and electrical. | Accepted for the package choice. Those unpriced components stay outside the known total. |
| Pergola | Developing | No mature assembly is claimed. | The current calculator remains. | Anything the current questions do not define. | Proposed deferral of a new recipe. Not an approved exclusion. |
| External stairs, demolition, ceilings, painting, plastering | Component | The current component calculators only. | Pricing Required or an unresolved component line. | A finished assembly. | Proposed. External stairs are often nested under a deck. Descriptions that read as a full stair, ceiling, or plaster package are wider than the claim. |
| Cladding | Component | The component calculator. | Custom and specialist portions stay Pricing Required. | Those specialist portions. | The catalogue sentence already says this. |
| Commercial fit-out | Not supported as a work area | None. | Interior components stay on their own types. | A parent fit-out price. | Proposed. Keep the parent unsupported. |
| Roofing, windows, landscaping, earthworks, drainage, plumbing, electrical, and the other unsupported types | Not supported yet | None. | Recognition only. | No supported price. | Selectable recognition is not a priced assembly. Proposed. |

### Release validation, 6 November 2026

Nothing was deployed. No migration was applied. Customer projects were not opened or edited.

#### Preview checks

Serving deployment remains `dpl_7f8JaygJYDWFWHCShoTbPtgjoftH`, SHA `b3520440`. One Preview-only password reset was applied after the auth project was confirmed as `shhpjsoldmqtkdbgrbtm` and the account was confirmed as the active owner of only “V3 QA isolated mw2usno8”. The new password is in the local credential store. It is not in this register. Both hosts then showed that organisation before any project was opened.

| Check | Deployment | Project | Result |
| --- | --- | --- | --- |
| Deck pile reload | `dpl_7f8JaygJYDWFWHCShoTbPtgjoftH` | `48a03529-cee9-47bb-87c9-f836eac8408e`, pricing `efddd432-7dab-464b-8665-dc1d8418499c` | PASS. Quantity unknown, allowance $600.00, client sell $5,736.88. $6,336.88 is absent. Review and quote stay locked. |
| Kitchen 12 m² package | Integration `dpl_uZceKZ9DxbVk9yayihcXf2UDTocJ` (`28f5cc7d`), then candidate `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE` (`96beddeb`) | `b4c6c06c-8004-4afc-bebd-b930843f3a70`, estimate `6a319522-754c-4331-aab7-5164bf4a8b30` | PASS. Before confirmation the known total is $0 and “Kitchen scope not confirmed” is visible. After Full kitchen renovation and regenerate, cost is $31,520 and sell is $44,400. Reload keeps both. Quote count stays 0. |
| Fence phone width | Same deployment | `f7a1095c-8928-4a6c-82a1-f8603d1e88fd` | PASS at 390×844. No horizontal overflow. Readable: 17.1 m fixed run, 0.9 m gate, 12 posts, 120 palings, 28.8 lm posts, 53.87 lm rails, 226.8 lm palings. Pricing can continue. |
| Retaining phone width | Same deployment | `13eaab78-aaf0-445e-a030-61cc37e73e0d` | PASS at 390×844 for the rendered takeoff. No horizontal overflow. Readable: 121 lm face boards at 10% waste and the drainage volumes. Pricing can continue. The 16.5 m² face and 14-pile count were not in the rendered phone estimate or takeoff text. |

Practical impact: the fence and retaining phone reads on this deployment pass for the quantities that were on screen. The retaining read stays scoped to that rendered takeoff. The 16.5 m² face and 14-pile count were not required again. The pile line is verified on this deployment. The kitchen package choice is now verified on Integration `28f5cc7d` and on website candidate `96beddeb`. The earlier pile, fence, and retaining reads stay accepted. Their paths are unchanged by the four-file kitchen diff. The earlier candidate Preview `dpl_ATto3MQMteRCcoGkHLNJVA2QMbzN` (`1dae7664`) is superseded by `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE`. The Preview environment’s public Supabase URL is the preview project `shhpjsoldmqtkdbgrbtm`, not Production `lxvnylhsbvudzzupxeqr`. Stripe secret values were not read. The deployment target is preview, so it receives the separate Preview Stripe records. The Integration alias stays on its Preview. `app.get-quotr.com` now serves the website Production deployment recorded below. `get-quotr.com` and `play.get-quotr.com` stay on their previous deployments. The five verifier results and the disposable migration rehearsal stand. This host needs its own sign-in. The hosted smoke of deck post answers, partial-estimate readiness, and Pricing on this deployment has not started.

#### Production proposal

The steps below are the procedure that was approved and executed. The result is in “Production completion, 8 November 2026”.

- Hosts. `app.get-quotr.com` returns the Vercel app login from `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` (`bc0a7667`, Ready, target production). `get-quotr.com` returns the marketing page “Estimate. Price. Quote.” through Cloudflare, not that Next login. Vercel also lists `get-quotr.com` as an alias of the same deployment. The public apex is the marketing site. `play.get-quotr.com` is a different project, `quotr-play`, deployment `dpl_98TSTQwHHcz2s1qw9o39CqFLYSZd`, Ready, SHA `ff39ba31`.
- Release candidate. Branch `release/website-v3-candidate`, commit `96beddebd40ee572b1865c152aa4f7cfcad40fff`. Parents `1dae7664` and `28f5cc7d`. The four-file change from `1dae7664` adds the kitchen package choice. The deck section still keeps `deckCountWriteKey` and `deckPostsInScope`. `release/android-estimating-stage-1` remains `ff39ba31`.
- Checks on `1dae7664`. `scripts/verify-estimating-v3-stage1.ts` 18 passed, 0 failed. `scripts/verify-blank-pile-count-readiness.ts` 8 passed. `scripts/verify-excluded-allowance-total.ts` 9 passed. `scripts/verify-kitchen-unstated-area.ts` passed, including unchanged benchmark dollars. `scripts/verify-partial-estimate-readiness.ts` 30 passed, 0 failed.
- Android. `ff39ba31` is 22 commits ahead of `b3520440`, including the Play host, account deletion, and the workspace layout. The Stage 1 estimating diff from `bc0a7667` to `ff39ba31` is empty for `lib/estimate`, `lib/pricing`, `lib/scopes`, and `DeckPostHolesSection.tsx`. Twenty paths differ from `40d98384` on both lines. They are the Stage 0 and Stage 1 files, including that deck component. A later Android pickup must merge those paths and rerun the Stage 1 script. It must not replace `release/android-estimating-stage-1` or `play.get-quotr.com`.
- Migration. Rechecked 6 November 2026. Preview history ends at 125 `plan_confirmation_once`. Production history ends at 123 `detach_personal_authors`. Version 121 is `account_deletion_requests` on both. Neither database has version 126. The candidate file is `supabase/migrations/126_pricing_document_tax_basis.sql`. The colliding `121_pricing_document_tax_basis.sql` is not on this branch. Preview already has nullable `pricing_documents.gst_tax_basis`. Production does not. Versions 124 and 125 are not in this candidate and are not applied by it. Do not use `db push` from this branch against Production: the branch does not contain the remote 121–125 files, and a push could misread that gap. Apply file 126 by itself, only after a separate approval, and only after a read-only check that version 126 is absent. On Production, confirm the column is missing before the statement and nullable `jsonb` after it. On Preview, the same statement skips the existing column. Then confirm `gst_rate` is unchanged on drafts, `quotes`, and `accepted_commercial_snapshots`, and that version 121 is still account deletion.
- Existing data. The column SQL does not update rows. A draft keeps its stored `gst_rate`. Null means that rate has not been kept as an explicit override. The new Pricing code writes the marker only when a draft rate is saved apart from registration, clears it when the registration rate is applied, and refuses both writes when the document is converted or archived. Quote creation copies `gst_rate` onto `quotes`. It does not copy `gst_tax_basis`. Issued quotes and accepted snapshots stay on their own `gst_rate`.
- Environment. Production and Preview keep separate Vercel records for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the Stripe secret, webhook, prices, tax rate, and portal configuration. Values were not read and were not copied. The candidate branch override `SUPABASE_SERVICE_ROLE_KEY` is Preview for `release/website-v3-candidate` only. It does not apply to a Production target. Preview-only names remain `BILLING_ENFORCEMENT_MODE`, `PLAN_CONFIRMATION_EMAIL_ENABLED`, `SCOPE_DISCOVERY_ENABLED`, and `VERCEL_PREVIEW_FEEDBACK_ENABLED`. Production-only names remain `ACCOUNT_WELCOME_EMAIL_ENABLED`, `ACCOUNT_WELCOME_EMAIL_PRODUCTION`, and `LOOPS_WEBHOOK_SECRET`. Databases stay Preview `shhpjsoldmqtkdbgrbtm` and Production `lxvnylhsbvudzzupxeqr`.
- Deployment method. Do not promote Preview `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE`. That build was made with Preview public values, including the branch Preview credential. Do not run `vercel deploy --prod` from a laptop upload, and do not copy any Preview value into Production. After migration 126 is verified, fast-forward `release/website-estimating-stage-1` from `bc0a7667` to `96beddebd40ee572b1865c152aa4f7cfcad40fff`. `bc0a7667` is an ancestor of that commit, so the update is a fast-forward. The commit is the current tip of `release/website-v3-candidate`. The immutable reference is https://github.com/itsquotr-sketch/quotr_2.0/commit/96beddebd40ee572b1865c152aa4f7cfcad40fff. Deploy that SHA, not a later branch tip. The Git Production deployment uses the Production environment records above. Before the aliases are treated as released, confirm the new deployment target is production, `githubCommitSha` is `96beddeb`, and the built public Supabase host is `lxvnylhsbvudzzupxeqr`. If that host is the Preview ref, stop. `app.get-quotr.com`, `quotr-2-0.vercel.app`, and the stage-1 branch alias move with that deployment. `get-quotr.com` stays the marketing page through Cloudflare. `play.get-quotr.com` stays `dpl_98TSTQwHHcz2s1qw9o39CqFLYSZd`.
- Rehearsal. Disposable Postgres only. The container was removed. The Production-shaped start had no tax column. After file 126, `gst_tax_basis` was nullable `jsonb`. Draft rates stayed 15.00 and 0.00, the sent quote stayed 15.00, the accepted snapshot stayed 15.00, and the variation revision stayed 12.50. History kept 121 as `account_deletion_requests` and recorded 126 separately. The Preview-shaped start already had the column and a document override. The same statement reported that the column already existed. The override, the 15.00 draft, the 0.00 converted draft, the quote, and the snapshot were unchanged. Preview and Production databases were not changed.
- Single-file procedure, not a migration push. `supabase db push` stays out of this plan because this branch does not contain remote versions 121–125. History rows store `version`, `name`, and `statements` in `supabase_migrations.schema_migrations`. Version 121 is stored as `account_deletion_requests`. The migration file contains the `alter table` and the column comment. It does not insert the history row. After a separate approval, and before the Production build receives traffic, apply only those two statements plus one history insert in one transaction on Production `lxvnylhsbvudzzupxeqr`: version `126`, name `pricing_document_tax_basis`, and those statements. Do not insert the history row before the column exists, and do not mark it with a repair command that skips the SQL. Read back before the app moves: 126 is the only new history row, 121 is still `account_deletion_requests`, `pricing_documents.gst_tax_basis` is nullable `jsonb`, and `quotes`, `accepted_commercial_snapshots`, `variation_revisions`, `variation_responses`, and `variation_accepted_adjustments` still have `gst_rate` and no `gst_tax_basis`. On Production the new column is null on every existing document immediately after the statement, because the file has no `update`. Confirm sampled draft, quote, and snapshot `gst_rate` values are unchanged. If any read-back fails, do not deploy the new Pricing code.
- App rollout, only after the migration read-back passes and a separate promotion approval. Fast-forward the Production branch to `96beddeb` as specified above. Do not move `get-quotr.com` or `play.get-quotr.com`.
- Checks after release. No Production QA organisation is named. Do not write to Production, do not open an ERC Contracting project, and do not use the Preview organisation “V3 QA isolated mw2usno8”. Read-only: `app.get-quotr.com/login` returns the app, the health route answers, and no quote is created. Estimate generation and a Pricing save wait until the approval names a Production QA organisation. Those writes stay inside that organisation. `play.get-quotr.com/login` still returns its own app, and `get-quotr.com` still shows “Estimate. Price. Quote.”
- Rollback triggers. A Pricing save fails on the new column. A Stage 1 post, excavation, concrete, or condition check fails. A quote or accepted snapshot changes its stored GST rate. The app host and the marketing host swap. The Play deployment changes. The built public Supabase host is not `lxvnylhsbvudzzupxeqr`.
- Rollback sequence. Point `app.get-quotr.com`, `quotr-2-0.vercel.app`, and the website branch alias back to `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ`. Do not move `play.get-quotr.com`. Do not treat the Cloudflare marketing site as part of that alias rollback. Leave `gst_tax_basis` in place. Do not drop the column and do not delete history row 126. The current Production app does not read the column, so dropping it is not part of the rollback.

#### Verdicts

- Integration `28f5cc7d` on `dpl_uZceKZ9DxbVk9yayihcXf2UDTocJ`: [Scenario QA](22902092-9cfa-4d11-b2b6-967341d7a563) PASS. Project `b4c6c06c-8004-4afc-bebd-b930843f3a70` showed the package choice. Before the click the known total was $0. After Full kitchen renovation and regenerate, cost was $31,520 and sell was $44,400. Reload kept both. Quote count stayed 0.
- Website candidate `96beddeb` on `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE`: the same project repeated that workflow. Not Sure regenerated to Pricing Required with “Kitchen scope not confirmed” visible. Full kitchen renovation then regenerated to $31,520 and $44,400, and the reload kept them. Cabinetry, benchtop, plumbing, and electrical stayed unconfirmed. Quote count stayed 0.
- [Release review](4de7ef81-cd50-44e2-a936-bb8a898b43cf) returned APPROVE FOR PREVIEW INTEGRATION for `96beddeb`.
- [Release review](b66d235b-279e-4037-b453-16fd9cf47634) returned APPROVE FOR PRODUCTION for the same SHA. The approved execution is recorded in the completion section. Marketing and Play stayed outside the rollout.
- Benchmark dollars and deferred-family selection were approved with the release. The disclosed benchmark values stay. Deferred families stay selectable where their limits are described.

#### Kitchen 12 m², 8 November 2026

Integration Preview `https://quotr-2-0-git-estimating-v3-quotr1.vercel.app` serves `dpl_uZceKZ9DxbVk9yayihcXf2UDTocJ`, commit `28f5cc7d`. The website candidate Preview is `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE`, commit `96beddeb`, at https://quotr-2-0-fhtxmxc0s-quotr1.vercel.app and https://quotr-2-0-git-release-website-v3-candidate-quotr1.vercel.app. Both are target preview. Production aliases were not moved.

Project `b4c6c06c-8004-4afc-bebd-b930843f3a70`, “Kitchen 12 held”, in “V3 QA isolated mw2usno8”. Brief: “Replace the kitchen. The room is 12 m².” Area 12. Estimate `6a319522-754c-4331-aab7-5164bf4a8b30`.

Before confirmation on `28f5cc7d`, the stored renovation value was “Replace”. That is not an explicit package choice. The known cost and sell were 0. The page showed Pricing Required, gross profit $0.00, and “Kitchen scope not confirmed”. Full Kitchen Renovation was visible and not selected. The held lines were Kitchen labour, 12 m², $60/h, 16 h/m², direct cost $11,520, and Kitchen materials/finishes allowance, 1 allow, direct cost $20,000. Both sources say Quotr benchmark. They stayed out of the known total.

After the explicit choice and Regenerate estimate, the fact is “Full kitchen renovation”. The known cost is $31,520 and the known sell is $44,400. Labour is $11,520 cost and $14,400 sell. Materials are the minimum package, $20,000 cost and $30,000 sell. There is one of each line. Reload kept the selection and both totals. The same result was repeated on `96beddeb`: an explicit Not Sure regenerated back to Pricing Required and the scope gap, then Full kitchen renovation regenerated to $31,520 and $44,400 and survived reload.

The amounts are the existing arithmetic. 12 m² at 16 h/m² is 192 hours. Labour cost uses the $60/h carpenter benchmark, and labour sell uses the 20% default margin, $75/h. Twelve square metres at $1,500 / $2,300 is below the $20,000 / $30,000 minimum package, so the materials line is that package. This is not a market calibration.

Cabinetry, benchtop, plumbing, and electrical scope remain unconfirmed and are visible on Assumptions & checks. The overview says “Priced work so far” and “Priced work only. This is not the complete job price.” Quote count is 0. No pricing document was created.

A CLI upload of `96beddeb` could read this project but could not save, because the generic Preview service role is not a service_role JWT. The candidate branch has its own Preview service role, and the git Preview above is the one that saved. Production variables were not changed.

[Release review](41bb2420-0096-4353-ab58-fcf60b68b124) blocked the missing control. [Release review](4de7ef81-cd50-44e2-a936-bb8a898b43cf) approved `96beddeb` for Preview integration. Neither verdict applies migration 126 or promotes the app.

#### Recommendations for owner approval

Approved 8 November 2026. Ship the current disclosed benchmarks with no new dollar values. Keep deferred families selectable where the catalogue states their limits.

#### Production completion, 8 November 2026

Migration 126 was applied to Production `lxvnylhsbvudzzupxeqr` in one transaction after the read-only preflight. Preflight: version 126 was absent, `pricing_documents.gst_tax_basis` was absent, and version 121 was `account_deletion_requests`. History ended at 123 `detach_personal_authors`. Read-back: 126 `pricing_document_tax_basis` is the only row after 123, with two statements. Version 121 is still `account_deletion_requests`. The new column is nullable `jsonb` and its comment is the file comment. It is null on all 27 pricing documents. `quotes`, `accepted_commercial_snapshots`, `variation_revisions`, `variation_responses`, and `variation_accepted_adjustments` still have `gst_rate` and do not have `gst_tax_basis`. Rate totals were unchanged: pricing documents 390.00 across 27 rows, quotes 480.00 across 33, snapshots 15.00 across 2, variation revisions 45.00 across 3, variation responses 30.00 across 2, and variation adjustments 30.00 across 2.

`release/website-estimating-stage-1` fast-forwarded from `bc0a7667` to `96beddebd40ee572b1865c152aa4f7cfcad40fff`. The Vercel production branch setting is `main`, so that push started a Preview build. That Preview, `dpl_GGggdnsdExrKwn5NudcFypXcwPSw`, was canceled before it finished. The serving build is the Git deployment `dpl_5KxnUEhLzT6MJUj4mpGSKSYP6oue`, https://quotr-2-0-7ngbcjlrb-quotr1.vercel.app, target production, Ready, commit `96beddeb`, ref `release/website-estimating-stage-1`. It was not a promotion of Preview `dpl_Ee6Xe847JS6kEQHBVnXtxn4jAsVE` and not a laptop upload. The Production `NEXT_PUBLIC_SUPABASE_URL` hostname is `lxvnylhsbvudzzupxeqr.supabase.co`. That variable has no branch override. The login client bundle does not embed a Supabase host. The Preview ref was not present in the scanned login assets.

Checks: `app.get-quotr.com/login`, `quotr-2-0.vercel.app/login`, and the stage-1 branch alias return the app sign-in bundle, including “Welcome back”, “Sign in”, and “Forgot password”. `/app/health` answers with 307 to `/login?next=/app/health`. `get-quotr.com` still shows “Estimate. Price. Quote.” `play.get-quotr.com` still serves `dpl_98TSTQwHHcz2s1qw9o39CqFLYSZd`, Ready, `ff39ba31` on `release/android-estimating-stage-1`. No quote was created. Rollback was not used. The previous app deployment `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` remains the alias rollback target. The tax column and history row 126 stay in place.

No Production QA organisation was named for the release checks. Estimate generation, Pricing writes, customer edits, and quote sending were not run. The deployment record is closed. The smoke below is proposed and has not been run.

#### Repeatable release method

Vercel’s Production branch setting remains `main`. This close-out does not change it. A push to `release/website-estimating-stage-1` creates a Preview build, so that push is not the Production release by itself.

The repeatable method for the next website release is:

1. On Production `lxvnylhsbvudzzupxeqr`, read the migration history and the target column before any write. Stop if the version is already present or the column is already there.
2. Apply the reviewed SQL and its history row in one transaction. Read the result back before any app traffic. Stop if the read-back fails.
3. Confirm the reviewed SHA is a fast-forward of `release/website-estimating-stage-1`, then fast-forward that branch to the exact SHA. Do not force the push.
4. Cancel the Preview build that the branch push starts.
5. Create a Git deployment of that exact commit and ref with target `production`. That build uses the Production environment records. Do not promote a Preview deployment, do not upload a Production build from a laptop, and do not copy Preview values.
6. Before the aliases are treated as released, confirm target `production`, `githubCommitSha` equal to the reviewed SHA, and public Supabase host `lxvnylhsbvudzzupxeqr`.
7. Check `app.get-quotr.com`, `quotr-2-0.vercel.app`, and the stage-1 branch alias. Confirm `get-quotr.com` still shows the marketing page and `play.get-quotr.com` still serves its own deployment.
8. On a blocking fault, point `app.get-quotr.com`, `quotr-2-0.vercel.app`, and the website branch alias back to `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ`. Leave an applied nullable column and its history row in place.

#### Proposed Production smoke

No existing organisation is a dedicated Production estimating QA organisation.

| Organisation | Owner | Why it is not the smoke org |
| --- | --- | --- |
| ERC Test `7ac3a9d6-1f0b-4488-9ee4-aefe3821c3f6` | `hello@erccontracting.co.nz` | Owner inbox. No projects. |
| Quotr Test `a49ac2c9-5e3c-40c4-be35-e8df705217d8` | `hello@get-quotr.com` | Product owner account. Empty, but not a dedicated QA login. |
| Quotr Test 2 `60fcfd70-7159-48c7-852b-3b30dc57d321` | `test-hello@get-quotr.com` | Empty. The login is not a plus-address, and no credential is stored. |
| Quotr Test 3 `23ba419c-4d35-41cd-ba2c-15c46325e29f` | `test2-hello@get-quotr.com` | Empty. Same login constraint. |
| Quotr Test 4 `1692a980-87e4-4f91-ab26-6800acc4ac6c` | `test3-hello@get-quotr.com` | 72 projects and 15 quotes. |
| Checkout Test `8d853621-e149-45bd-8b64-68a0b3d6c917` | `hello+test@erccontracting.co.nz` | Billing fixture. One customer, one project, and one quote. |

Proposal, not yet created: one new organisation named “V3 Production QA”, owned by a new plus-address created for this smoke, with that login bound only to this organisation. It starts with no customers and no projects. The dashboard must show that name before a job is created. ERC Contracting and the Preview organisation stay outside the test.

The journey is one fresh timber paling fence, the supported assembly already calculated by `calculateEstimate` at `96beddeb` with no company rates. Brief: “Build a new timber paling fence, 18 m long and 1.8 m high, with one 0.9 m gate.” No customer. Details to store: vertical timber paling, Radiata pine, 150 × 19 mm boards, 1.8 m post spacing, one 0.9 m gate, and top capping. If the new organisation has company rates, stop and report them. The benchmark dollars apply only when the source is Quotr benchmark.

Independent expectation from that calculator, with no organisation rates:

| Line | Quantity | Cost | Sell |
| --- | ---: | ---: | ---: |
| Fence posts | 28.8 lm | 345.60 | 432.00 |
| Fence palings | 226.8 lm | 453.60 | 567.00 |
| Fence rails | 53.865 lm | 152.44 | 190.70 |
| Top capping | 18 lm | 72.00 | 90.00 |
| Gate frame | 7.41 lm | 20.98 | 26.23 |
| Gate hardware | 1 ea | 85.00 | 106.25 |
| Post-hole concrete | 44 bags | 429.88 | 537.24 |
| Fence fixings | 1 allowance | 54.24 | 67.80 |
| Post installation | 12 posts, 21.6 h | 1,296.00 | 1,620.00 |
| Rail/framing installation | 51.3 lm | 154.20 | 192.75 |
| Vertical paling installation | 216 lm | 540.00 | 675.00 |
| Top-cap installation | 18 lm | 135.00 | 168.75 |
| Timber gate fabrication and installation | 1 gate, 3.5 h | 210.00 | 262.50 |
| Post-hole concrete placement | 44 bags | 175.80 | 219.75 |
| Fence total |  | 4,124.74 | 5,155.97 |

Takeoff: fixed run 17.1 m, gate 0.9 m, face 32.4 m², 12 posts, 12 holes, 120 palings, 216 lm required and 226.8 lm purchased, 3 rails and 51.3 lm required, capping 18 lm, 44 concrete bags. Labour uses the $60/h carpenter benchmark and 20% margin, $75/h. These amounts are the disclosed arithmetic, not a market calibration.

Steps after approval: sign in only as the new owner; open `/app/health` and confirm Production, host `lxvnylhsbvudzzupxeqr`, and commit `96beddeb`; create the job; Analyse; store the details; generate the estimate; compare takeoff, quantities, cost, and sell with the table; save an unsent Pricing draft; reload and confirm the draft persists. Quote count stays 0. Do not send a quote. A preliminaries line, if the product adds one, is reported separately and is not part of the fence total.

### Next action

Development Lead. The website deployment record is closed at `96beddeb` / `dpl_5KxnUEhLzT6MJUj4mpGSKSYP6oue`. Approve creation of “V3 Production QA” and the timber fence smoke before either is run. Do not use ERC Contracting, the Preview organisation, or the existing test organisations above.
