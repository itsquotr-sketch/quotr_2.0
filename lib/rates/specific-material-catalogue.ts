import {
  DECK_BENCHMARKS,
  FITOUT_BENCHMARKS,
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
import { RW_PRODUCTIVITY_KEYS } from "@/lib/estimate/retaining-wall-productivity";
import {
  RW_EXCAVATION_MACHINE_HOURS_KEY,
  RW_EXCAVATION_MANUAL_HOURS_KEY,
  RW_EXCAVATION_MACHINE_HOURS_STARTER,
  RW_EXCAVATION_MANUAL_HOURS_STARTER,
  RW_DRAINAGE_SOCK_KEY,
  RW_DRAINAGE_SOCK_STARTER_COST_PER_LM,
} from "@/lib/estimate/retaining-wall-family-coverage";
import { RW_HOUSE_PILE_125_KEY } from "@/lib/estimate/retaining-wall-identities";
import { FENCE_PRODUCTIVITY_KEYS } from "@/lib/estimate/fence-productivity";
import {
  FENCE_FIXINGS_MODULAR_KEY,
  FENCE_GATE_HARDWARE_KEY,
  FENCE_POST_ALUMINIUM_KEY,
  FENCE_POST_PLASTIC_KEY,
  FENCE_POST_STEEL_KEY,
  FENCE_PREMIX_20KG_KEY,
  FENCE_SECTION_ALUMINIUM_FAMILY_KEY,
  FENCE_SECTION_PLASTIC_FAMILY_KEY,
  FENCE_SECTION_STEEL_FAMILY_KEY,
  fenceBoardMaterialKey,
  fenceCappingMaterialKey,
  fenceGateFrameMaterialKey,
  fencePostMaterialKey,
  fenceRailMaterialKey,
} from "@/lib/estimate/fence-identities";
import { FENCE_MODULAR_1C_MATERIAL_STARTERS } from "@/lib/estimate/fence-modular-1c";
import { FENCE_TIMBER_1B_MATERIAL_STARTERS } from "@/lib/estimate/fence-timber-1b";
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
    description:
      "Purchase m³ after the Timber 1D 1.25 procurement factor. In-place volume stays the labour driver. Not a face-m² package.",
    defaultCostRate: 72,
    defaultSellRate: 90,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.face_board.150x50.h4",
    label: "Retaining-wall face board 150×50 H4 No.2 / retaining",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "lm",
    description:
      "150×50 H4 No.2 / retaining-grade face board (not SG8). Purchase lm × company or Quotr starter $/lm.",
    defaultCostRate: 12.8,
    defaultSellRate: 16,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.face_board.200x50.h4",
    label: "Retaining-wall face board 200×50 H4 No.2 / retaining",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "lm",
    description:
      "200×50 H4 No.2 / retaining-grade face board (not SG8). Purchase lm × company or Quotr starter $/lm.",
    defaultCostRate: 17.4,
    defaultSellRate: 21.75,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed",
    label: "H5 SED / pole (legacy $/lm — leftover)",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "lm",
    description:
      "Legacy generic H5 SED $/lm. 1D-R1 prices stock-length EA by 150–175 mm class. Not used for detailed timber money.",
    defaultCostRate: 28,
    defaultSellRate: 35,
    recommended: false,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed.150_175.1_8m",
    label: "H5 SED 150–175 mm × 1.8 m stock pole",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "ea",
    description:
      "Purchase EA of 1.8 m H5 SED 150–175 mm. Estimating default diameter class — not structural design.",
    defaultCostRate: 38,
    defaultSellRate: 47.5,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed.150_175.2_4m",
    label: "H5 SED 150–175 mm × 2.4 m stock pole",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "ea",
    description:
      "Purchase EA of 2.4 m H5 SED 150–175 mm. Estimating default diameter class — not structural design.",
    defaultCostRate: 52,
    defaultSellRate: 65,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed.150_175.2_7m",
    label: "H5 SED 150–175 mm × 2.7 m stock pole",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "ea",
    description:
      "Purchase EA of 2.7 m H5 SED 150–175 mm.",
    defaultCostRate: 60,
    defaultSellRate: 75,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed.150_175.3_0m",
    label: "H5 SED 150–175 mm × 3.0 m stock pole",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "ea",
    description: "Purchase EA of 3.0 m H5 SED 150–175 mm.",
    defaultCostRate: 68,
    defaultSellRate: 85,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.pile.h5_sed.150_175.3_6m",
    label: "H5 SED 150–175 mm × 3.6 m stock pole",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "ea",
    description: "Purchase EA of 3.6 m H5 SED 150–175 mm.",
    defaultCostRate: 88,
    defaultSellRate: 110,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_HOUSE_PILE_125_KEY,
    label: "125×125 H5 house pile (retaining post alternative)",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "lm",
    description:
      "Reuses Deck house-pile Quotr starter $23.50/lm EX GST. Purchase is stock-length lm when builder selects house pile instead of H5 SED pole.",
    defaultCostRate: HOUSE_PILE_BENCHMARK_COST_EX_GST,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_DRAINAGE_SOCK_KEY,
    label: "Drainage coil filter sock",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall drainage",
    unit: "lm",
    description:
      "LOW-CONFIDENCE Quotr starter when drain coil sock is required. Quantity follows installed drainage coil length.",
    defaultCostRate: RW_DRAINAGE_SOCK_STARTER_COST_PER_LM,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "plant.mini_excavator.day",
    label: "Mini-excavator dry hire (day)",
    rate_type: "allowance",
    category: "allowance",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall plant",
    unit: "day",
    description:
      "Accessible-site starter for machine-assisted timber pile holes. Dry hire, ex GST. Not priced when access cannot take a machine.",
    defaultCostRate: 420,
    defaultSellRate: 525,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.timber.fixings.residual",
    label: "Timber retaining-wall fixings residual",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall timber",
    unit: "item",
    description:
      "Quotr starter allowance: 8% of face-board + purchased pile stock cost unless a company residual is set. Not an empirical benchmark.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.sleeper.precast",
    label: "Precast concrete sleeper",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Concrete sleeper wall",
    unit: "ea",
    description:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK for a 2000×200 mm class sleeper. Not a trusted current market price. Company/Project exact overrides. Purchase EA — cut/end bays still buy a full unit.",
    defaultCostRate: 36,
    defaultSellRate: 45,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.sleeper.steel_post",
    label: "H-section steel retaining post",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Concrete sleeper wall",
    unit: "lm",
    description:
      "LOW-CONFIDENCE QUOTR STARTER BENCHMARK for H-section retaining posts $/lm. Not a supplier quote. Stock-length SKUs are not invented. Company may also set an EA rate.",
    defaultCostRate: 58,
    defaultSellRate: 72.5,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.sleeper.premix.20kg.bag",
    label: "Post-hole premix (20 kg bag)",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Concrete sleeper wall",
    unit: "bag",
    description:
      "MEDIUM-CONFIDENCE Quotr starter in the current NZ 20 kg GP/rapid retail band (~$11–12/bag ex GST). Bags = ceil(hole m³ / 0.01 m³ yield). Estimating-grade premix — not a specified structural mix. Company exact overrides.",
    defaultCostRate: 11.5,
    defaultSellRate: 14.38,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.block.150_series",
    label: "150-series masonry block",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "ea",
    description:
      "LOW-CONFIDENCE Quotr starter for 150-series CMU/Besser EA. Purchase qty includes disclosed 5% procurement allowance. Company/Project exact overrides.",
    defaultCostRate: 4.8,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.block.200_series",
    label: "200-series masonry block",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "ea",
    description:
      "LOW-CONFIDENCE Quotr starter for 200-series 390×190×190 CMU/Besser EA. Purchase qty includes disclosed 5% procurement allowance. Company/Project exact overrides.",
    defaultCostRate: 5.5,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.mortar.allowance",
    label: "Masonry mortar / laying consumables",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "item",
    description:
      "Optional company mortar / laying-consumables lump. When unset, Quotr uses 10% of purchased block material as a low-confidence starter. Not core fill. Not included in labour-only block-lay subcontract.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.core_fill.m3",
    label: "Masonry core fill",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m3",
    description:
      "LOW-CONFIDENCE Quotr starter $/m³ for core fill/grout. Distinct from drainage aggregate and footing concrete unless company unifies. Company/Project exact overrides.",
    defaultCostRate: 260,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.footing.m3",
    label: "Masonry strip footing concrete",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m3",
    description:
      "LOW-CONFIDENCE Quotr starter ready-mix $/m³ for strip footing. Not bagged concrete. Pump/delivery not invented. Company/Project exact overrides.",
    defaultCostRate: 245,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.subbase.m3",
    label: "Masonry sub-base aggregate",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m3",
    description:
      "MEDIUM-CONFIDENCE Quotr starter for compacted sub-base under footing. Distinct from drainage aggregate. Company/Project exact overrides.",
    defaultCostRate: 68,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.rebar.lm",
    label: "Masonry reinforcement",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "lm",
    description:
      "Rebar identity. Quantified only when design runs are stated. Otherwise use reinforcement allowance.",
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.rebar.allowance",
    label: "Masonry reinforcement allowance",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "item",
    description:
      "Optional company design-dependent reinforcement allowance (lump). Not a fabricated bar schedule.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.waterproofing.liquid",
    label: "Liquid waterproofing membrane",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "L",
    description:
      "LOW-CONFIDENCE Quotr starter for liquid retaining-side membrane $/L (~1 L/m²). Company/Project exact overrides.",
    defaultCostRate: 12,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.waterproofing.sheet",
    label: "Sheet waterproofing membrane",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m2",
    description:
      "LOW-CONFIDENCE Quotr starter for sheet retaining-side membrane $/m². Company/Project exact overrides.",
    defaultCostRate: 22,
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.block_lay.subcontract",
    label: "Masonry block laying — subcontract labour only",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m2",
    description:
      "Labour-only subcontract rate for laying masonry blocks ($/face m²). Materials remain builder supplied unless scope is Labour + blocks & laying materials. XOR with self-perform labour. Pricing Required when unset.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.masonry.waterproofing.subcontract",
    label: "Waterproofing subcontract",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Masonry wall",
    unit: "m2",
    description:
      "Company/Project subcontract $/m² for retaining-side waterproofing. XOR with self-perform. Pricing Required when unset.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
];

