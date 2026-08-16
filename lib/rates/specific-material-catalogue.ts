import {
  DECK_BENCHMARKS,
  FITOUT_BENCHMARKS,
  RETAINING_WALL_BENCHMARKS,
} from "@/lib/estimate/benchmark-rates";
import type { RateCatalogueEntry } from "@/lib/rates/types";

function entry(
  partial: Omit<RateCatalogueEntry, "recommended"> & {
    recommended?: boolean;
  }
): RateCatalogueEntry {
  return { recommended: false, ...partial };
}

/** Specific material rates used with quantity build-ups (Sprint 3). */
export const DECKING_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "deck.material.treated_pine.lm",
    label: "Treated pine decking boards",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Decking",
    unit: "lm",
    description:
      "Cost per linear metre of board ($/lm). Preferred rate when board quantity is calculated.",
    defaultCostRate: DECK_BENCHMARKS.treatedPineLm.cost,
    defaultSellRate: DECK_BENCHMARKS.treatedPineLm.sell,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "deck.material.hardwood.lm",
    label: "Hardwood decking boards",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Decking",
    unit: "lm",
    defaultCostRate: DECK_BENCHMARKS.hardwoodLm.cost,
    defaultSellRate: DECK_BENCHMARKS.hardwoodLm.sell,
    recommended: true,
    calculatorSupport: "used_now",
    description:
      "Cost per linear metre of board ($/lm). Preferred rate when board quantity is calculated.",
  }),
  entry({
    item_key: "deck.material.kwila.lm",
    label: "Kwila decking boards",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Decking",
    unit: "lm",
    defaultCostRate: DECK_BENCHMARKS.kwilaLm.cost,
    defaultSellRate: DECK_BENCHMARKS.kwilaLm.sell,
    recommended: true,
    calculatorSupport: "used_now",
    description:
      "Cost per linear metre of board ($/lm). Preferred rate when board quantity is calculated.",
  }),
  entry({
    item_key: "deck.material.composite.lm",
    label: "Composite decking boards",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Decking",
    unit: "lm",
    defaultCostRate: DECK_BENCHMARKS.compositeLm.cost,
    defaultSellRate: DECK_BENCHMARKS.compositeLm.sell,
    calculatorSupport: "used_now",
    description:
      "Cost per linear metre of board ($/lm). Preferred rate when board quantity is calculated.",
  }),
];

export const SHEET_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "sheet.plasterboard.standard.each",
    label: "Plasterboard sheet (standard)",
    rate_type: "material",
    category: "material",
    work_area_type: "internal_walls",
    workAreaLabel: "Sheet materials",
    unit: "each",
    description: "Per sheet (2.4 × 1.2 m) when sheet count build-up is calculated.",
    defaultCostRate: FITOUT_BENCHMARKS.plasterboardSheet.cost,
    defaultSellRate: FITOUT_BENCHMARKS.plasterboardSheet.sell,
    recommended: true,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "sheet.plasterboard.fyreline.each",
    label: "Fyreline plasterboard sheet",
    rate_type: "material",
    category: "material",
    work_area_type: "internal_walls",
    workAreaLabel: "Sheet materials",
    unit: "each",
    defaultCostRate: FITOUT_BENCHMARKS.fyrelineSheet.cost,
    defaultSellRate: FITOUT_BENCHMARKS.fyrelineSheet.sell,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "sheet.plasterboard.aqualine.each",
    label: "Aqualine plasterboard sheet",
    rate_type: "material",
    category: "material",
    work_area_type: "internal_walls",
    workAreaLabel: "Sheet materials",
    unit: "each",
    defaultCostRate: FITOUT_BENCHMARKS.aqualineSheet.cost,
    defaultSellRate: FITOUT_BENCHMARKS.aqualineSheet.sell,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "sheet.plasterboard.braceline.each",
    label: "Braceline plasterboard sheet",
    rate_type: "material",
    category: "material",
    work_area_type: "internal_walls",
    workAreaLabel: "Sheet materials",
    unit: "each",
    defaultCostRate: FITOUT_BENCHMARKS.bracelineSheet.cost,
    defaultSellRate: FITOUT_BENCHMARKS.bracelineSheet.sell,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "sheet.plywood.each",
    label: "Plywood sheet",
    rate_type: "material",
    category: "material",
    work_area_type: "internal_walls",
    workAreaLabel: "Sheet materials",
    unit: "each",
    defaultCostRate: FITOUT_BENCHMARKS.plywoodSheet.cost,
    defaultSellRate: FITOUT_BENCHMARKS.plywoodSheet.sell,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "ceiling.tile.m2",
    label: "Ceiling tile",
    rate_type: "material",
    category: "material",
    work_area_type: "ceilings",
    workAreaLabel: "Sheet materials",
    unit: "m2",
    defaultCostRate: FITOUT_BENCHMARKS.ceilingTilePerM2.cost,
    defaultSellRate: FITOUT_BENCHMARKS.ceilingTilePerM2.sell,
    calculatorSupport: "planned",
  }),
];

