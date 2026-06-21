import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { FENCE_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
  getStringFact,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
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
  };
}

export function calculateFence(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "fence.length_m");
  const height = getNumberFact(facts, workArea.id, "fence.height_m");
  const material = getStringFact(facts, workArea.id, "fence.material");

  if (!length) missingInfo.push(formatMissing("Fence length"));
  if (!height) missingInfo.push(formatMissing("Fence height"));
  if (!material) missingInfo.push(formatMissing("Fence material"));

  const effectiveLength = length ?? 18;
  if (!length) {
    assumptions.push("Using assumed fence length of 18 m for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getLabourAdjustmentFactor(context.constraints);
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
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  const materialRates = getFenceMaterialRates(material, context);
  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Fence materials",
      category: "materials",
      quantity: effectiveLength,
      unit: "lm",
      costRate: materialRates.cost,
      sellRate: materialRates.sell,
      rateSource: materialRates.rateSource,
      notes: height ? `${height} m high fence` : undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (getBooleanFact(facts, workArea.id, "fence.gate_included")) {
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
        quantity: 1,
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
        label: "Gate allowance",
        recommendedCost: gateRates.costRate,
        recommendedSell: gateRates.sellRate,
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
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}
