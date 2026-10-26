# Estimating V3 Stage 0 — acceptance fixtures

The runnable fixture is `scripts/verify-estimating-v3-stage0.ts`.

```text
npx tsx scripts/verify-estimating-v3-stage0.ts
```

It uses production functions and in-memory facts. It does not call a model, the network, or a database. On `40d98384` it passed 20 checks. Several checks lock a defect on purpose. Stage 1 changes those checks only when the corresponding fix changes the result.

The eight prompts referred to in the Stage 0 request were not in the request. They were not invented. The briefs below are the six topics the request named, plus the four blockers.

## Blockers

| Fixture | Current result on this branch | Desired result, not implemented |
| --- | --- | --- |
| Hardwood board width option `145 mm` | Stored with `Number("145 mm")`, which is not finite, so the save returns `Invalid fact update.` | Store `145` as a finite millimetre. Reject a non-numeric value. |
| Tile width option `600 mm` | Same non-finite path | Store `600`. |
| Typed board width `145` | Stays `145` | Unchanged |
| `deck.hole_count = 16` and no post count | Gap `posts` remains. Focus target is the hole-count field. | The post-count field writes `deck.pile_or_post_count` and the gap clears. A different hole count still needs a reason. |
| Ordinary holes, post count, concrete off | No deck detail gaps | Unchanged |
| Same set with concrete included | Gaps `fill`, `post`, `embedment` only | Those three remain required. They are not described as unfinished excavation. |
| Deck only, then deck plus bathroom | Project-condition queue grows and is ordered by ask class | Already shown conditions keep their order. New conditions are added without reshuffling answered ones. |

## Coverage briefs

| Brief | Actual recognition | Questions still open | Money |
| --- | --- | --- | --- |
| Office, 10 m2 laminate, no removal, no new substrate | One portion. Finish `other`. Specialist `laminate`. Area 10. Label Office. | Specialist pricing message | Completeness `UNSUPPORTED_SPECIALIST`. One unpriced requirement. Sell 0. Legacy benchmark 110/165 is not applied. |
| 18 m2 carpet tiles in the meeting room, no removal | Finish `carpet`. No specialist. Area 18. Label null. | Underlay, new substrate, new framing | `INFORMATION_REQUIRED`. Sell 0. No carpet-tile catalogue row. |
| Kitchen 12 m2 vinyl plank. Living 20 m2 carpet. | One portion. Kitchen, vinyl plank, 12. Living carpet omitted. | Floor preparation, substrate, framing for the kitchen only | `INFORMATION_REQUIRED`. Sell 0. The omitted room is not a zero-price room. It is absent. |
| Kitchen 12 m2 vinyl plank. Carpet the living room, 20 m2. | Two portions. Kitchen vinyl 12 and Living room carpet 20. | The ordinary finish questions for each portion | Not a priced success. Two portions exist. Sell was not asserted. |
| New 4.2 m internal partition, 2.4 m high, timber frame, plasterboard both sides, one door | One wall type. Timber. Height 2.4. Length null. Openings null. | Length and openings were not extracted, so they cannot already be answered | No quantity was calculated. |

A non-zero sell is not used anywhere above as proof of coverage. Laminate and carpet tiles have sell 0 and are still recognised.

## Live model

No live recognition check was run. The deterministic parsers can disagree with a future model response. Keep any model fixture in a separate script that is allowed to call the provider, and do not mix it into this file.

## Stage 1 regression bar

After the blocker fixes, the same script must show:

- `145 mm` and `600 mm` persist as finite millimetres, and a word such as “wide” does not.
- A post-count entry clears `posts` without writing a conflicting hole count.
- A finished ordinary excavation set does not increment the excavation remainder when only concrete questions remain.
- Project-condition order for an unchanged constraint set does not change because a bathroom work area was added.

Existing saved numeric answers, hole counts, post counts, and constraint values are not rewritten by the fixture or by the fix.
