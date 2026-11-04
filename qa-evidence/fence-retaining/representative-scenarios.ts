/**
 * One representative fence scenario and one retaining-wall scenario.
 * Declared live model calls: 0. Facts are the existing family-closure contracts.
 * No application file is edited.
 */
import { calculateFence } from "../../lib/estimate/calculators/fence";
import { calculateRetainingWall } from "../../lib/estimate/calculators/retaining-wall";
import { buildFencePhysicalModel } from "../../lib/estimate/fence-physical";
import {
  faceAreaM2,
  resolveRetainingWallGeometry,
} from "../../lib/estimate/retaining-wall-geometry";
import { buildRetainingWallPhysicalModel } from "../../lib/estimate/retaining-wall-physical";
import type { EstimateContext, EstimateFact, EstimateWorkArea } from "../../lib/estimate/types";

function fact(key: string, value: unknown, workAreaId: string): EstimateFact {
  return { key, work_area_id: workAreaId, value };
}

function workArea(id: string, type: EstimateWorkArea["type"], name: string): EstimateWorkArea {
  return { id, type, name, sort_order: 1, status: "confirmed" };
}

function context(
  area: EstimateWorkArea,
  facts: EstimateFact[],
  wastage: EstimateContext["materialWastageSettings"]
): EstimateContext {
  return {
    project: { id: "qa-scenario", qualityLevel: "standard" },
    confirmedWorkAreas: [area],
    facts,
    constraints: [
      { key: "site_access", value: "Moderate" },
      { key: "material_carry_distance", value: "10–30m" },
    ],
    organisationSettings: {
      allow_benchmark_rates: true,
      default_margin_percent: 20,
    },
    materialWastageSettings: wastage,
    rates: [],
  } as unknown as EstimateContext;
}

const fenceArea = workArea("fence-scenario", "fence", "QA fence");
const fenceFacts: EstimateFact[] = [
  fact("fence.length_m", 18, fenceArea.id),
  fact("fence.height_m", 1.8, fenceArea.id),
  fact("fence.system", "Timber paling — vertical board", fenceArea.id),
  fact("fence.timber_species", "Radiata Pine", fenceArea.id),
  fact("fence.board_thickness_mm", "150 × 19mm", fenceArea.id),
  fact("fence.post_spacing_m", 1.8, fenceArea.id),
  fact("fence.gate_included", true, fenceArea.id),
  fact("fence.gate_count", 1, fenceArea.id),
  fact("fence.gate_width_m", 0.9, fenceArea.id),
  fact("fence.gate_position", "Within the fence run", fenceArea.id),
  fact("fence.top_capping", "Yes", fenceArea.id),
  fact("fence.gate_capping", "Yes", fenceArea.id),
  fact("fence.vertical_paling_gap_mm", 0, fenceArea.id),
];
const expectedFenceFace = 18 * 1.8;
const fence = calculateFence(context(fenceArea, fenceFacts, null), fenceArea);
const fencePhysical = buildFencePhysicalModel({
  context: context(fenceArea, fenceFacts, null),
  workAreaId: fenceArea.id,
});

const wallArea = workArea("retaining-scenario", "retaining_wall", "QA retaining wall");
const wallFacts: EstimateFact[] = [
  fact("retaining_wall.length_m", 15, wallArea.id),
  fact("retaining_wall.is_raking", true, wallArea.id),
  fact("retaining_wall.height_high_m", 1.6, wallArea.id),
  fact("retaining_wall.height_low_m", 0.6, wallArea.id),
  fact("retaining_wall.material", "Timber", wallArea.id),
  fact("retaining_wall.pile_material", "H5 SED retaining pole", wallArea.id),
  fact("retaining_wall.backfill_included", true, wallArea.id),
  fact("retaining_wall.excavation_required", true, wallArea.id),
  fact("retaining_wall.excavation_volume_m3", 6, wallArea.id),
  fact("retaining_wall.digger_access", "Yes", wallArea.id),
  fact("retaining_wall.drainage_required", true, wallArea.id),
  fact("retaining_wall.drainage_sock_required", "No", wallArea.id),
  fact("retaining_wall.disposal_included", false, wallArea.id),
];
const expectedWallFace = faceAreaM2(15, 1.6, 0.6);
const wall = calculateRetainingWall(
  context(wallArea, wallFacts, { defaultMaterialWastagePercent: 10 }),
  wallArea
);
const wallGeometry = resolveRetainingWallGeometry({
  lengthM: 15,
  heightM: null,
  heightHighM: 1.6,
  heightLowM: 0.6,
});
const wallPhysical = buildRetainingWallPhysicalModel({
  context: context(wallArea, wallFacts, { defaultMaterialWastagePercent: 10 }),
  workAreaId: wallArea.id,
});

function lines(result: { lineItems: { componentKey?: string; label: string; quantity: number; recommendedCost: number | null; recommendedSell: number | null }[] }) {
  return result.lineItems.map((item) => ({
    componentKey: item.componentKey ?? null,
    label: item.label,
    quantity: item.quantity,
    recommendedCost: item.recommendedCost,
    recommendedSell: item.recommendedSell,
  }));
}

console.log(
  JSON.stringify(
    {
      declaredLiveModelCalls: 0,
      fence: {
        expectedFaceM2: expectedFenceFace,
        actualFaceM2: fencePhysical.geometry?.faceAreaM2 ?? null,
        postCount: fencePhysical.timber?.postCount ?? null,
        lineCount: fence.lineItems.length,
        packageLines: fence.lineItems.filter((item) => item.label === "Fence materials" || item.label === "Fence labour").length,
        lines: lines(fence),
      },
      retainingWall: {
        expectedFaceM2: expectedWallFace,
        geometryFaceM2: wallGeometry.faceAreaM2,
        readiness: wallGeometry.readiness,
        physicalFaceM2: wallPhysical.geometry?.faceAreaM2 ?? null,
        lineCount: wall.lineItems.length,
        lines: lines(wall),
      },
    },
    null,
    2
  )
);
