# Pile/post replacement allowance — unexplained additional cost

This is an investigation record. The flooring slice does not remove or reinterpret the charge.

## What is charged

When `deck.pile_or_post_replacement_required` is true and a count is present, the deck calculator adds a line labelled "Pile/post replacement allowance". The rate key is `deck.post_replacement.each`. The Quotr benchmark is $180 cost and $280 sell per pile. The line category is `allowance`. The note is the count, for example "4 piles/posts". The line has no `deck.supports` component.

When replacement is true and no count is present, the same label is used for the flat `substructureReplacementAllowance` of $1,200 cost. The note is "Count subject to confirmation".

## What the other lines already cover

- New support material is "Piles / posts", component `deck.supports`, House pile 125×125 H5, from the structural takeoff.
- "Pile/post installation" is labour only, component `deck.posts.install`. Its note says hole excavation and concrete are separate, and the time is not inside substructure framing.
- Hole excavation is labour in bank cubic metres. It is not deck demolition.
- Concrete for the holes is a separate placement line.
- "Existing deck removal" is labour on deck area, and only when demolition is included. Its note says the driver is deck area and that this is deck demolition, not post-hole soil. It does not pull piles.

## Why the allowance is not a distinct scope

`pileReplacementApplicable` returns false when new substructure is included, because the new layout already owns the new piles. `pileRetentionPending` is true when the substructure condition is still pending inspection. The calculator then keeps the replacement boolean even though the applicable check is false. Pending inspection, explicit replacement, and new substructure therefore emit both the new-pile takeoff and the allowance on the same stated count.

The allowance notes do not name a physical task that the material, installation, excavation, concrete, or removal lines exclude. A separate component identity is not evidence that the dollars buy different work.

## Status

Unexplained additional cost. Left in place. No speculative removal in the flooring slice.
