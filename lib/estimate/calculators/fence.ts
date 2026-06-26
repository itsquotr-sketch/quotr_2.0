import {
  getFenceHeightMaterialFactor,
  getLabourAdjustmentFactor,
  getQualityFactor,
  getSlopeLabourFactor,
  getWorkAreaAccessFactor,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { FENCE_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
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
import { benchmarkRateFields } from "@/lib/estimate/line-item-helpers";
import {
  createFenceScopeBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import {
  createAssumptionMetadata,
  recordDefaultedNumber,
} from "@/lib/estimate/assumption-metadata";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function getFenceMaterialRates(material: string | null, context: EstimateContext) {
  const normalized = material?.toLowerCase() ?? "";
  if (
    normalized.includes("metal") ||
    normalized.includes("composite")
  ) {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "fence.material.metal.lm",
      workAreaType: "fence",
      unit: "lm",
      fallbackCostRate: FENCE_BENCHMARKS.metalPerLm.cost,
      fallbackSellRate: FENCE_BENCHMARKS.metalPerLm.sell,
      organisationSettings: context.organisationSettings,
    });
    return {
      cost: resolved.costRate,
      sell: resolved.sellRate,
      rateSource: resolved.sourceLabel,
      materialLabel: normalized.includes("composite") ? "composite" : "metal",
    };
  }

  const resolved = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "fence.material.timber.lm",
    workAreaType: "fence",
    unit: "lm",
    fallbackCostRate: FENCE_BENCHMARKS.timberPerLm.cost,
    fallbackSellRate: FENCE_BENCHMARKS.timberPerLm.sell,
    organisationSettings: context.organisationSettings,
  });

  return {
    cost: resolved.costRate,
    sell: resolved.sellRate,
    rateSource: resolved.sourceLabel,
    materialLabel: "timber",
  };
}