export const WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "retaining_wall.spoil.removal.all_in.m3",
    label: "Hardfill / excavated spoil removal",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Waste / disposal",
    unit: "m3",
    description:
      "All-in cartage and disposal cost per measured excavation m³. Company exact $/m³, otherwise Pricing Required — no invented Quotr starter. Not a tip-only fee.",
    recommended: true,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "retaining_wall.spoil.disposal.m3",
    label: "Disposal / tip fee only",
    rate_type: "material",
    category: "material",
    work_area_type: "retaining_wall",
    workAreaLabel: "Waste / disposal",
    unit: "m3",
    description:
      "Tip/disposal fee only per m³ — not cartage. Leftover future split. Does not price all-in spoil removal. No invented Quotr starter.",
    calculatorSupport: "leftover",
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
            "Valid physical identity. No invented Quotr benchmark. Company or project exact rate required; otherwise Pricing Required. Does not restore the substructure package on detailed geometry.",
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
    item_key: "deck.decking.install.hours_per_lm",
    label: "Decking installation (labour-h / decking lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "lm",
    description:
      "Hours per installed decking lm, not dollars. Uses required installed lm (waste is procurement, not labour). Includes normal handling at the workface. Abnormal access/carry is a Project Condition, applied once. Do not enter a legacy h/m² value here.",
    defaultCostRate: 0.077,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.decking.install.hours_per_m2",
    label: "Decking installation (legacy hours/m² — not used for detailed money)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Legacy hours per m². Not consumed for detailed Deck money. Do not reinterpret this number as hours/lm. Set Decking installation (labour-h / decking lm) for a compatible company override.",
    defaultCostRate: 0.55,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: "deck.substructure.install.hours_per_framing_lm",
    label: "Substructure framing (labour-h / framing lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "lm",
    description:
      "LOW-CONFIDENCE starter. Hours per required installed joist+bearer+rim lm, not dollars. Waste is not labour. Excludes pile/post installation. Abnormal access/carry is a Project Condition, applied once. Do not enter a legacy h/m² value here.",
    defaultCostRate: 0.13,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.substructure.install.hours_per_m2",
    label: "Substructure framing (legacy hours/m² — not used for detailed money)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "m2",
    description:
      "Legacy hours per m². Not consumed for detailed Deck money. Do not reinterpret this number as hours/lm. Set Substructure framing (labour-h / framing lm) for a compatible company override.",
    defaultCostRate: 0.52,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: "deck.posts.install.hours_per_ea",
    label: "Pile/post installation (hours/ea)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "ea",
    description:
      "Hours per support, not dollars. Includes normal set-out, hole excavation, hole preparation, positioning, cutting/setting, and installation. Does not include concrete placement. Abnormal access/carry is a Project Condition, applied once.",
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
      "Hours per installed fascia / edge-board lm, not dollars. Uses exposed perimeter × courses. Not height-driven. Abnormal access/carry is a Project Condition, applied once.",
    defaultCostRate: 0.45,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.skirting.install.hours_per_lm",
    label: "Full-height deck skirting / screening (labour-h / lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "lm",
    description:
      "Hours per installed full-height skirting / screening lm, not dollars. Only when full-height deck skirting / screening is explicitly included. Height-sensitive. Not inferred from elevation or fascia.",
    defaultCostRate: 0.45,
    calculatorSupport: "used_now",
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
      "Hours per m² of tread area, not dollars. Includes normal handling of step materials at the workface. Used when Steps are commercially included and the detailed step chain is complete.",
    defaultCostRate: 4.0,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: "deck.post_hole_concrete.place.hours_per_bag",
    label: "Deck post-hole concrete placement (labour-h/bag)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "bag",
    description:
      "LOW_CONFIDENCE starter 0.16 labour-h/bag (0.4 h/hole mixing/placing/finishing ÷ 2.5 bags/hole canonical default). Driver is whole purchased bags. Hole excavation stays in pile/post installation. Not Fence 0.06 or RW 0.035. Company exact hours/bag wins. Legacy hours/hole is leftover and is never reinterpreted as hours/bag.",
    defaultCostRate: 0.16,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: "deck.concrete.place.hours_per_hole",
    label: "Deck concrete placement (hours/hole) — legacy",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "deck",
    workAreaLabel: "Deck productivity",
    unit: "hole",
    description:
      "LEGACY hours/hole. Mature Deck path uses Deck post-hole concrete placement (labour-h/bag). Do not reinterpret this numeric as h/bag.",
    calculatorSupport: "leftover",
  }),
];

