# Estimating V3 Stage 0 — defect register

Evidence is from `npx tsx scripts/verify-estimating-v3-stage0.ts` on `40d98384`, plus the modules named below. The script passed 20 checks. Those checks lock the current behaviour, including the defects. They are not the desired end state.

Severity is for estimating trust: P0 blocks a correct save or leaves a finished answer looking unfinished. P1 drops or mislabels scope the brief already contained. P2 is a contract mismatch that does not by itself invent money.

## P0 — Flooring board width returns “Invalid fact update.”

**Reproduction.** Hardwood board width is input type `number` and also offers `145 mm`, `165 mm`, `186 mm`, `190 mm`, and `220 mm`. `ClarifyAnswerControl` renders options before the number field whenever `options.length > 0`. Choosing `145 mm` goes through `persistClarifyValueType`, which returns `number` because the candidate input type is number. `normalizeAnswerForStorage` returns `Number("145 mm")`, which is `NaN`. `commitUserFactEdit` rejects a non-finite number with `Invalid fact update.`

**Root cause.** Established. The option string and the number normaliser disagree. `parseFlooringPositiveMm` would accept `145 mm`. The save path never reaches it.

**Contract.** `lib/estimate/flooring-question-copy.ts`, `components/assistant/clarify/ClarifyAnswerControl.tsx`, `lib/assistant/clarify/interaction.ts`, `lib/scopes/fact-values.ts`, `lib/assistant/scope-persistence.ts`.

**Smallest fix.** Stage 1. Parse a millimetre option into a finite number before the finite check, or stop treating those options as a select while the input type remains number. Keep the finite check. A typed `145` already stores `145`.

**Regression.** `verify-estimating-v3-stage0.ts` checks “selecting 145 mm is stored as a non-finite number”. Stage 1 inverts that check to a finite `145` and re-renders the control.

**Same defect, same fix.** Tile width `600 mm` and tile length use the same option-plus-number path. The script locks tile width as well.

## P0 — Deck post count saves and stays unanswered

**Reproduction.** Facts `deck.substructure_included = true` and `deck.hole_count = 16`, with no bearer layout and no `deck.pile_or_post_count`. `deckDetailGaps` still includes `posts` (“Enter the number of posts”). The control for that gap is `deck-hole-count-{id}`, and `DeckPostHolesSection` writes `deck.hole_count` from it. The field can show 16 because `displayCount` is the saved hole count. The gap remains.

**Root cause.** Established. The gap reads post count. The focused control writes hole count. `conditional-rules.ts` hides `deck.pile_or_post_count` unless pile replacement is yes, so the generic question does not collect the value the gap wants.

**Contract.** `lib/estimate/deck-detail-completeness.ts`, `components/assistant/job-plan/DeckPostHolesSection.tsx`, `lib/scopes/conditional-rules.ts`.

**Smallest fix.** Stage 1. When the gap is `posts`, the focused field writes `deck.pile_or_post_count`. Hole count stays a separate override and still requires a reason when it differs. Do not treat a hole count as a post count inside the calculator unless the existing “stated posts win” rule already says so.

**Regression.** The script checks that hole count alone leaves `posts`, and that post count plus a complete ordinary hole set clears the gaps when concrete is off.

## P0 — Completed excavation stays in the unfinished count

**Reproduction.** With post count, circular 350 × 600 mm holes, ground `ordinary`, method `hand`, and spoil `on_site`, `deckDetailGaps` is empty. Adding `deck.concrete_to_supports = true` leaves `fill`, `post`, and `embedment`. Ground, method, and spoil are not in that list. The Details unfinished count and the “Finish N Post holes answers” copy use the whole list.

**Root cause.** Established for the shared count. Excavation itself is complete in this fixture. Concrete fill, post size, and embedment remain, and the product presents them as the same Post holes remainder.

**Contract.** `deckPostHoleFinishItems` in `lib/estimate/deck-post-hole-result.ts`, `deckDetailGaps`, `settledPostHoleAnswerCount`, `deckDetailPanelPrompt`.

**Smallest fix.** Stage 1. Report excavation completion separately from concrete completion. Do not mark fill, post size, or embedment answered. Do not hide them from readiness.

**Not claimed.** This fixture does not show a saved ground answer being dropped on reload. That would need a hosted round-trip. The deterministic gap is the shared unfinished count.

## P1 — Project-condition questions move when the work-area set changes

**Reproduction.** `composeClarifyView` for a confirmed deck yields `ASK_NOW:site_access`, then `ASK_NOW:material_carry_distance`. Adding a confirmed bathroom keeps those two and appends `ASSUME_IF_SKIPPED:floor_level`, `occupied_site`, and `working_hours`. Order is ask class, then score (`lib/assistant/clarify/rank.ts`). A new required condition would jump ahead of assumable ones the user had not reached yet. The project-condition group itself stays first in `groupDetailsCandidates`.

**Root cause.** Established for membership and class order. Not established as a random shuffle of an unchanged project. The movement is the applicability and ask-class sort.

