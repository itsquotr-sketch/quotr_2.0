/**
 * RETAINING-WALL-MATURITY-1A — concrete masonry physical takeoff.
 * Footing 400×250 and sub-base 100 mm are estimating geometry, not design.
 */

import { round2 } from "@/lib/estimate/facts";
import type { MaterialRequirement } from "@/lib/estimate/requirements";
import {
  RETAINING_WALL_MASONRY_FOOTING_DEPTH_M,
  RETAINING_WALL_MASONRY_FOOTING_WIDTH_M,
  RETAINING_WALL_MASONRY_SUBBASE_THICKNESS_M,
  postCount,
  type RetainingWallGeometry,
} from "@/lib/estimate/retaining-wall-geometry";
import {
  RW_CORE_FILL_KEY,
  RW_FOOTING_CONCRETE_KEY,
  RW_MASONRY_BLOCKS_COMPONENT,
  RW_MASONRY_CORE_COMPONENT,
  RW_MASONRY_FOOTING_COMPONENT,
  RW_MASONRY_REBAR_COMPONENT,
  RW_MASONRY_SUBBASE_COMPONENT,
  RW_MASONRY_WATERPROOF_COMPONENT,
  RW_REBAR_KEY,
  RW_SUBBASE_KEY,
  RW_WATERPROOFING_LIQUID_KEY,
  RW_WATERPROOFING_SHEET_KEY,
  masonrySeriesFromFact,
  type MasonrySeriesMetadata,
} from "@/lib/estimate/retaining-wall-identities";
import { planningMaterial } from "@/lib/estimate/retaining-wall-planning";

export const RW_DEFAULT_LIQUID_COVERAGE_L_PER_M2 = 1;

export type MasonryWallInputs = {
  blockSeries: string | null;
  layingMethod: string | null;
  footingWidthM: number | null;
  footingDepthM: number | null;
  verticalStarterSpacingM: number | null;
  horizontalRebarRuns: number | null;
  waterproofingRequired: boolean | null;
  waterproofingType: string | null;
  waterproofingMethod: string | null;
  wasteFactor: number;
};

export type MasonryWallTakeoff = {
  series: MasonrySeriesMetadata | null;
  netBlocks: number | null;
  footingM3: number;
  subbaseM2: number;
  subbaseM3: number;
  coreFillM3: number | null;
  waterproofingM2: number | null;
  waterproofingLitres: number | null;
  verticalStarters: number | null;
  horizontalRebarLm: number | null;
  selfPerformBlocks: boolean;
  subcontractBlocks: boolean;
};

function isSubcontract(raw: string | null): boolean {
  const t = (raw ?? "").toLowerCase();
  return t.includes("subcontract") || t.includes("subbie") || t === "subcontract";
}

export function masonryWallTakeoff(
  geometry: RetainingWallGeometry,
  inputs: MasonryWallInputs
): MasonryWallTakeoff {
  const series = masonrySeriesFromFact(inputs.blockSeries);
  const footingWidth =
    inputs.footingWidthM != null && inputs.footingWidthM > 0
      ? inputs.footingWidthM
      : RETAINING_WALL_MASONRY_FOOTING_WIDTH_M;
  const footingDepth =
    inputs.footingDepthM != null && inputs.footingDepthM > 0
      ? inputs.footingDepthM
      : RETAINING_WALL_MASONRY_FOOTING_DEPTH_M;
  const footingM3 = round2(geometry.lengthM * footingWidth * footingDepth);
  const subbaseM2 = round2(geometry.lengthM * footingWidth);
  const subbaseM3 = round2(
    subbaseM2 * RETAINING_WALL_MASONRY_SUBBASE_THICKNESS_M
  );
  const netBlocks =
    series != null
      ? round2(geometry.faceAreaM2 * series.unitsPerM2)
      : null;
  const coreFillM3 =
    series != null && netBlocks != null && series.blocksPerM3CoreFill > 0
      ? round2(netBlocks / series.blocksPerM3CoreFill)
      : null;
  const waterproofOn = inputs.waterproofingRequired === true;
  const sheet = (inputs.waterproofingType ?? "").toLowerCase().includes("sheet");
  const waterproofingM2 = waterproofOn ? geometry.faceAreaM2 : null;
  const waterproofingLitres =
    waterproofingM2 != null && !sheet
      ? round2(waterproofingM2 * RW_DEFAULT_LIQUID_COVERAGE_L_PER_M2)
      : null;
  const verticalStarters =
    inputs.verticalStarterSpacingM != null &&
    inputs.verticalStarterSpacingM > 0
      ? postCount(geometry.lengthM, inputs.verticalStarterSpacingM)
      : null;
  const horizontalRebarLm =
    inputs.horizontalRebarRuns != null && inputs.horizontalRebarRuns > 0
      ? round2(geometry.lengthM * inputs.horizontalRebarRuns)
      : null;
  const subcontractBlocks = isSubcontract(inputs.layingMethod);

  return {
    series,
    netBlocks,
    footingM3,
    subbaseM2,
    subbaseM3,
    coreFillM3,
    waterproofingM2,
    waterproofingLitres,
    verticalStarters,
    horizontalRebarLm,
    selfPerformBlocks: !subcontractBlocks,
    subcontractBlocks,
  };
}