export const DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: "deck.concrete.premix.20kg.bag",
    label: "20 kg premix concrete",
    rate_type: "material",
    category: "material",
    work_area_type: "deck",
    workAreaLabel: "Deck concrete",
    unit: "bag",
    description:
      "Exact 20 kg premix bag identity. No invented Quotr $ benchmark. Company or project exact rate required; otherwise Pricing Required. Not residual fixings money.",
    calculatorSupport: "used_now",
  }),
];

export const RETAINING_WALL_PRODUCTIVITY_RATE_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: RW_EXCAVATION_MACHINE_HOURS_KEY,
    label: "Retaining wall excavation — machine-assisted (labour-h/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Total worker-hours per m³ when a mini excavator can access the work area. Starter 0.45 labour-h/m³. Plant hire is separate.",
    defaultCostRate: RW_EXCAVATION_MACHINE_HOURS_STARTER,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: RW_EXCAVATION_MANUAL_HOURS_KEY,
    label: "Retaining wall excavation — manual (labour-h/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Total worker-hours per m³ when no digger access. Starter 1.6 labour-h/m³. No excavation plant.",
    defaultCostRate: RW_EXCAVATION_MANUAL_HOURS_STARTER,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.excavationM3,
    label: "Retaining wall excavation (legacy key — use machine/manual rows)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Legacy combined key kept for backward compatibility. Prefer machine-assisted or manual excavation productivity rows.",
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.backfillM3,
    label: "Retaining wall backfill (hours/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Hours per m³ placing/spreading/basic consolidation of drainage aggregate. Timber 1D starter 0.55 h/m³ in-place. Access/carry stays Project Conditions.",
    defaultCostRate: 0.55,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.timberConcreteHole,
    label: "Timber post-hole concrete placement (labour-h/hole) — legacy",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "hole",
    description:
      "LEGACY hours/hole. Mature bagged path uses Retaining wall — post-hole bagged concrete placement (labour-h/bag). Do not reinterpret this numeric as h/bag.",
    defaultCostRate: 0.12,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.timberPilesEa,
    label: "Timber pile installation (labour-h/ea)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "ea",
    description: "Hours per pile including set-out, hole, place, plumb. Timber 1D starter 0.85 h/ea. Excludes bulk excavation.",
    defaultCostRate: 0.85,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.timberFaceM2,
    label: "Timber face-board installation (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m2",
    description: "Hours per m² face area. Timber 1D starter 0.55 h/m². Driver is face area, not board lm.",
    defaultCostRate: 0.55,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.drainageLm,
    label: "Drainage installation (hours/lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "lm",
    description:
      "Hours per lm novacoil run. Timber 1D starter 0.15 h/lm. Excludes drainage aggregate placement.",
    defaultCostRate: 0.15,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.sleeperPostsEa,
    label: "Steel post installation (hours/ea)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "ea",
    description:
      "Hours per steel post including set-out, attend machine hole, place, plumb. 2A machine-assisted starter 0.95 h/ea. Manual 2.0 h/ea. Concrete placement is a separate intent.",
    defaultCostRate: 0.95,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.sleeperConcreteHole,
    label: "Sleeper post concrete placement (hours/hole) — legacy",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "hole",
    description:
      "LEGACY hours/hole. Mature bagged path uses Retaining wall — post-hole bagged concrete placement (labour-h/bag). Do not reinterpret this numeric as h/bag.",
    defaultCostRate: 0.12,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.postHoleConcreteM3,
    label: "Retaining wall — post-hole concrete placement (labour-h/m³) — legacy",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "LEGACY labour-h/m³. Mature bagged path uses Retaining wall — post-hole bagged concrete placement (labour-h/bag). Do not reinterpret this numeric as h/bag.",
    defaultCostRate: 3.5,
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.postHoleConcreteBag,
    label: "Retaining wall — post-hole bagged concrete placement",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "bag",
    description:
      "Total person-hours to mix and place one bag of post-hole concrete. Shared Timber/Sleeper bagged premix. Quotr starter 0.035 labour-h/bag (low confidence; dimensional conversion of prior 3.5 h/m³ × 0.01 m³/bag). Company editable. Not hours/m³ or hours/hole.",
    defaultCostRate: 0.035,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.sleeperFaceM2,
    label: "Concrete sleeper installation (hours/m²) — leftover",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m2",
    description:
      "Leftover face-m² sleeper labour. 2A prices discrete sleeper EA instead.",
    calculatorSupport: "leftover",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.sleeperSleepersEa,
    label: "Concrete sleeper installation (hours/ea)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "ea",
    description:
      "Hours per sleeper. 2A starter 0.22 h/ea. Driver is discrete EA, not wall m².",
    defaultCostRate: 0.22,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonrySubbaseM2,
    label: "Masonry sub-base compaction (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m2",
    description:
      "Hours per m² footing base area. 2B starter 0.15 h/m². Company editable.",
    defaultCostRate: 0.15,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonryFootingM3,
    label: "Masonry footing concrete (hours/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Hours per m³ footing concrete placement. 2B starter 1.2 h/m³. Does not imply excavation/rebar/sub-base.",
    defaultCostRate: 1.2,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonryRebarLm,
    label: "Masonry rebar installation (hours/lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "lm",
    description:
      "Hours per lm reinforcement when design quantity exists. 2B starter 0.08 h/lm.",
    defaultCostRate: 0.08,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonryBlockM2,
    label: "Masonry block laying (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m2",
    description:
      "Self-perform hours per face m². 2B starter 1.8 h/m². XOR with subcontract — do not price both.",
    defaultCostRate: 1.8,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonryCoreFillM3,
    label: "Masonry core fill (hours/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m3",
    description:
      "Separate core-fill hours per m³. 2B starter 0.85 h/m³. Not included in block laying.",
    defaultCostRate: 0.85,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.masonryWaterproofM2,
    label: "Masonry waterproofing (hours/m²)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall productivity",
    unit: "m2",
    description:
      "Self-perform hours per m² retaining-side. 2B starter 0.28 h/m². XOR with subcontract.",
    defaultCostRate: 0.28,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.plantHoursPerPile,
    label: "Mini-excavator occupancy (hours/pile)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall plant productivity",
    unit: "ea",
    description:
      "Machine hours per pile hole (auger occupancy). Not carpenter attendance. Timber 1E starter 0.20 h/ea.",
    defaultCostRate: 0.2,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.plantHoursPerM3,
    label: "Mini-excavator occupancy (hours/m³)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall plant productivity",
    unit: "m3",
    description:
      "Machine hours per measured bulk m³. Not crew attendance. Timber 1E starter 0.25 h/m³.",
    defaultCostRate: 0.25,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.plantSetupHours,
    label: "Mini-excavator setup (hours/job)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall plant productivity",
    unit: "job",
    description:
      "Fixed unload / set-up / pack-up occupancy per hire visit. Timber 1E starter 1.0 h. Not a dollar lump.",
    defaultCostRate: 1,
    calculatorSupport: "used_now",
  }),
  entry({
    item_key: RW_PRODUCTIVITY_KEYS.plantProductiveHoursPerDay,
    label: "Mini-excavator productive hours per hire day",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "retaining_wall",
    workAreaLabel: "Retaining wall plant productivity",
    unit: "day",
    description:
      "Productive machine hours in one dry-hire day after mobilisation and breaks. Timber 1E starter 7 h/day. Days = ceil(total machine hours / this value).",
    defaultCostRate: 7,
    calculatorSupport: "used_now",
  }),
];

