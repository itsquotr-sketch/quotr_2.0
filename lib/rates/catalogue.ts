import {
  BATHROOM_BENCHMARKS,
  DECK_BENCHMARKS,
  DEMOLITION_BENCHMARKS,
  FENCE_BENCHMARKS,
  KITCHEN_BENCHMARKS,
  PERGOLA_BENCHMARKS,
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

export const LABOUR_RATE_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "labour.carpenter.hour",
    label: "Carpenter / builder",
    rate_type: "labour",
    category: "labour",
    trade: "carpenter",
    unit: "hour",
    description: "Primary trade rate used across most estimates.",
    defaultCostRate: 60,
    defaultSellRate: 90,
    recommended: true,
    calculatorSupport: "used_now",
    section: "labour",
  }),
  entry({
    item_key: "labour.labourer.hour",
    label: "Labourer",
    rate_type: "labour",
    category: "labour",
    trade: "labourer",
    unit: "hour",
    description: "General labour and helper work.",
    defaultCostRate: 40,
    defaultSellRate: 65,
    recommended: true,
    calculatorSupport: "used_now",
    section: "labour",
  }),
  entry({
    item_key: "labour.general.hour",
    label: "General labour fallback",
    rate_type: "labour",
    category: "labour",
    trade: "general",
    unit: "hour",
    description: "Used when a specific trade rate is not set.",
    defaultCostRate: 55,
    defaultSellRate: 85,
    recommended: true,
    calculatorSupport: "used_now",
    section: "labour",
  }),
  entry({
    item_key: "labour.apprentice.hour",
    label: "Apprentice / helper",
    rate_type: "labour",
    category: "labour",
    trade: "apprentice",
    unit: "hour",
    description: "Optional lower-rate labour tier.",
    calculatorSupport: "planned",
    section: "labour",
  }),
];

export const SCOPE_RATE_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "scope.deck.m2",
    label: "Deck package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.retaining_wall.face_m2",
    label: "Retaining wall package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.fence.lm",
    label: "Fence package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "fence",
    workAreaLabel: "Fence",
    unit: "lm",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.bathroom.m2",
    label: "Bathroom package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "bathroom",
    workAreaLabel: "Bathroom",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.kitchen.m2",
    label: "Kitchen package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "kitchen",
    workAreaLabel: "Kitchen",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.pergola.m2",
    label: "Pergola package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "pergola",
    workAreaLabel: "Pergola",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.demolition.m2",
    label: "Demolition package rate",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "demolition",
    workAreaLabel: "Demolition",
    unit: "m2",
    calculatorSupport: "planned",
    section: "scope",
  }),
  entry({
    item_key: "scope.external_stairs.riser",
    label: "External stairs per riser",
    rate_type: "scope",
    category: "scope_package",
    work_area_type: "external_stairs",
    workAreaLabel: "External stairs",
    unit: "riser",
    calculatorSupport: "planned",
    section: "scope",
  }),
];

