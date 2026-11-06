# Stage 2D — deck fascia quantity and pile-line ownership

Parent is `estimating/v3` at `908af0bdc8f33d837f6c2141eab96e05371878a5`. Production is not deployed. Recipes and calibration are unchanged.

## Fascia length

Including fascia no longer prices the full perimeter. A stated length, including a partial edge, is used as given. When length and width are both known, Details can choose "Use the full rectangular perimeter" and that choice is stored and reviewable. Without both dimensions, that choice is not offered and the length has to be stated. Until one of those answers exists, fascia materials and labour are omitted and the estimate says they are not priced. Excluding fascia still generates neither.

## Pile lines

On the elevated replacement deck, with replacement assumed and a stated count of 4, the estimate keeps these lines separate:

- `Piles / posts` is the new support material (`deck.supports`, House pile 125×125 H5). The quantity is the support takeoff.
- `Pile/post installation` is labour to set those new supports. The note says installation only. Hole excavation and concrete are not in this line, and the hours are not inside substructure framing.
- `Hole excavation` is labour to dig the holes. It is not deck demolition and not the spoil line.
- `Existing deck removal` is demolition labour on the deck area. The note says it is deck demolition, not post-hole soil. It does not pull piles.
- `Pile/post replacement allowance` is a separate allowance lump. With a count it is the existing each rate, $180 × 4 = $720, notes "4 piles/posts". It has no support component key.

The allowance uses the same stated count as the new-pile takeoff, and its notes do not name a task the other lines exclude. It is extra money on that count, not a second copy of the material, the installation, the excavation, or the deck removal. It is left in place. Removing it because the name is similar would drop a charge the other lines do not state they cover.

Fixtures that already meant “price this fascia” now store either a stated length or “Use the full rectangular perimeter”. The geometry helper `deckExposedPerimeterM` is unchanged, so a stored length still wins there and an absent length can still describe a rectangle. The calculator no longer uses that absent-length path.

## Still open

An unresolved fascia length blocks pricing of fascia and asks in Details. Carpet-tile recipes, preliminaries pricing, calibration, and flooring reanalysis checks 76–79 stay out. An unresolved door leaf remains a hard minimum. The replacement allowance remains additional to the new-pile takeoff. The flat allowance with no count stays unresolved.

## Acceptance

Application commit `3a00dbab26dc15d27c5862156e919b9e278e4151` is the tree that passed `next build --webpack` after the Preview env guard (Next.js 16.2.9, host `shhpjsoldmqtkdbgrbtm`, exit 0). Ready Preview `dpl_2qG738P1HkRvZaCKLNEnZzQMhWUj` serves that SHA at `https://quotr-2-0-8o877n2y1-quotr1.vercel.app` and the branch alias `https://quotr-2-0-git-estimating-v3-stage-2d-quotr1.vercel.app`. Production remains `dpl_EyTQZ945ngFbFER1pHqNB9yqNvaZ` on `release/website-estimating-stage-1`.

Preview jobs, none sent:

- Included fascia with no length, project `6ac71b94`: after reload, Details still asks for fascia length in lm and offers the rectangular perimeter. The blank length says it does not price the full perimeter. Estimate stays "Need details". Pricing stays locked.
- Stated 6 m partial edge, project `e5b30c0e`, unsent draft `de55c4ba`: net 6.0 lm, purchased 6.6 lm at 10% waste, material rate $22.00/lm (benchmark). Labour is 6.0 lm × 0.1 h/lm = 0.6 h at $60.00/h benchmark, cost $36.00, sell $45.00. The same lines were on the page after reload, on desktop and a phone-width layout.
- Explicit perimeter, project `0befdf82`, unsent draft `e8271823`: net 16.8 lm, purchased 18.48 lm, labour 1.68 h. The assumption says the rectangular perimeter was chosen and that inclusion alone did not choose it.
- Irregular 18 m² deck, project `183bff61`: after reload, Details asks for fascia length and for length and width separately. It does not offer the rectangular perimeter.
- Fascia marked not included, project `6fa1e2eb`, unsent draft `36f3dd47`: 10 priced items, no fascia material and no fascia labour, after reload.

`scripts/verify-estimating-v3-stage-2d.ts` exited 0. It still fails the estimate when fascia is included and no length is chosen. Older fixtures that already meant "price this fascia" store a stated length or the perimeter choice. That did not replace the missing-length check.

Three nested failures match `908af0bd` exactly, and this diff does not touch their files:

- UX premium check 11 looks for the substring "fact key". `ClarifyPanel.tsx` has the comment "Fact keys whose save is still in flight." Result on both trees: 19 passed, 1 failed.
- Recovery 5B check 31 requires `AssistantShell.tsx` to include "Work Areas". The Estimate Basis heading is "Work areas". Result on both trees: 60 passed, 1 failed.
- Retaining-wall family check 55 spawns the performance verifier. That check requires `lib/assistant/actions.ts` to contain "ScopeDiscoveryReviewBlock auto-run". The file does not, and `confirmWorkAreas` does not await `runScopeDiscovery` (`awaitsDiscovery` is false). Result on both trees: 29 passed, 1 failed.

No corrective pile commit. The allowance stays because it is not a second copy of material, installation, excavation, or removal.
