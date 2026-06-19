import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
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

  const wasteRequired =
    getBooleanFact(facts, workArea.id, "demolition.waste_removal_required") ??
    true;

  if (wasteRequired) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waste removal/disposal allowance",
        category: "allowance",
        quantity: effectiveArea,
        unit: "m²",
        costRate: 25,
        sellRate: 40,
        rateSource: "Benchmark allowance",
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
      recommendedCost: 800,
      recommendedSell: 1200,
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