export const MATERIAL_RATE_CATALOGUE: RateCatalogueEntry[] = [
  // Deck
  entry({
    item_key: "deck.material.treated_pine.m2",
    label: "Treated pine decking",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    defaultCostRate: DECK_BENCHMARKS.treatedPineDecking.cost,
    defaultSellRate: DECK_BENCHMARKS.treatedPineDecking.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "deck.material.hardwood.m2",
    label: "Hardwood decking",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    defaultCostRate: DECK_BENCHMARKS.hardwoodDecking.cost,
    defaultSellRate: DECK_BENCHMARKS.hardwoodDecking.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "deck.material.composite.m2",
    label: "Composite decking",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    defaultCostRate: DECK_BENCHMARKS.compositeDecking.cost,
    defaultSellRate: DECK_BENCHMARKS.compositeDecking.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "deck.substructure.m2",
    label: "Deck substructure / framing",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    defaultCostRate: DECK_BENCHMARKS.framing.cost,
    defaultSellRate: DECK_BENCHMARKS.framing.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "deck.fixings.m2",
    label: "Deck fixings and consumables",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck",
    unit: "m2",
    defaultCostRate: DECK_BENCHMARKS.fixings.cost,
    defaultSellRate: DECK_BENCHMARKS.fixings.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Pergola
  entry({
    item_key: "pergola.material.m2",
    label: "Pergola frame materials",
    rate_type: "material",
    category: "material",
    work_area_type: "pergola",
    workAreaLabel: "Pergola",
    unit: "m2",
    defaultCostRate: PERGOLA_BENCHMARKS.frameMaterials.cost,
    defaultSellRate: PERGOLA_BENCHMARKS.frameMaterials.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "pergola.roofing.m2",
    label: "Pergola roofing",
    rate_type: "material",
    category: "material",
    work_area_type: "pergola",
    workAreaLabel: "Pergola",
    unit: "m2",
    defaultCostRate: PERGOLA_BENCHMARKS.roofing.cost,
    defaultSellRate: PERGOLA_BENCHMARKS.roofing.sell,
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Retaining wall
  entry({
    item_key: "retaining_wall.material.timber.face_m2",
    label: "Timber retaining wall face",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall",
    unit: "m2",
    defaultCostRate: RETAINING_WALL_BENCHMARKS.timberFace.cost,
    defaultSellRate: RETAINING_WALL_BENCHMARKS.timberFace.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "retaining_wall.material.concrete.face_m2",
    label: "Concrete retaining wall face",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall",
    unit: "m2",
    defaultCostRate: RETAINING_WALL_BENCHMARKS.concreteFace.cost,
    defaultSellRate: RETAINING_WALL_BENCHMARKS.concreteFace.sell,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "retaining_wall.drainage.lm",
    label: "Retaining wall drainage",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall",
    unit: "lm",
    defaultCostRate: RETAINING_WALL_BENCHMARKS.drainagePerM.cost,
    defaultSellRate: RETAINING_WALL_BENCHMARKS.drainagePerM.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "retaining_wall.backfill.face_m2",
    label: "Retaining wall backfill",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall",
    unit: "m2",
    defaultCostRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.cost,
    defaultSellRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.sell,
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Fence
  entry({
    item_key: "fence.material.timber.lm",
    label: "Timber fence materials",
    rate_type: "material",
    category: "material",
    work_area_type: "fence",
    workAreaLabel: "Fence",
    unit: "lm",
    defaultCostRate: FENCE_BENCHMARKS.timberPerLm.cost,
    defaultSellRate: FENCE_BENCHMARKS.timberPerLm.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "fence.material.metal.lm",
    label: "Metal fence materials",
    rate_type: "material",
    category: "material",
    work_area_type: "fence",
    workAreaLabel: "Fence",
    unit: "lm",
    defaultCostRate: FENCE_BENCHMARKS.metalPerLm.cost,
    defaultSellRate: FENCE_BENCHMARKS.metalPerLm.sell,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "fence.gate.allowance",
    label: "Gate allowance",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "fence",
    workAreaLabel: "Fence",
    unit: "allowance",
    defaultCostRate: FENCE_BENCHMARKS.gate.cost,
    defaultSellRate: FENCE_BENCHMARKS.gate.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Bathroom
  entry({
    item_key: "bathroom.waterproofing.allowance",
    label: "Waterproofing allowance",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "bathroom",
    workAreaLabel: "Bathroom",
    unit: "allowance",
    defaultCostRate: BATHROOM_BENCHMARKS.waterproofing.cost,
    defaultSellRate: BATHROOM_BENCHMARKS.waterproofing.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "bathroom.tiling.m2",
    label: "Tiling materials",
    rate_type: "material",
    category: "material",
    work_area_type: "bathroom",
    workAreaLabel: "Bathroom",
    unit: "m2",
    defaultCostRate: BATHROOM_BENCHMARKS.tilingPerM2.cost,
    defaultSellRate: BATHROOM_BENCHMARKS.tilingPerM2.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "bathroom.fixtures.allowance",
    label: "Fixtures allowance",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "bathroom",
    workAreaLabel: "Bathroom",
    unit: "allowance",
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Kitchen
  entry({
    item_key: "kitchen.cabinetry.allowance",
    label: "Cabinetry allowance",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "kitchen",
    workAreaLabel: "Kitchen",
    unit: "allowance",
    defaultCostRate: KITCHEN_BENCHMARKS.cabinetry.cost,
    defaultSellRate: KITCHEN_BENCHMARKS.cabinetry.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  entry({
    item_key: "kitchen.benchtop.allowance",
    label: "Benchtop allowance",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "kitchen",
    workAreaLabel: "Kitchen",
    unit: "allowance",
    defaultCostRate: KITCHEN_BENCHMARKS.benchtop.cost,
    defaultSellRate: KITCHEN_BENCHMARKS.benchtop.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
  // Demolition
  entry({
    item_key: "demolition.waste.m2",
    label: "Waste removal / disposal",
    rate_type: "material",
    category: "material",
    work_area_type: "demolition",
    workAreaLabel: "Demolition",
    unit: "m2",
    defaultCostRate: DEMOLITION_BENCHMARKS.wastePerM2.cost,
    defaultSellRate: DEMOLITION_BENCHMARKS.wastePerM2.sell,
    recommended: true,
    calculatorSupport: "used_now",
    section: "material",
  }),
];

/** Keys seeded when user clicks Create starter rates */
export const STARTER_RATE_ITEM_KEYS = [
  "labour.carpenter.hour",
  "labour.labourer.hour",
  "labour.general.hour",
  "deck.material.treated_pine.m2",
  "deck.material.hardwood.m2",
  "deck.substructure.m2",
  "retaining_wall.material.timber.face_m2",
  "fence.material.timber.lm",
  "bathroom.waterproofing.allowance",
] as const;

export const ALL_RATE_CATALOGUE: RateCatalogueEntry[] = [
  ...LABOUR_RATE_CATALOGUE,
  ...SCOPE_RATE_CATALOGUE,
  ...MATERIAL_RATE_CATALOGUE,
];

export const RECOMMENDED_RATE_CATALOGUE = ALL_RATE_CATALOGUE.filter(
  (entry) => entry.recommended
);

export function getCatalogueEntry(
  itemKey: string
): RateCatalogueEntry | undefined {
  return ALL_RATE_CATALOGUE.find((entry) => entry.item_key === itemKey);
}

export function formatRateUnit(unit: string): string {
  switch (unit) {
    case "m2":
      return "m²";
    case "lm":
      return "lm";
    case "hour":
      return "hr";
    case "riser":
      return "riser";
    case "each":
      return "each";
    case "allowance":
      return "allowance";
    default:
      return unit;
  }
}

export function groupCatalogueByWorkArea(
  entries: RateCatalogueEntry[]
): { workAreaLabel: string; entries: RateCatalogueEntry[] }[] {
  const groups = new Map<string, RateCatalogueEntry[]>();

  for (const entry of entries) {
    const key = entry.workAreaLabel ?? "General";
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([workAreaLabel, groupEntries]) => ({
    workAreaLabel,
    entries: groupEntries,
  }));
}
