# Cost-first Rates — Owner Preview

**Status:** Owner Preview Pending  
**Prereq:** Cost-first Rates Complete Local on `hardening/stage-2a-security`  
Do **not** mark Owner PASS yourself. Do **not** start MaterialRequirement.

---

## A. Company margin

1. Open **Rates → Defaults**.
2. Confirm label **Company gross margin %**.
3. Note current value (often 20).

## B. New labour rate (cost-first)

1. **Rates → Core labour** → Add / Edit carpenter.
2. Enter **Your cost** e.g. `$60`.
3. Confirm **Recommended charge-out** shows `$75.00` at 20% GM immediately (no save required for preview).
4. Save without custom charge-out.
5. Table shows Cost `$60` and Charge-out recommended `$75`.

## C. Legacy / custom retention

1. Open a rate that already has both cost and sell (e.g. historical `$60` / `$90`).
2. Confirm retained charge-out is shown and **not** silently changed to `$75`.
3. Confirm recommended `$75` is visible if different.
4. Tap **Use recommended rate** → save → sell clears; charge-out follows margin.

## D. Custom charge-out

1. Open Advanced / Custom charge-out.
2. Enter a custom value; save.
3. Confirm table marks custom; regenerate estimate before expecting commercial change.

## E. Materials

1. Work types or All materials — enter a cost; confirm recommended charge-out.
2. Adopt benchmark uses **cost only** (charge-out from company GM).

## F. Mobile (~390px)

1. Rate cards readable; no horizontal overflow.
2. Cost and charge-out visible; Edit usable.

## G. Regression

1. Generate Quick Estimate — commercial figures still coherent.
2. Changing project margin still rewrites from **cost** (COMMERCIAL-P0).
3. No Production Scope Discovery / DNA / MaterialRequirement work.

## Pass criteria

Checklist items PASS (or noted) before treating Rates as Owner Preview Validated.
