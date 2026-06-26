# Calibration Batch 3 Readiness — Demolition & External Stairs

Prepared during Internal Calibration Batch 2.1 (internal scope hardening).

## Current catalogue status

| Scope | `estimateSupport` | Calculator file | Notes |
|-------|-------------------|-----------------|-------|
| `demolition` | `rough_allowance` | `lib/estimate/calculators/demolition.ts` | Standalone strip-out only; embedded demo handled on parent scopes |
| `external_stairs` | `rough_allowance` | `lib/estimate/calculators/external-stairs.ts` | Riser-based when facts exist; rough allowance fallback |

## Demolition — current handling

- **Embedded demolition** (bathroom/kitchen/fence/deck): parent scope facts (`*.demolition_required`, `*.demolition_included`, etc.) drive line items; separate `demolition` work area suppressed via `filterEmbeddedDemolitionWorkAreas`.
- **Standalone demolition calculator** uses:
  - `demolition.area_m2` (defaults to 25 m²)
  - `demolition.scope_items` (multi-select array — scales labour quantity)
  - `demolition.disposal_included` / legacy `demolition.waste_removal_required`
  - Optional: `demolition.hazardous_materials_suspected`, `demolition.services_isolation_required`, `demolition.access`
- **Line items**: demolition labour (m²), waste removal allowance, minimum allowance.
- **Rate keys**: `demolition.waste.m2`, legacy alias `scope.demolition.m2`.

### Gaps for Batch 3 promotion

- [ ] Live AI extraction verify script (like internal/outdoor)
- [ ] Per-item demolition rates (walls vs flooring vs fixtures) instead of area-only scaling
- [ ] Hazardous materials conditional allowances wired to facts
- [ ] Company rate keys: `demolition_labour_m2`, `demolition_disposal_m2`, `demolition_minimum_each`
- [ ] Quote description draft for standalone demolition work area
- [ ] Promote catalogue entry to `calculator` after verification passes

## External stairs — current handling

- **Facts used**: `external_stairs.risers_count`, `external_stairs.landings_count`, `external_stairs.material`, `external_stairs.handrail_included`, optional `external_stairs.width_m`
- **Line items when risers known**: stair labour (hours/riser), materials per riser, landing allowance, handrail labour + allowance
- **Fallback**: rough allowance when riser count missing
- **Aliases**: `external_stairs.riser_count` → `external_stairs.risers_count`

### Gaps for Batch 3 promotion

- [ ] Live AI extraction verify script
- [ ] Width/tread depth facts for material build-ups
- [ ] Stringer count / landing area derivation
- [ ] Company rate keys: `external_stairs_labour_per_riser`, `external_stairs_material_per_riser`, `external_stairs_handrail_each`
- [ ] Quote description enrichment (currently generic)
- [ ] Promote catalogue entry to `calculator` after verification passes

## Required fact keys (reference)

See scope templates:

- `lib/scopes/templates/demolition.ts`
- `lib/scopes/templates/external-stairs.ts`

## Do not break

- Existing rough allowance behaviour when facts are sparse
- Embedded demolition deduplication rules in `lib/scopes/demolition-rules.ts`
