import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
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
import { resolveLabourRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function getFenceMaterialRates(material: string | null) {
  const normalized = material?.toLowerCase() ?? "";
  if (
    normalized.includes("metal") ||
    normalized.includes("composite")
  ) {
    return { cost: 140, sell: 220 };
  }
  return { cost: 90, sell: 140 };
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

  const materialRates = getFenceMaterialRates(material);
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
      rateSource: "Benchmark allowance",
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
        recommendedCost: 450,
        recommendedSell: 700,
        rateSource: "Benchmark allowance",
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
        qualityFactor,
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