function fenceStarterEntry(
  itemKey: string,
  label: string,
  extra?: Partial<RateCatalogueEntry>
): RateCatalogueEntry {
  const starter = FENCE_TIMBER_1B_MATERIAL_STARTERS[itemKey];
  const cost = starter?.costPerUnit;
  const sell = cost != null ? Math.round((cost / 0.8) * 100) / 100 : undefined;
  return entry({
    item_key: itemKey,
    label,
    rate_type: "material",
    category: "material",
    work_area_type: "fence",
    workAreaLabel: "Fence timber",
    unit: starter?.unit ?? "lm",
    description: starter?.basis ?? "LOW-CONFIDENCE Quotr starter. Company exact overrides.",
    defaultCostRate: cost,
    defaultSellRate: sell,
    calculatorSupport: "used_now",
    recommended: true,
    ...extra,
  });
}

export const FENCE_TIMBER_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  fenceStarterEntry(fencePostMaterialKey(), "Fence post — H4 100×100"),
  fenceStarterEntry(fenceRailMaterialKey("75x50"), "Fence rail — H4 75×50"),
  fenceStarterEntry(fenceRailMaterialKey("100x50"), "Fence rail — H4 100×50"),
  fenceStarterEntry(fenceRailMaterialKey("75x40"), "Fence rail — H4 75×40"),
  fenceStarterEntry(fenceBoardMaterialKey("radiata_pine", 19), "Radiata paling 150×19"),
  fenceStarterEntry(fenceBoardMaterialKey("radiata_pine", 25), "Radiata paling 150×25"),
  fenceStarterEntry(fenceBoardMaterialKey("macrocarpa", 19), "Macrocarpa paling 150×19"),
  fenceStarterEntry(fenceBoardMaterialKey("macrocarpa", 25), "Macrocarpa paling 150×25"),
  fenceStarterEntry(fenceBoardMaterialKey("cedar", 19), "Cedar paling 150×19"),
  fenceStarterEntry(fenceBoardMaterialKey("cedar", 25), "Cedar paling 150×25"),
  fenceStarterEntry(fenceBoardMaterialKey("hardwood", 19), "Hardwood paling 150×19 (generic)"),
  fenceStarterEntry(fenceBoardMaterialKey("hardwood", 25), "Hardwood paling 150×25 (generic)"),
  fenceStarterEntry(fenceCappingMaterialKey("radiata_pine"), "Radiata capping 65×40"),
  fenceStarterEntry(fenceCappingMaterialKey("macrocarpa"), "Macrocarpa capping 65×40"),
  fenceStarterEntry(fenceCappingMaterialKey("cedar"), "Cedar capping 65×40"),
  fenceStarterEntry(fenceCappingMaterialKey("hardwood"), "Hardwood capping 65×40 (generic)"),
  fenceStarterEntry(fenceGateFrameMaterialKey(), "Gate frame — H4 75×50"),
  fenceStarterEntry(FENCE_GATE_HARDWARE_KEY, "Fence gate hardware set", {
    unit: "ea",
  }),
  fenceStarterEntry(FENCE_PREMIX_20KG_KEY, "20 kg premix (fence post holes)", {
    unit: "bag",
    description:
      "Same 20 kg premix identity as Deck/RW. Company exact on this key or deck.concrete.premix.20kg.bag wins.",
  }),
];

