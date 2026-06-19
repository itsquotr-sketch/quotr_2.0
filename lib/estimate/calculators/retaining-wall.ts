import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
  hasPoorAccess,
} from "@/lib/estimate/adjustments";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function resolveWallHeight(
  facts: EstimateContext["facts"],
  workAreaId: string
): { height: number | null; assumptions: string[] } {
  const assumptions: string[] = [];
  const directHeight = getNumberFact(
    facts,
    workAreaId,
    "retaining_wall.height_m"
  );
  if (directHeight) {
    return { height: directHeight, assumptions };
  }

  const high = getNumberFact(facts, workAreaId, "retaining_wall.height_high_m");
  const low = getNumberFact(facts, workAreaId, "retaining_wall.height_low_m");
  if (high != null && low != null) {
    assumptions.push("Average retaining wall height calculated from high/low points.");
    return { height: round2((high + low) / 2), assumptions };
  }

  return { height: null, assumptions };
}

function getWallMaterialRates(material: string | null) {
  const normalized = material?.toLowerCase() ?? "";
  if (
    normalized.includes("concrete") ||
    normalized.includes("block")
  ) {
    return { cost: 400, sell: 600 };
  }
  return { cost: 220, sell: 330 };
}

export function calculateRetainingWall(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions = ["Engineering/consent unless confirmed"];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "retaining_wall.length_m");
  if (!length) missingInfo.push(formatMissing("Wall length"));

  const heightResult = resolveWallHeight(facts, workArea.id);
  assumptions.push(...heightResult.assumptions);
  if (!heightResult.height) missingInfo.push(formatMissing("Wall height"));

  const material = getStringFact(facts, workArea.id, "retaining_wall.material");
  if (!material) missingInfo.push(formatMissing("Wall material"));

  const effectiveLength = length ?? 10;
  const effectiveHeight = heightResult.height ?? 1.5;
  if (!length || !heightResult.height) {
    assumptions.push("Using assumed retaining wall dimensions for rough estimate.");
  }

  const faceArea = round2(effectiveLength * effectiveHeight);
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getLabourAdjustmentFactor(context.constraints);
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const baseProductivity = resolveProductivity({
    productivityKey: "retaining_wall.base_labour_hours_per_face_m2",
    unit: "face m²",
    fallbackHoursPerUnit: 2.0,
  });

  let labourHoursPerFaceM2 = baseProductivity.hoursPerUnit;

  if (getBooleanFact(facts, workArea.id, "retaining_wall.excavation_required")) {
    const excavation = resolveProductivity({
      productivityKey: "retaining_wall.excavation_hours_per_face_m2",
      unit: "face m²",
      fallbackHoursPerUnit: 0.6,
    });
    labourHoursPerFaceM2 += excavation.hoursPerUnit;
  }

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Retaining wall labour",
      quantity: faceArea,
      unit: "face m²",
      productivityHoursPerUnit: labourHoursPerFaceM2,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      notes: getConstraintNotes(context.constraints) || undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  if (getBooleanFact(facts, workArea.id, "retaining_wall.drainage_required")) {
    const drainage = resolveProductivity({
      productivityKey: "retaining_wall.drainage_hours_per_m",
      unit: "m",
      fallbackHoursPerUnit: 0.4,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Drainage labour",
        quantity: effectiveLength,
        unit: "m",
        productivityHoursPerUnit: drainage.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
        rateSource: drainage.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
  } else {
    missingInfo.push(formatMissing("Drainage scope"));
  }

  const materialRates = getWallMaterialRates(material);
  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Retaining wall materials",
      category: "materials",
      quantity: faceArea,
      unit: "face m²",
      costRate: materialRates.cost,
      sellRate: materialRates.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (getBooleanFact(facts, workArea.id, "retaining_wall.drainage_required")) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Drainage allowance",
        category: "materials",
        quantity: effectiveLength,
        unit: "m",
        costRate: 45,
        sellRate: 75,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "retaining_wall.backfill_included")) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Backfill allowance",
        category: "materials",
        quantity: faceArea,
        unit: "face m²",
        costRate: 60,
        sellRate: 95,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Backfill scope"));
  }

  const cartingDistance = getNumberFact(
    facts,
    workArea.id,
    "retaining_wall.carting_distance_m"
  );
  const access = getStringFact(facts, workArea.id, "retaining_wall.access");

  if (cartingDistance || access || hasPoorAccess(context.constraints)) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Carting/material handling allowance",
        recommendedCost: cartingDistance && cartingDistance > 30 ? 1200 : 700,
        recommendedSell: cartingDistance && cartingDistance > 30 ? 1800 : 1050,
        rateSource: "Benchmark allowance",
        notes: [
          cartingDistance ? `${cartingDistance} m carting distance` : null,
          access ? `${access} access` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
  };
}