export function calculateFence(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "fence.length_m");
  const height = getNumberFact(facts, workArea.id, "fence.height_m");
  const material = getStringFact(facts, workArea.id, "fence.material");

  if (!length) missingInfo.push(formatMissing("Fence length"));
  if (!height) missingInfo.push(formatMissing("Fence height"));
  if (!material) missingInfo.push(formatMissing("Fence material"));

  let effectiveLength = length;
  if (!effectiveLength) {
    effectiveLength = recordDefaultedNumber(assumptionMetadata, {
      key: "fence.length_m",
      label: "Fence length",
      workAreaId: workArea.id,
      assumedValue: 18,
      unit: "m",
      reason: "No fence length provided",
    });
    assumptions.push("Using assumed fence length of 18 m for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment =
    getLabourAdjustmentFactor(context.constraints) *
    getWorkAreaAccessFactor(getStringFact(facts, workArea.id, "fence.access")) *
    getSlopeLabourFactor(
      getStringFact(facts, workArea.id, "fence.slope_condition")
    );

  const slope = getStringFact(facts, workArea.id, "fence.slope_condition");
  if (slope?.toLowerCase().includes("steep") || slope?.toLowerCase().includes("slop")) {
    assumptions.push("Sloping ground adds labour productivity allowance.");
  }

  const boundaryStatus = getStringFact(
    facts,
    workArea.id,
    "fence.boundary_approval_status"
  );
  if (boundaryStatus?.toLowerCase().includes("pending")) {
    assumptions.push("Boundary/neighbour approval is pending confirmation.");
  } else if (boundaryStatus?.toLowerCase().includes("not sure")) {
    exclusions.push("Boundary survey and neighbour approvals excluded unless confirmed.");
  }

  const servicesRisk = getStringFact(facts, workArea.id, "fence.services_risk");
  if (
    servicesRisk?.toLowerCase().includes("possible") ||
    servicesRisk?.toLowerCase().includes("known")
  ) {
    assumptions.push(
      "Underground services may affect post footing locations — subject to confirmation."
    );
  }

  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const fenceProductivity = resolveProductivity({
    productivityKey: "fence.labour_hours_per_lm",
    unit: "lm",
    fallbackHoursPerUnit: 0.6,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Fence labour",
      quantity: effectiveLength,
      unit: "lm",
      productivityHoursPerUnit: fenceProductivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      notes: height ? `${height} m high fence` : undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  const materialRates = getFenceMaterialRates(material, context);
  const heightFactor = getFenceHeightMaterialFactor(height);
  const adjustedCostRate = round2(materialRates.cost * heightFactor);
  const adjustedSellRate = round2(materialRates.sell * heightFactor);

  const fenceBuildUp =
    length && height
      ? createFenceScopeBuildUp({
          lengthLm: effectiveLength,
          heightM: height,
          materialLabel: materialRates.materialLabel,
        })
      : null;

  lineItems.push(
    withMaterialBuildUp(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Fence materials",
        category: "materials",
        quantity: effectiveLength,
        unit: "lm",
        costRate: adjustedCostRate,
        sellRate: adjustedSellRate,
        rateSource: materialRates.rateSource,
        notes: height
          ? `${height} m high · height factor ${heightFactor.toFixed(2)}`
          : undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      }),
      fenceBuildUp
    )
  );

  if (getBooleanFact(facts, workArea.id, "fence.gate_included")) {
    const gateCount =
      getNumberFact(facts, workArea.id, "fence.gate_count") ?? 1;
    const gateProductivity = resolveProductivity({
      productivityKey: "fence.gate_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 2,
    });
    const gateRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "fence.gate.allowance",
      workAreaType: "fence",
      unit: "allowance",
      fallbackCostRate: FENCE_BENCHMARKS.gate.cost,
      fallbackSellRate: FENCE_BENCHMARKS.gate.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Gate labour allowance",
        quantity: gateCount,
        unit: "allowance",
        productivityHoursPerUnit: gateProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
        rateSource: gateProductivity.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: gateCount > 1 ? `Gate allowance (×${gateCount})` : "Gate allowance",
        recommendedCost: round2(gateRates.costRate * gateCount),
        recommendedSell: round2(gateRates.sellRate * gateCount),
        rateSource: gateRates.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "fence.demolition_required")) {
    const demoProductivity = resolveProductivity({
      productivityKey: "fence.demolition_hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0.25,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing fence removal",
        quantity: effectiveLength,
        unit: "lm",
        productivityHoursPerUnit: demoProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        rateSource: demoProductivity.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    if (getBooleanFact(facts, workArea.id, "fence.disposal_required")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fence disposal allowance",
          recommendedCost: FENCE_BENCHMARKS.disposalAllowance.cost,
          recommendedSell: FENCE_BENCHMARKS.disposalAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor: NO_FINISH_QUALITY_FACTOR,
        })
      );
    }
  }

  const finishRequired = getBooleanFact(facts, workArea.id, "fence.finish_required");
  if (finishRequired === true) {
    const finishType = getStringFact(facts, workArea.id, "fence.finish_type");
    const finishSides = getStringFact(facts, workArea.id, "fence.finish_sides");
    const sideFactor =
      finishSides?.includes("both") ? 2 : finishSides?.includes("one") ? 1 : 1.5;

    const finishRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "fence.finish.lm",
      workAreaType: "fence",
      unit: "lm",
      fallbackCostRate: FENCE_BENCHMARKS.finishAllowanceLm.cost,
      fallbackSellRate: FENCE_BENCHMARKS.finishAllowanceLm.sell,
      organisationSettings: context.organisationSettings,
    });

    const finishQuantity = round2(effectiveLength * sideFactor);
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Fence painting/staining allowance",
        category: "allowance",
        recommendedCost: round2(finishRates.costRate * finishQuantity),
        recommendedSell: round2(finishRates.sellRate * finishQuantity),
        rateSource: finishRates.sourceLabel,
        notes: [
          finishType ? `${finishType} finish` : null,
          finishSides ? `${finishSides.replace(/_/g, " ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Finish allowance placeholder",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    assumptions.push(
      "Final fence finish scope and surface preparation are subject to confirmation."
    );
  } else if (finishRequired === false) {
    exclusions.push("Final painting or staining of the fence is excluded.");
  } else if (finishRequired === null) {
    exclusions.push("Final painting or staining excluded unless stated.");
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
  };
}
