# Estimating V3 Stage 1 — acceptance status

Recorded 26 October 2026. Production was not deployed. Play Console was not changed.

## Browser

No authorised Preview session was available. The Cursor browser was on the sign-in page for this Preview. The visible desktop browser had no Quotr application session. Passwords and deployment permissions were not changed.

Sign in at:

https://quotr-2-0-git-estimating-v3-stage-1-quotr1.vercel.app/login

Use the existing owner account. Create new test projects only.

1. New project. Paste: “Supply and install decking on a rectangular platform measuring 4,800mm × 3,600mm. The finished deck is 450mm above ground. Use 90mm-wide decking boards with a 5mm gap. Include the substructure, fixings and 10% waste on decking boards. Exclude stairs, balustrades, demolition and painting. Ask for any missing specifications that materially affect the estimate.”
2. Confirm the deck is recognised and stairs, balustrades, demolition, and painting are not added as work areas.
3. Note project-condition order. Answer site access, reload, and confirm the remaining conditions stay in the same order.
4. Enter a post count, leave the project, reload, and confirm the posts question stays answered.
5. Enter a different hole count and confirm a reason is required before generation.
6. Answer ground, method, spoil, and hole size. With concrete included, the remaining prompt must name concrete, not unfinished excavation. Complete those fields and confirm they leave the queue and can still be edited.
7. Hole depth is a number field. The “(mm)” text is only the label. Type `600` and save. The control does not submit `600 mm`.
8. Include fascia and confirm the length question appears beside it.
9. Generate the estimate. Treat a missing rate as a price gap, not a completion failure.
10. New flooring project. Choose hardwood and `145 mm`, or tile and `600 mm`. Reload and confirm the width remains selected. Add a second area with a different width and confirm the first area is unchanged.
11. Repeat the width and post-count checks in a narrow viewport.

The width control offers only valid millimetre choices. It has no invalid option to click. Rejection of `wide` and `0` is covered by `scripts/verify-estimating-v3-stage1.ts` at the write boundary.

## Hole depth

`NumberField` uses `type="number"`. The unit is label text. Save sends the field’s numeric string to `Number()`. `600` is inside 50–3000 mm and is accepted. `600 mm` remains `Invalid fact update.` on `deck.hole_depth_mm` because that string is not the control’s input. Parsing was not broadened.

## Build

`scripts/next-build-safe.mjs` does more than start Next. It reads `.env.local` only, refuses the Production Supabase ref `lxvnylhsbvudzzupxeqr`, removes `VERCEL_ENV`, and then runs `next build`.

`npm run build:safe` completed on `release/website-estimating-stage-1` after replacing the `node_modules` junction with a real directory. Turbopack compiled, TypeScript finished, and 50 static pages were generated. The script reached `next build`, so the Production-database refusal had already passed.

## Release branches

These are local only. They were not pushed.

| Host | Branch | Tip | Parent |
| --- | --- | --- | --- |
| Website | `release/website-estimating-stage-1` | `bc0a7667` | `40d98384` |
| Android | `release/android-estimating-stage-1` | `ff39ba31` | `879db760` |

Each tip is the cherry-pick of `74444833`, `978081c2`, and `d4b6286e`, in that order. The file diff against each parent is the same 20 paths as `40d98384..d4b6286e`. Android account deletion, purchase restrictions, signup, and asset links were not changed.

## Still serving

| Host | Deployment | SHA | Branch |
| --- | --- | --- | --- |
| `app.get-quotr.com` | `dpl_5yVsMkfnbC5LSWW1K1ZB4NWPwGQj` | `40d98384` | `feat/email-preferences-loops` |
| `play.get-quotr.com` | `dpl_9QwLfefNfSiGwyWRP4hC6uhka24o` | `879db760` | `release/android-play` |

Rollback remains those two deployments. Older Ready deployments remain website `b75291bf` and Android `11d413fd`.

## Checks retained

Stage 0 fixture: 28 passed. Stage 1 fixture: 18 passed. Details, deck hole, deck journey, flooring extraction, and flooring substrate checks passed. `verify-deck-contract-r1.ts` and `verify-deck-contract-r1a.ts` still stop on the pre-existing `server-only` import. That failure also happens on the Stage 0 tree.

Laminate, carpet tiles, multi-room splitting, partition length, door customer-supply keys, rate-resolver differences, bathroom and flooring overlap, deck calibration, and preliminaries stay outside this release.
