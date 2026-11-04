# Area-heading candidate handoff

Display formatting only. The calculated net area stays the full product.

## Identity

- Baseline SHA: `475acf23b4cccf9fdea3264ff3de0905f5cf6969`
- Product commit: `3308d8067c5f526ee127b5c47c09d329d201bab1`
- Candidate under test: the tip of `estimating/v3-area-headings`. The only commit after the product commit is this handoff line.
- Checkout: `C:\Users\Admin\Desktop\quotr-v3-area-headings`
- Preview URL: none. This candidate is not published.
- Declared live model calls: 0

## Frozen acceptance

1. Bedroom 1, 3.6 m × 3.2 m, shows `11.52 m²`. Bedroom 2, 4.2 m × 3.5 m, shows `14.7 m²`. The hallway, 8 m × 1.2 m, shows `9.6 m²`.
2. The stored net area stays `3.6 × 3.2` and `4.2 × 3.5`. Purchasing quantities are unchanged.
3. No schema, rate, credential, or Production change.

## Focused check

`npx tsx scripts/verify-estimating-v3-stage-2e.ts`

Implementation run passed, including `room area headings format the binary product and keep the calculated area`. QA repeats that command. Do not edit application code from the QA checkout.
