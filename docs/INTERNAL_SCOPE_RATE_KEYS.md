# Internal Scope Company Rate Keys

Foundation rate keys supported via `resolveRate` item-key aliases (`lib/estimate/rates.ts`).
Rates UI already exposes sheet/flooring/paint specific material rates; additional scope keys resolve when stored as organisation rates.

## Resolution priority

1. Exact company rate matching `item_key` + `rate_type`
2. Legacy alias key (see below)
3. Work-area generic rate (`work_area_type` + `rate_type`)
4. Benchmark fallback (when `allow_benchmark_rates` is enabled)

## Supported alias keys

| Suggested key | Resolves to | Used by |
|---------------|-------------|---------|
| `bathroom_waterproofing_m2` | `bathroom.waterproofing.m2` | Bathroom waterproofing allowance |
| `bathroom_tiling_m2` | `bathroom.tiling.m2` | Bathroom tiling |
| `bathroom_plumbing_allowance` | `bathroom.plumbing.allowance` | Bathroom plumbing |
| `bathroom_electrical_allowance` | `bathroom.electrical.allowance` | Bathroom electrical |
| `kitchen_install_lm` / `kitchen_install_each` | `kitchen.cabinetry.install` | Kitchen cabinetry install |
| `internal_wall_framing_lm` | `internal_walls.framing.lm` | Internal walls (future) |
| `plasterboard_standard_sheet` | `sheet.plasterboard.standard.each` | Sheet build-ups |
| `plasterboard_aqualine_sheet` | `sheet.plasterboard.aqualine.each` | Wet-area lining build-ups |
| `plasterboard_fyreline_sheet` | `sheet.plasterboard.fyreline.each` | Fire-rated lining |
| `ceiling_plasterboard_m2` | `ceilings.plasterboard.m2` | Ceilings (future) |
| `door_install_each` | `doors.install.each` | Doors (future) |
| `door_supply_solid_core_each` | `doors.solid_core.each` | Doors (future) |
| `flooring_vinyl_m2` | `flooring.vinyl.m2` | Flooring |
| `flooring_prep_m2` | `flooring.prep.m2` | Floor prep (future) |
| `painting_internal_m2` | `painting.material.m2` | Painting area materials |
| `painting_door_each` | `painting.door.each` | Door painting allowance |
| `painting_trim_lm` | `painting.trim.lm` | Trim painting allowance |
| `plastering_level4_m2` | `plastering.level4.m2` | Plastering (future) |
| `plastering_level5_m2` | `plastering.level5.m2` | Plastering (future) |

## Rates UI

Existing **Specific material rates** section (`components/rates/SpecificMaterialRatesSection.tsx`) covers sheet, flooring, and paint keys marked `calculatorSupport: used_now`.

Full scope-rate UI expansion deferred to **Rates Calibration Sprint**.
