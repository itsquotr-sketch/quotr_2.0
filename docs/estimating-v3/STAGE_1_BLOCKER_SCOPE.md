# Estimating V3 Stage 1 — blocker scope

Stage 1 is only the four blockers below. It does not price laminate, add carpet tiles, fix multi-room splitting, or add preliminaries. Those stay in the later stages of `STAGE_0_IMPLEMENTATION_PLAN.md`.

Parent for the work: `estimating/v3-stage-0` at `40d98384`, or a later production SHA if the hosts have moved before Stage 1 starts. Re-check the serving SHAs before editing. Do not deploy Production. Do not change Play Console. Do not migrate. Do not regenerate customer estimates.

## 1. Flooring board width, and the same tile-size path

**Change.** When Details offers a millimetre option for `flooring.portion.hardwood_board_width_mm`, `flooring.portion.tile_width_mm`, or `flooring.portion.tile_length_mm`, the value written to the portion is a finite number of millimetres. `145 mm` becomes `145`. A typed `145` stays `145`.

**Keep.** `commitUserFactEdit` still rejects a non-finite number. A value that does not contain a positive millimetre stays unanswered and shows the existing invalid-update error. Do not skip validation because the control was a select.

**Do not.** Add new widths, change hardwood takeoff, or apply this parser to unrelated text fields.

**Regression.** Invert the two non-finite checks in `scripts/verify-estimating-v3-stage0.ts`. Keep the typed-`145` check.

## 2. Deck post count

**Change.** The control focused by gap id `posts` writes `deck.pile_or_post_count`. After that value is a positive finite count, the `posts` gap is clear. `deck.hole_count` remains the override. A hole count that differs from the post count still requires `deck.hole_count_reason`.

**Keep.** The calculator rule that a stated post count is distinct from a hole-count override. Do not copy hole count into post count inside readiness. Do not show the generic replacement question for a new deck.

**Regression.** The current “hole count leaves `posts`” check becomes “the post-count write clears `posts`”. The complete ordinary-hole check stays green.

## 3. Excavation remainder

**Change.** `deckDetailGaps`, the Post holes unfinished count, and “Finish N Post holes answers” separate excavation from concrete. Ground, method, spoil, and hole size are the excavation set. Fill, post size, and embedment stay required when concrete is included, under a concrete label.

**Keep.** Concrete questions still block generate. Ordinary excavation with concrete off still has zero gaps. Do not mark an unanswered concrete question as assumed.

**Regression.** The fixture that includes concrete still expects `fill`, `post`, and `embedment`. It must not describe that set as unfinished excavation, and the excavation ids stay absent.

## 4. Project-condition order

**Change.** Project-condition candidates use the consumed-library order. Adding a bathroom may add `floor_level`, `occupied_site`, and `working_hours`. It does not move `site_access` or `material_carry_distance` ahead of or behind each other once they are already in the list. Existing constraint values are not rewritten.

**Keep.** Applicability still decides whether a condition is asked. Required versus assumable still decides whether it blocks or can be assumed. Only the sort key changes.

**Regression.** Replace the “queues differ” check with an order assertion: the deck-only keys are a prefix of the deck-plus-bathroom keys, in the same order.

## Files expected to change

- `components/assistant/clarify/ClarifyAnswerControl.tsx` and/or `lib/scopes/fact-values.ts` for the millimetre option
- `components/assistant/job-plan/DeckPostHolesSection.tsx` and `lib/estimate/deck-detail-completeness.ts` for post count and excavation labels
- `lib/assistant/clarify/rank.ts` or the project-condition candidate builder for order
- `scripts/verify-estimating-v3-stage0.ts` for the inverted assertions

No new tables. No change to `classifyResolvedSell`. No change to quote snapshots. No change to company rate rows.
