# Pricing calibration structure

Quotr 2.0 prices derived material quantities through a deterministic rate resolver. This document describes how material rates are keyed, resolved, and displayed — and what remains editable in Final Pricing.

## Layer model

| Layer | Role |
|-------|------|
| 1 — Facts & specs | User inputs (area, board width, quality, etc.) |
| 2 — Derived quantities | Build-ups (lm, sheets, litres, m³) from calculators |
| 3 — Rates → values | **This sprint** — resolve rate, multiply quantity × rate |

Labour, GST, margin/markup, quote revision, and recalibration logic are unchanged.

## Pricing modes

1. **Benchmark fallback** — no company setup; uses national/default benchmarks.
2. **Company saved rates** — user sets labour, scope, category, or common material rates.
3. **Specific material rate** — per-unit rate for a material key (e.g. kwila decking $/lm).

The resolver always falls back gracefully; missing rates never crash calculators.

## Rate resolver priority

`resolveMaterialRate()` in `lib/estimate/resolve-material-rate.ts`:

1. **Company specific** — exact `item_key` + matching unit (`rate_type = material`)
2. **Company category** — `material.category.*` key or work-area material rate
3. **Company scope** — package/scope rate (`rate_type = scope`) when applicable
4. **Benchmark specific** — catalogue/default benchmark for the material key
5. **Benchmark category** — category benchmark when provided
6. **Missing / safe zero** — benchmark with warning when benchmarks disabled

### Build-up integration

`resolveBuildUpMaterialPricing()` in `lib/estimate/material-rate-pricing.ts`:

- Tries the **build-up unit** first (lm, each/sheet, l, m³).
- If no specific unit rate is available, uses the **fallback** (usually m² area rate) with the area quantity.
- Examples:
  - Deck: `total_lm × $/lm` when lm rate exists; else `area_m2 × $/m²`.
  - Plasterboard: `sheets × $/sheet`; else m² fallback.
  - Backfill: `volume_m3 × $/m³`.
  - Drainage: `novacoil_lm × $/lm`.
  - Paint: `litres × $/L`; else m² fallback.

Org rates are loaded once per estimate (`EstimateContext.rates`); the resolver does not query the database per line item.

## Material rate keys

Canonical keys live in `lib/estimate/material-rate-keys.ts`. UI catalogue entries are in `lib/rates/specific-material-catalogue.ts`.

### Decking

| Key | Unit | Notes |
|-----|------|-------|
| `deck.material.treated_pine.m2` | m² | Area fallback |
| `deck.material.hardwood.m2` | m² | |
| `deck.material.composite.m2` | m² | |
| `deck.material.treated_pine.lm` | lm | Build-up pricing |
| `deck.material.hardwood.lm` | lm | |
| `deck.material.kwila.lm` | lm | |
| `deck.material.composite.lm` | lm | |

Kwila m² aliases to hardwood m² key.

### Sheet materials

| Key | Unit |
|-----|------|
| `sheet.plasterboard.standard.each` | each |
| `sheet.plasterboard.fyreline.each` | each |
| `sheet.plasterboard.aqualine.each` | each |
| `sheet.plywood.each` | each |
| `ceiling.tile.m2` | m² |

### Retaining / drainage

| Key | Unit |
|-----|------|
| `retaining_wall.backfill.m3` | m³ |
| `retaining_wall.drainage.lm` | lm |

### Flooring

| Key | Unit |
|-----|------|
| `flooring.vinyl.m2` | m² |
| `flooring.carpet.m2` | m² |
| `flooring.hardwood.m2` | m² |
| `flooring.laminate.m2` | m² |
| `flooring.material.m2` | m² | Package fallback |

### Painting

| Key | Unit |
|-----|------|
| `paint.litre` | l |
| `painting.material.m2` | m² | Area fallback |

### Category keys (optional company defaults)

- `material.category.decking`
- `material.category.sheet`
- `material.category.retaining`
- `material.category.flooring`
- `material.category.painting`

## Fallback behaviour

- **Benchmarks allowed** (`allow_benchmark_rates !== false`): use benchmark cost/sell when no company rate matches.
- **Benchmarks disabled**: resolver returns zero with `missing` source; display warns user.
- **Sell rate**: if org rate has cost only, sell is derived from company default margin.
- **Unit matching**: lm, m²/m2, each/sheet, litre/l are normalized before comparison.

## Rate source display

Resolution metadata is stored in line item notes as `__quotr_meta__.materialRateResolution` (internal only).

Final Pricing shows compact secondary text, e.g.:

- `Company rate: kwila decking $/lm`
- `Benchmark fallback: hardwood decking $/m²`
- `Missing specific rate — using benchmark for …`

Quote output uses client-facing descriptions only; rate source and build-up are not shown to clients.

## What stays in Final Pricing override

Users can still override in Final Pricing:

- Quantity, unit, cost rate, sell rate per line
- Client description and visibility
- Manual line items

Overrides do not change the stored build-up or rate resolution metadata (audit trail of how the estimate was generated).

## Adding future materials

1. Add a constant to `MATERIAL_RATE_KEYS` (one key per unit you need).
2. Add benchmark defaults in `lib/estimate/benchmark-rates.ts` if needed.
3. Add a catalogue row in `lib/rates/specific-material-catalogue.ts` (Rates page).
4. Wire calculator build-up via `resolveBuildUpMaterialPricing()` with fallback unit if applicable.
5. Document the key in this file.

Avoid hundreds of keys; prefer category + benchmark until a build-up exists.

## Benchmark vs company rate

| Use benchmark when | Use company rate when |
|--------------------|------------------------|
| New org, quick quote | Repeat material on many jobs |
| Rare one-off material | Known supplier price |
| Calibration not yet done | User wants Mode 2/3 accuracy |

Company rates win whenever an active matching rate exists in the org `rates` table.

## Deferred (out of scope)

- Supplier APIs, SKU catalogues, inventory
- Admin calibration UI
- Per-line-item rate DB queries
- Analytics on rate accuracy
