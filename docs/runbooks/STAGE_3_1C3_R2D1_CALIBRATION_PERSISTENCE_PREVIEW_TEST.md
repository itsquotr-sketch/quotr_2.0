# Stage 3.1C.3-R2D.1 — Calibration Persistence Preview Test

**Prerequisite:** Local/Preview has migration **033** applied; company basics complete.

## A — Save

1. Improve Quotr → Calibrate → Deck.
2. Enter hours/materials/sell/confidence → Compare → Save calibration.
3. Expect **Calibration saved** (not persistence gate).
4. Rates page unchanged; open a project estimate — totals unchanged.

## B — Hub status

1. Return to Calibrate section.
2. Deck shows **Calibrated** with date/confidence.
3. Bathroom shows **Not calibrated** (unless also saved).

## C — Recalibrate

1. View / Recalibrate Deck → Recalibrate → change sell → Compare → Save.
2. Latest summary updates; prior evidence retained in DB (active uniqueness).

## D — Dashboard tip

1. After first save, Improve card no longer shows “Calibrate your first work type”.
2. Calibrate section still available optionally.

## E — Authority

1. No “apply these rates” CTA.
2. UI continues to say evidence / not automatic rate changes.

## Pass criteria

Save works · status works · recalibrate appends · no rate/project mutation · no DNA.