function fenceModularStarterEntry(
  itemKey: string,
  label: string,
  extra?: Partial<RateCatalogueEntry>
): RateCatalogueEntry {
  const starter = FENCE_MODULAR_1C_MATERIAL_STARTERS[itemKey];
  const cost = starter?.costPerUnit;
  const sell = cost != null ? Math.round((cost / 0.8) * 100) / 100 : undefined;
  return entry({
    item_key: itemKey,
    label,
    rate_type: "material",
    category: "material",
    work_area_type: "fence",
    workAreaLabel: "Fence modular",
    unit: starter?.unit ?? "ea",
    description: starter?.basis ?? "LOW-CONFIDENCE Quotr generic benchmark. Not a supplier SKU.",
    defaultCostRate: cost,
    defaultSellRate: sell,
    calculatorSupport: "used_now",
    recommended: true,
    ...extra,
  });
}

export const FENCE_MODULAR_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[] = [
  fenceModularStarterEntry(
    FENCE_SECTION_ALUMINIUM_FAMILY_KEY,
    "Aluminium slat fence section (1.8 m wide × matching height)"
  ),
  fenceModularStarterEntry(
    FENCE_SECTION_STEEL_FAMILY_KEY,
    "Steel slat fence section (1.8 m wide × matching height)"
  ),
  fenceModularStarterEntry(
    FENCE_SECTION_PLASTIC_FAMILY_KEY,
    "Plastic / composite fence section (1.8 m wide × matching height)"
  ),
  fenceModularStarterEntry(FENCE_POST_ALUMINIUM_KEY, "Aluminium modular fence post"),
  fenceModularStarterEntry(FENCE_POST_STEEL_KEY, "Steel modular fence post"),
  fenceModularStarterEntry(
    FENCE_POST_PLASTIC_KEY,
    "Plastic / composite modular fence post"
  ),
  fenceModularStarterEntry(
    FENCE_FIXINGS_MODULAR_KEY,
    "Modular fence brackets & fixings"
  ),
];