export function buildMasonryWallRequirements(params: {
  workAreaId: string;
  geometry: RetainingWallGeometry;
  inputs: MasonryWallInputs;
  factKeys: string[];
}): {
  requirements: MaterialRequirement[];
  assumptions: string[];
  takeoff: MasonryWallTakeoff;
} {
  const takeoff = masonryWallTakeoff(params.geometry, params.inputs);
  const footingW =
    params.inputs.footingWidthM ?? RETAINING_WALL_MASONRY_FOOTING_WIDTH_M;
  const footingD =
    params.inputs.footingDepthM ?? RETAINING_WALL_MASONRY_FOOTING_DEPTH_M;
  const assumptions: string[] = [
    `Strip footing estimating geometry ${footingW} m wide × ${footingD} m deep — not structural certification.`,
    "Sub-base assumed 100 mm compacted under the footing.",
  ];
  if (takeoff.series) {
    assumptions.push(
      `${takeoff.series.series}-series blocks at ${takeoff.series.unitsPerM2} / m² (product metadata).`
    );
  } else {
    assumptions.push(
      "Selected masonry series has no product metadata — block quantity not fabricated."
    );
  }
  if (takeoff.verticalStarters == null) {
    assumptions.push(
      "Vertical starter spacing is a design input. Not claimed as a universal compliant spacing."
    );
  }
  if (takeoff.horizontalRebarLm == null) {
    assumptions.push(
      "Horizontal reinforcement not quantified — no fabricated engineering schedule."
    );
  }

  const common = {
    workAreaId: params.workAreaId,
    factKeys: params.factKeys,
    source: "retaining_wall.masonry",
  };
  const requirements: MaterialRequirement[] = [
    planningMaterial({
      ...common,
      componentKey: RW_MASONRY_FOOTING_COMPONENT,
      description: "Strip footing concrete",
      materialKey: RW_FOOTING_CONCRETE_KEY,
      category: "CONCRETE",
      specification: `${takeoff.footingM3} m³ footing concrete.`,
      baseQuantity: takeoff.footingM3,
      baseUnit: "m3",
      wasteFactor: 0,
      purchaseQuantity: takeoff.footingM3,
      purchaseUnit: "m3",
    }),
    planningMaterial({
      ...common,
      componentKey: RW_MASONRY_SUBBASE_COMPONENT,
      description: "Compacted sub-base",
      materialKey: RW_SUBBASE_KEY,
      category: "AGGREGATE",
      specification: `${takeoff.subbaseM3} m³ material; compaction driver ${takeoff.subbaseM2} m².`,
      baseQuantity: takeoff.subbaseM3,
      baseUnit: "m3",
      wasteFactor: 0,
      purchaseQuantity: takeoff.subbaseM3,
      purchaseUnit: "m3",
    }),
  ];

  if (takeoff.netBlocks != null && takeoff.series) {
    const purchase = round2(takeoff.netBlocks * (1 + params.inputs.wasteFactor));
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_MASONRY_BLOCKS_COMPONENT,
        description: `${takeoff.series.series}-series masonry blocks`,
        materialKey: takeoff.series.materialKey,
        identity: takeoff.series.identity,
        category: "MASONRY",
        specification: `${takeoff.netBlocks} net blocks from ${params.geometry.faceAreaM2} m² × ${takeoff.series.unitsPerM2} / m².`,
        baseQuantity: takeoff.netBlocks,
        baseUnit: "ea",
        wasteFactor: params.inputs.wasteFactor,
        purchaseQuantity: purchase,
        purchaseUnit: "ea",
      })
    );
  }

  if (takeoff.coreFillM3 != null) {
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_MASONRY_CORE_COMPONENT,
        description: "Core fill concrete",
        materialKey: RW_CORE_FILL_KEY,
        category: "CONCRETE",
        specification: `${takeoff.coreFillM3} m³ core fill (block count / blocks per m³). Volume, not m².`,
        baseQuantity: takeoff.coreFillM3,
        baseUnit: "m3",
        wasteFactor: 0,
        purchaseQuantity: takeoff.coreFillM3,
        purchaseUnit: "m3",
      })
    );
  }

  if (takeoff.waterproofingM2 != null) {
    const sheet = (params.inputs.waterproofingType ?? "")
      .toLowerCase()
      .includes("sheet");
    const qty = sheet
      ? takeoff.waterproofingM2
      : takeoff.waterproofingLitres ?? takeoff.waterproofingM2;
    const unit = sheet ? "m2" : "L";
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_MASONRY_WATERPROOF_COMPONENT,
        description: sheet
          ? "Sheet waterproofing membrane"
          : "Liquid waterproofing membrane",
        materialKey: sheet
          ? RW_WATERPROOFING_SHEET_KEY
          : RW_WATERPROOFING_LIQUID_KEY,
        category: "WATERPROOFING",
        specification: sheet
          ? `${takeoff.waterproofingM2} m² wall face plus waste/laps from product metadata.`
          : `${takeoff.waterproofingLitres} L at ${RW_DEFAULT_LIQUID_COVERAGE_L_PER_M2} L/m² starter coverage.`,
        baseQuantity: qty,
        baseUnit: unit,
        wasteFactor: sheet ? params.inputs.wasteFactor : 0,
        purchaseQuantity: sheet
          ? round2(qty * (1 + params.inputs.wasteFactor))
          : qty,
        purchaseUnit: unit,
      })
    );
  }

  if (takeoff.horizontalRebarLm != null) {
    requirements.push(
      planningMaterial({
        ...common,
        componentKey: RW_MASONRY_REBAR_COMPONENT,
        description: "Horizontal reinforcement",
        materialKey: RW_REBAR_KEY,
        category: "REINFORCEMENT",
        specification: `${takeoff.horizontalRebarLm} lm from wall length × stated run count. Not an engineering schedule.`,
        baseQuantity: takeoff.horizontalRebarLm,
        baseUnit: "lm",
        wasteFactor: 0,
        purchaseQuantity: takeoff.horizontalRebarLm,
        purchaseUnit: "lm",
      })
    );
  }

  return { requirements, assumptions, takeoff };
}