export const RETAINING_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "retaining_wall.backfill.m3",
    label: "Backfill material",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining / drainage",
    unit: "m3",
    description: "Per cubic metre when backfill volume build-up is calculated.",
    defaultCostRate: RETAINING_WALL_BENCHMARKS.backfillPerM3.cost,
    defaultSellRate: RETAINING_WALL_BENCHMARKS.backfillPerM3.sell,
    recommended: true,
    calculatorSupport: "planned",
  }),
];

export const FLOORING_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "flooring.material.m2",
    label: "Flooring materials (general)",
    rate_type: "material",
    category: "material",
    work_area_type: "flooring",
    workAreaLabel: "Flooring",
    unit: "m2",
    defaultCostRate: FITOUT_BENCHMARKS.flooringPerM2.cost,
    defaultSellRate: FITOUT_BENCHMARKS.flooringPerM2.sell,
    recommended: true,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "flooring.vinyl.m2",
    label: "Vinyl flooring",
    rate_type: "material",
    category: "material",
    work_area_type: "flooring",
    workAreaLabel: "Flooring",
    unit: "m2",
    defaultCostRate: FITOUT_BENCHMARKS.vinylPerM2.cost,
    defaultSellRate: FITOUT_BENCHMARKS.vinylPerM2.sell,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "flooring.carpet.m2",
    label: "Carpet",
    rate_type: "material",
    category: "material",
    work_area_type: "flooring",
    workAreaLabel: "Flooring",
    unit: "m2",
    defaultCostRate: FITOUT_BENCHMARKS.carpetPerM2.cost,
    defaultSellRate: FITOUT_BENCHMARKS.carpetPerM2.sell,
    calculatorSupport: "planned",
  }),
];

export const PAINTING_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "paint.litre",
    label: "Paint",
    rate_type: "material",
    category: "material",
    work_area_type: "painting",
    workAreaLabel: "Painting",
    unit: "l",
    description: "Per litre when paint quantity build-up is calculated. Not currently priced — paint is still an m² package.",
    defaultCostRate: FITOUT_BENCHMARKS.paintPerLitre.cost,
    defaultSellRate: FITOUT_BENCHMARKS.paintPerLitre.sell,
    recommended: true,
    calculatorSupport: "planned",
  }),
  entry({
    item_key: "painting.material.m2",
    label: "Paint materials (per m²)",
    rate_type: "material",
    category: "material",
    work_area_type: "painting",
    workAreaLabel: "Painting",
    unit: "m2",
    defaultCostRate: FITOUT_BENCHMARKS.paintingPerM2.cost,
    defaultSellRate: FITOUT_BENCHMARKS.paintingPerM2.sell,
    calculatorSupport: "used_now",
  }),
];

export const SPECIFIC_MATERIAL_RATE_CATALOGUE: RateCatalogueEntry[] = [
  ...DECKING_SPECIFIC_MATERIAL_CATALOGUE,
  ...SHEET_SPECIFIC_MATERIAL_CATALOGUE,
  ...RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  ...FLOORING_SPECIFIC_MATERIAL_CATALOGUE,
  ...PAINTING_SPECIFIC_MATERIAL_CATALOGUE,
];

export const SPECIFIC_MATERIAL_RATE_GROUPS = [
  {
    title: "Decking",
    description:
      "Preferred: cost per linear metre of board ($/lm). Work types still lists per-m² deck-area fallbacks for the same boards — those are not $/lm and not a whole-deck package.",
    entries: DECKING_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Sheet materials",
    description:
      "Planned per-sheet rates. Current lining estimates still use m² packages; sheet counts are takeoff only.",
    entries: SHEET_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Retaining / drainage",
    description:
      "Planned m³ backfill rate. Current backfill is still a face-m² package; volume is takeoff only.",
    entries: RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Flooring",
    description:
      "Planned flooring material rates. Current flooring still uses a hardcoded m² package.",
    entries: FLOORING_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Painting",
    description:
      "Per m² paint package is used now. Per-litre takeoff is display-only until paint litres are priced.",
    entries: PAINTING_SPECIFIC_MATERIAL_CATALOGUE,
  },
] as const;
