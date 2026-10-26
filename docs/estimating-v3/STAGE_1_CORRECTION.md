# Estimating V3 Stage 1 — correction

Stage 1 changes only the four completion blockers. It is the corrected baseline for later V3 work. It does not implement door-supply mapping, cladding templates, scope-instance identity, the material-rate resolver, legacy flooring fallback, stair pricing, bathroom/flooring overlap, deck calibration, or preliminaries.

Parent application commit: `40d98384cff9a6fb020c92316b54095e5e1ff873` on `feat/email-preferences-loops`, which was still the website Production deployment when this branch was cut. Android Production remained `879db760` on `release/android-play`. The estimating diff between those two commits is empty, so this branch does not merge the Android-only commits.

## What changed

1. **Board and tile millimetres.** `145 mm`, `145mm`, `145`, and `145` all store `145` for the three flooring millimetre keys. The conversion happens in `normalizeAnswerForStorage` when the fact key is one of those keys. `commitUserFactEdit` still rejects a non-finite number. An invalid value returns a field message and is not written, so a saved width and the other flooring area stay as they were. The same label on `deck.hole_depth_mm` is still `Invalid fact update.`

2. **Post count.** The control opened by the posts gap writes `deck.pile_or_post_count` until a post count exists. After that, the same control writes `deck.hole_count` as the override and still asks for a reason when the counts differ. A stored hole count is not copied into the post count. Zero is rejected.

3. **Excavation and concrete.** Hole size, ground, method, and spoil are the excavation set. Fill, post size, and embedment stay required when concrete is included, and the queue says `Finish 3 concrete answers` rather than unfinished excavation. Answered questions leave that queue. The fields stay on the card for review. Excavation hours, concrete quantities, and deck productivity were not changed.

4. **Project conditions.** Unresolved project conditions sort by the project-condition library and stay ahead of work-area questions. Adding a bathroom can add conditions. It does not reorder `site_access` and `material_carry_distance`. Saving site access removes that question and leaves carry distance next. A fascia-length follow-up still appears only after fascia is included, and it stays beside that question.

## Left unchanged

Saved estimates, quote snapshots, rate precedence, labour units, markup, gross margin, work-area recognition, permissions, billing, signup, and Android restrictions. No migration.

The Stage 0 coverage fixture still records laminate, carpet tiles, multi-room splitting, partition length, the bathroom margin pair, and the later contract gaps as open.
