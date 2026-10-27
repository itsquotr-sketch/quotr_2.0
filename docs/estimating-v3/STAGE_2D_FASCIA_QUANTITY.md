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

An unresolved fascia length blocks pricing of fascia and asks in Details. Carpet-tile recipes, preliminaries pricing, calibration, and flooring reanalysis checks 76–79 stay out. An unresolved door leaf remains a hard minimum. The replacement allowance remains additional to the new-pile takeoff.