**Contract.** `projectConditionCandidates` in `lib/assistant/clarify/compose.ts`, `evaluateApplicableProjectConditions`, `sortClarifyCandidates`.

**Smallest fix.** Stage 1. Keep a stable library order for project conditions. When a work area adds conditions, append the new ones and leave already presented conditions in place. Do not convert or clear existing constraint answers.

**Regression.** The script prints both queues and checks that they differ. Stage 1 should assert the stable order instead.

## P1 — Laminate is recognised and then not priced

**Reproduction.** Brief: “Flooring only. Office, 10 m2 laminate flooring. No removal and no new substrate.” One portion, label Office, finish `other`, specialist `laminate`, area 10. Physical and commercial completeness are `UNSUPPORTED_SPECIALIST`. One requirement, zero priced requirements, sell 0. Missing text: “Specialist flooring pricing is required.”

**Catalogue check.** `flooring.laminate.m2` is named in `lib/estimate/material-rate-keys.ts` and is absent from `SPECIFIC_MATERIAL_RATE_CATALOGUE`. `FITOUT_BENCHMARKS.laminateFlooringPerM2` exists at cost 110 and sell 165 and is not read by `commercializeFlooring`. The item is not absent from the old benchmark object. It is absent from the nested catalogue and recipe that actually run.

**Do not treat sell 0 as success or as “no scope”.** The portion and the unpriced requirement are both present.

## P1 — Carpet tiles become broadloom carpet

**Reproduction.** “Supply and install 18 m2 of carpet tiles in the meeting room. No removal.” Finish `carpet`, specialist null, area 18, label null. “Meeting room” is not a location token. Completeness is `INFORMATION_REQUIRED` because underlay, substrate, and framing are still open. Sell is 0. No `flooring.carpet_tile.m2` row exists. The carpet subcontract row is the broadloom supply-and-install key.

**Cause.** `parseFlooringFinishType` matches “carpet” before “tile”. Specialist phrases do not include carpet tiles.

## P1 — Multi-room flooring drops the second room

**Reproduction.** “Kitchen 12 m2 vinyl plank. Living 20 m2 carpet.” returns one portion: Kitchen, vinyl plank, 12 m2. The living-room carpet is gone. “Carpet the living room, 20 m2.” after a period does produce a second portion, because the splitter only starts a new snippet when the next sentence begins with install, lay, replace, supply and install, carpet, or tile. “Living” is also not a location; “living room” is.

## P1 — Internal partition length and door are not facts

**Reproduction.** “Build a new 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, one door.” yields one wall type, timber frame, height 2.4 m, `lengthLm` null, `hasOpenings` null. Height and frame are captured. Length and the door are not, so quantity rules that need length cannot run from this brief.

## P2 — Bathroom margin versus the stored sell pair

**Reproduction.** `BATHROOM_BENCHMARKS.tilingPerM2` is cost 180 and sell 280. `resolveRate` for `bathroom.tiling.m2`, with that cost and no fallback sell, returns sell authority `derived_from_gross_margin` and sell 225 at the default 20% margin. `225 = 180 / 0.8`. A 20% markup would be 216. Passing the stored sell 280 through `classifyResolvedSell` returns `legacy_paired_rate` and sell 280.

**What this is.** The mature bathroom call uses gross margin. The stored pair is a markup-style number and is not the live fallback. A company row that stores both cost and sell remains a paired sell and is not silently converted. No customer estimate was regenerated.

## P2 — No project-wide P&G line

`preliminary_allowance` appears only as `WARNING_CODES.PRELIMINARY_ALLOWANCE` in `lib/commercial-engine/contract/codes.ts`. Work-area allowances are not gathered into one preliminary. This is a coverage gap, not a double charge found in this pass.

## P1 — Door customer supply uses a different key from the question

The door template stores `doors.hardware_client_supplied`. The legacy calculator in `calculateDoors` reads `doors.client_supplied` and `doors.supply_scope`. Answering only the hardware question does not set `doors.client_supplied`. Nested door portions are a separate path and were not executed here.

**Smallest later fix.** Map the hardware answer onto the key the active calculator reads, or teach the calculator to read the hardware key. Do not drop either stored answer. This is not in Stage 1.

## P2 — Legacy flooring stairs label gross margin and charge a paired sell

On the legacy path only, stairs cost `count × 45` and sell `count × 68`, with `sellAuthority: "derived_from_gross_margin"`. At one stair that is cost 45 and sell 68. Gross margin at 20% would sell at 56.25. Nested `flooring.portions` do not use this branch. Stage 1 does not change it. A later recipe change needs an explicit version and must not rewrite saved lines.

## P2 — Legacy bathroom coordination is not project-wide P&G

When `bathroom.job_scope` is absent and the legacy coordination conditions match, the calculator adds “Project coordination and site allowance” at cost 800. Sell is `gmSell` of that cost, not the stored pair of 1,200. The mature path does not add it. It can sit beside labour hours that the project access factor has already increased. No second P&G work area exists.

## Explicitly not weakened

The finite-number rejection stays. Deck readiness stays blocked while real post-hole gaps remain. Specialist laminate is not given the unused 110/165 pair in this pass.
