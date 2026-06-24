import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { DEMOLITION_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getArrayFact,
  getBooleanFact,
  getBooleanFactAny,
  getNumberFact,
  round2,
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

export function calculateDemolition(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, "demolition.area_m2");
  if (!area) missingInfo.push(formatMissing("Demolition area"));

  const effectiveArea = area ?? 25;
  if (!area) {
    assumptions.push("Using assumed demolition area of 25 m² for rough estimate.");
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

  const demoProductivity = resolveProductivity({
    productivityKey: "demolition.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.35,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Demolition/strip-out labour",
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: demoProductivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  const scopeItems = getArrayFact(facts, workArea.id, "demolition.scope_items");
  if (scopeItems.length > 0) {
    assumptions.push(`Demolition scope: ${scopeItems.join(", ")}.`);
    const itemFactor = Math.min(scopeItems.length * 0.15 + 0.85, 1.6);
    lineItems[0] = {
      ...lineItems[0],
      quantity: round2(effectiveArea * itemFactor),
      notes: scopeItems.join(", "),
    };
  }

  const wasteRequired =
    getBooleanFactAny(facts, workArea.id, [
      "demolition.disposal_included",
      "demolition.waste_removal_required",
    ]) ?? true;

  if (wasteRequired) {
    const wasteRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "demolition.waste.m2",
      workAreaType: "demolition",
      unit: "m2",
      fallbackCostRate: DEMOLITION_BENCHMARKS.wastePerM2.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.wastePerM2.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waste removal/disposal allowance",
        category: "allowance",
        quantity: effectiveArea,
        unit: "m²",
        costRate: wasteRates.costRate,
        sellRate: wasteRates.sellRate,
        rateSource: wasteRates.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Waste removal scope"));
  }

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Demolition minimum allowance",
      recommendedCost: DEMOLITION_BENCHMARKS.minimum.cost,
      recommendedSell: DEMOLITION_BENCHMARKS.minimum.sell,
      rateSource: "Benchmark allowance",
      notes: "Minimum strip-out allowance applied",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}
