# Stage 3.1C.3-R2D — Calibration Preview Test

**Environment:** Preview / local authenticated org with company basics complete  
**Prerequisite:** R2A–R2C behaviours still pass

## A — Setup hub

1. Open `/app/setup?mode=improve&section=calibrate`.
2. Expect copy: give Quotr a feel for how your business prices real jobs.
3. Expect Deck and Bathroom actions; **Show all**; **Do this later**.
4. If Work types prefer Deck only, Deck should appear first (Bathroom still available via Show all).

## B — Deck flow

1. Calibrate Deck → brief shows 5×3 m pine deck, exclusions.
2. Enter hours, materials, optional other/total, sell, confidence.
3. Compare once (not on every keystroke).
4. Expect Your vs Quotr cost/sell + observational narrative (not “wrong”).
5. Save → expect amber/gated message about migration 033; rates/projects unchanged.

## C — Bathroom flow

1. Calibrate Bathroom → ~8 m² reno brief.
2. Enter labour hours, plumbing/electrical allowance, materials, sell, confidence.
3. Compare + gated save as above.

## D — Authority checks

1. Open `/app/rates` — company rates unchanged after calibration attempt.
2. Open an existing project estimate — totals unchanged.
3. Confirm UI never labels calibration as “Your company rate”.

## E — Dashboard tip

1. Dashboard Improve card shows “Calibrate your first work type” with ~3 min reason when basics ready.
2. Link opens Calibrate section.
3. Tip is dismissible / optional — not a hard gate.

## F — Persistence gate (negative)

1. Confirm no `supabase/migrations/033_*` until owner approval.
2. Save always explains gate without writing commercial tables for evidence.

## Pass criteria

- Optional UX only  
- Deterministic comparison runs  
- No rate/project mutation  
- Persistence clearly gated  
- No AI / DNA / Scope Discovery enablement