export const FENCE_PRODUCTIVITY_RATE_CATALOGUE: RateCatalogueEntry[] = [
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.postInstall,
    label: "Fence post installation (labour-h/post)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "post",
    description:
      "Total person-hours per post: set-out, ordinary hole digging, normal workface handling, set/plumb/brace. Starter 0.70. Shared Timber and modular Fence. Not elapsed crew time.",
    defaultCostRate: 0.7,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.railLm,
    label: "Fence rail installation (labour-h/rail-lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "lm",
    description:
      "Total person-hours per required rail lm. Reacts to 2 vs 3 rails. Starter 0.08. Not fence-lm package labour.",
    defaultCostRate: 0.08,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.verticalBoardsLm,
    label: "Vertical paling installation (labour-h/board-lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "lm",
    description:
      "Total person-hours per required board lm. Gap/board count changes hours. Starter 0.05. Not face m².",
    defaultCostRate: 0.05,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.horizontalSlatsLm,
    label: "Horizontal slat installation (labour-h/slat-lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "lm",
    description:
      "Total person-hours per required slat lm. Course count changes hours. Starter 0.06. Distinct from vertical palings.",
    defaultCostRate: 0.06,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.cappingLm,
    label: "Fence capping installation (labour-h/lm)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "lm",
    description: "Total person-hours per installed capping lm. Starter 0.08.",
    defaultCostRate: 0.08,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.gateInstall,
    label: "Timber gate fabrication & installation (labour-h/gate)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "gate",
    description:
      "Frame assembly, hanging, hinges and latch. Gate-face boards stay in paling/slat labour. Starter 2.0.",
    defaultCostRate: 2,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.postHoleConcreteBag,
    label: "Fence post-hole concrete placement (labour-h/bag)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "bag",
    description:
      "Fence-specific mix and place one bag. Starter 0.06. Not the RW 0.035 h/bag starter. Not h/m³ or h/hole.",
    defaultCostRate: 0.06,
    calculatorSupport: "used_now",
    recommended: true,
  }),
  entry({
    item_key: FENCE_PRODUCTIVITY_KEYS.sectionInstall,
    label: "Modular fence section installation (labour-h/section)",
    rate_type: "productivity",
    category: "labour",
    work_area_type: "fence",
    workAreaLabel: "Fence productivity",
    unit: "section",
    description:
      "Total person-hours per installed section/bay, including ordinary residual cut. Shared Metal and Plastic/composite. Starter 0.35. Not purchased waste quantity.",
    defaultCostRate: 0.35,
    calculatorSupport: "used_now",
    recommended: true,
  }),
];

