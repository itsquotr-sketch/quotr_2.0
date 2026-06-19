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
  createFixedLabourLineItem,
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

export function calculateExternalStairs(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const riserCount = getNumberFact(
    facts,
    workArea.id,
    "external_stairs.riser_count"
  );
  const material = getStringFact(facts, workArea.id, "external_stairs.material");
  const handrailRequired = getBooleanFact(
    facts,
    workArea.id,
    "external_stairs.handrail_required"
  );

  if (!riserCount) missingInfo.push(formatMissing("Riser count"));
  if (!material) missingInfo.push(formatMissing("Stair material"));
  if (handrailRequired == null) {
    missingInfo.push(formatMissing("Handrail requirement"));
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

  if (riserCount) {
    const stairProductivity = resolveProductivity({
      productivityKey: "external_stairs.labour_hours_per_riser",
      unit: "riser",
      fallbackHoursPerUnit: 1.5,
    });

    const labourHours =
      riserCount *
      stairProductivity.hoursPerUnit *
      labourAdjustment *
      qualityFactor;

    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "External stair labour",
        labourHours,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: labourRate.sourceLabel,
        notes: `${riserCount} risers × ${stairProductivity.hoursPerUnit} hrs/riser`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "External stair materials",
        category: "materials",
        quantity: riserCount,
        unit: "riser",
        costRate: 90,
        sellRate: 140,
        rateSource: "Benchmark allowance",
        notes: material ?? undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    assumptions.push("Using rough external stair allowance due to missing riser count.");
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "External stair rough allowance",
        recommendedCost: 1200,
        recommendedSell: 1800,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (handrailRequired) {
    const handrailProductivity = resolveProductivity({
      productivityKey: "external_stairs.handrail_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 3,
    });

    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Handrail labour allowance",
        labourHours:
          handrailProductivity.hoursPerUnit * labourAdjustment * qualityFactor,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: handrailProductivity.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Handrail allowance",
        recommendedCost: 350,
        recommendedSell: 550,
        rateSource: "Benchmark allowance",
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
    exclusions: [],
    confidence: baseConfidence(missingInfo.length + (riserCount ? 0 : 2)),
  };
}
