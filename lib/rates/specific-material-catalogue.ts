import {
  DECK_BENCHMARKS,
  FITOUT_BENCHMARKS,
  RETAINING_WALL_BENCHMARKS,
} from "@/lib/estimate/benchmark-rates";
import {
  defaultBearerIdentity,
  defaultJoistIdentity,
  defaultStepFramingIdentity,
  defaultSupportIdentity,
  lightSupportIdentity,
} from "@/lib/estimate/deck-default-identities";
import { HOUSE_PILE_BENCHMARK_COST_EX_GST } from "@/lib/estimate/house-pile-benchmarks";
import { STRUCTURAL_TIMBER_BENCHMARKS } from "@/lib/estimate/structural-timber-benchmarks";
import { buildMaterialRateItemKey } from "@/lib/materials/identity";
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

function framingCatalogueEntry(
  identity: NonNullable<ReturnType<typeof defaultJoistIdentity>>,
  label: string
): RateCatalogueEntry {
  const match = STRUCTURAL_TIMBER_BENCHMARKS.find(
    (row) =>
      row.canonicalMaterialIdentity.section === identity.section &&
      row.canonicalMaterialIdentity.grade === identity.grade
  );
  return entry({
    item_key: buildMaterialRateItemKey(identity, "lm"),
    label,
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck framing",
    unit: "lm",
    description:
      "Exact structural timber identity. Company rate wins; otherwise the sourced Quotr lm benchmark. Estimating material assumption, not a structural selection.",
    defaultCostRate: match?.normalizedRateExGst,
    calculatorSupport: "used_now",
    recommended: true,
  });
}

const joistIdentity = defaultJoistIdentity();
const bearerIdentity = defaultBearerIdentity();
const stepFramingIdentity = defaultStepFramingIdentity();
const housePileIdentity = defaultSupportIdentity();
const lightPostIdentity = lightSupportIdentity();

export const DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  ...(joistIdentity
    ? [framingCatalogueEntry(joistIdentity, "Joist timber 90×45 H3.2 KD SG8")]
    : []),
  ...(bearerIdentity
    ? [framingCatalogueEntry(bearerIdentity, "Bearer timber 140×45 H3.2 KD SG8")]
    : []),
  ...(stepFramingIdentity
    ? [
        framingCatalogueEntry(
          stepFramingIdentity,
          "Step framing 190×45 H3.2 KD SG8"
        ),
      ]
    : []),
];

export const DECK_POST_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  ...(housePileIdentity
    ? [
        entry({
          item_key: buildMaterialRateItemKey(housePileIdentity, "lm"),
          label: "125×125 H5 sawn house pile",
          rate_type: "material",
          category: "material",
          work_area_type: "deck",
          workAreaLabel: "Deck posts",
          unit: "lm",
          description:
            "Quotr starter benchmark $23.50/lm EX GST for 125×125 H5 sawn house pile. Not laminated post. Not H4. Company exact override wins.",
          defaultCostRate: HOUSE_PILE_BENCHMARK_COST_EX_GST,
          calculatorSupport: "used_now",
          recommended: true,
        }),
      ]
    : []),
  ...(lightPostIdentity
    ? [
        entry({
          item_key: buildMaterialRateItemKey(lightPostIdentity, "lm"),
          label: "100×100 H5 timber post",
          rate_type: "material",
          category: "material",
          work_area_type: "deck",
          workAreaLabel: "Deck posts",
          unit: "lm",
          description:
            "Valid physical identity. No invented Quotr benchmark. Company or project exact rate required; otherwise package fallback / Pricing Required.",
          calculatorSupport: "used_now",
        }),
      ]
    : []),
];

export const DECK_PRODUCTIVITY_RATE_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "deck.base_labour_hours_per_m2",
    label: "Deck labour (current lumped hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Hours per m², not dollars. Fallback labour lump when the detailed install split is incomplete. Company override wins.",
    defaultCostRate: 1.2,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.elevated_extra_hours_per_m2",
    label: "Elevated deck extra (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    defaultCostRate: 0.25,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "deck.demolition_hours_per_m2",
    label: "Deck demolition (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    defaultCostRate: 0.35,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "deck.decking.install.hours_per_m2",
    label: "Decking installation (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Hours per m², not dollars. Company override wins. Used now for detailed decking install labour.",
    defaultCostRate: 0.55,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.substructure.install.hours_per_m2",
    label: "Substructure framing (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Hours per m², not dollars. Excludes pile/post installation. Company override wins.",
    defaultCostRate: 0.52,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.posts.install.hours_per_ea",
    label: "Pile/post installation (hours/ea)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "ea",
    description: "Hours per support, not dollars. Company override wins.",
    defaultCostRate: 0.2,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.fascia.install.hours_per_lm",
    label: "Fascia installation (hours/lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "lm",
    description:
      "Hours per installed fascia lm, not dollars. Uses the height-sensitive fascia quantity.",
    defaultCostRate: 0.45,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.steps.install.hours_per_m2",
    label: "Steps installation (hours/m² tread)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Starter / low-confidence hours per m² of tread area. Not dollars. Stair lump remains money until step material and labour are both complete.",
    defaultCostRate: 4.0,
    calculatorSupport: "planned",
  }),
];

export const SPECIFIC_MATERIAL_RATE_CATALOGUE: RateCatalogueEntry[] = [
  ...DECKING_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_POST_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_PRODUCTIVITY_RATE_CATALOGUE,
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
    title: "Deck framing timber",
    description:
      "Exact section identities. Company $/lm wins over the sourced Quotr KD H3.2 SG8 benchmark. Not a structural certificate.",
    entries: DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Deck posts / piles",
    description:
      "Rate slots only until a trusted company rate exists. Missing post rates keep the substructure package as money authority.",
    entries: DECK_POST_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Deck productivity",
    description:
      "Hours per physical unit — enter hours in the cost field. Charge-out is unused. Split keys stay planned until company sets them; lumped Deck labour remains money authority.",
    entries: DECK_PRODUCTIVITY_RATE_CATALOGUE,
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