export const SPECIFIC_MATERIAL_RATE_CATALOGUE: RateCatalogueEntry[] = [
  ...DECKING_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_FRAMING_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_POST_SPECIFIC_MATERIAL_CATALOGUE,
  ...DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE,
  ...SHEET_SPECIFIC_MATERIAL_CATALOGUE,
  ...RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  ...WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
  ...FLOORING_SPECIFIC_MATERIAL_CATALOGUE,
  ...PAINTING_SPECIFIC_MATERIAL_CATALOGUE,
  ...FENCE_TIMBER_SPECIFIC_MATERIAL_CATALOGUE,
  ...FENCE_MODULAR_SPECIFIC_MATERIAL_CATALOGUE,
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
      "Exact pile/post identities. Company $/lm wins. Missing post rates are Pricing Required on detailed geometry — they do not restore the substructure package.",
    entries: DECK_POST_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Deck concrete",
    description:
      "20 kg premix bag identity. No invented $ benchmark — company exact or Pricing Required.",
    entries: DECK_CONCRETE_SPECIFIC_MATERIAL_CATALOGUE,
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
      "Timber 1D-R1 and Sleeper 2A identities: 150×50 / 200×50 H4 No.2/retaining, H5 SED 150–175 mm stock-length EA, precast sleepers EA, H-section posts $/lm, post-hole 20 kg premix, novacoil, drainage aggregate, mini-excavator day, timber fixings residual. Generic H5 $/lm is leftover. Company exact overrides Quotr starters. Face-m² package rates are legacy fallback only.",
    entries: RETAINING_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Waste / disposal",
    description:
      "All-in hardfill/spoil removal is cartage + tip per measured excavation m³. Disposal / tip fee only is a leftover identity and does not price removal. Not drainage aggregate.",
    entries: WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE,
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
  {
    title: "Fence timber",
    description:
      "Detailed Timber Fence identities. Company exact overrides LOW-CONFIDENCE Quotr starters.",
    entries: FENCE_TIMBER_SPECIFIC_MATERIAL_CATALOGUE,
  },
  {
    title: "Fence modular",
    description:
      "Manufactured section $/EA and modular post $/EA. Company product (including width×height SKU) outranks Quotr generic benchmarks. Nominal 1.8 m wide × matching fence height unless the Company SKU says otherwise.",
    entries: FENCE_MODULAR_SPECIFIC_MATERIAL_CATALOGUE,
  },
] as const;
