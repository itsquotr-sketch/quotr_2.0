import { getQualityFactor, getQualityFactorNote } from "@/lib/estimate/adjustments";
import { KITCHEN_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getFinishLevel,
  getNumberFact,
  getStringFact,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createFixedLabourLineItem,
  createLabourLineItem,
} from "@/lib/estimate/line-items";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

export function calculateKitchen(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions = [
    "Structural changes",
    "Consent unless confirmed",
    "Final finish selections beyond allowance",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, "kitchen.area_m2");
  if (!area) missingInfo.push(formatMissing("Kitchen area"));

  const finishLevel = getFinishLevel(
    facts,
    workArea.id,
    "kitchen",
    context.project.qualityLevel
  );

  if (
    !getStringFact(facts, workArea.id, "kitchen.finish_level") &&
    context.project.qualityLevel &&
    context.project.qualityLevel !== "unknown"
  ) {
    assumptions.push(`Finish level from project spec: ${finishLevel}.`);
  }

  const qualityNote = getQualityFactorNote(context.project);
  if (qualityNote) {
    assumptions.push(qualityNote);
  }

  const effectiveArea = area ?? 10;
  if (!area) {
    assumptions.push("Using assumed kitchen area of 10 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  // Quality factor applies once to material/allowance lines only (not labour).
  // Benchmark allowances are calibrated at standard spec; premium/budget scales cabinetry/finishes.
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const packageProductivity = resolveProductivity({
    productivityKey: "kitchen.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 16,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Kitchen labour",
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: packageProductivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      rateSource: labourRate.sourceLabel,
      notes: `Finish level: ${finishLevel}`,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  if (getBooleanFact(facts, workArea.id, "kitchen.demolition_required")) {
    const demo = resolveProductivity({
      productivityKey: "kitchen.demolition_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 8,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Demolition/strip-out",
        labourHours: demo.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: demo.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.cabinetry_included")) {
    const cabinetry = resolveProductivity({
      productivityKey: "kitchen.cabinetry_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 20,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Cabinetry labour allowance",
        labourHours: cabinetry.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: cabinetry.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Cabinetry allowance",
        recommendedCost: KITCHEN_BENCHMARKS.cabinetry.cost,
        recommendedSell: KITCHEN_BENCHMARKS.cabinetry.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Cabinetry scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.benchtop_included")) {
    const benchtop = resolveProductivity({
      productivityKey: "kitchen.benchtop_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 6,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Benchtop labour allowance",
        labourHours: benchtop.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: benchtop.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Benchtop allowance",
        recommendedCost: KITCHEN_BENCHMARKS.benchtop.cost,
        recommendedSell: KITCHEN_BENCHMARKS.benchtop.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Benchtop scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.plumbing_required")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Plumbing allowance",
        category: "subcontractor",
        recommendedCost: KITCHEN_BENCHMARKS.plumbing.cost,
        recommendedSell: KITCHEN_BENCHMARKS.plumbing.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Plumbing scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.electrical_required")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Electrical allowance",
        category: "subcontractor",
        recommendedCost: KITCHEN_BENCHMARKS.electrical.cost,
        recommendedSell: KITCHEN_BENCHMARKS.electrical.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Electrical scope"));
  }

  let materialsCost = effectiveArea * KITCHEN_BENCHMARKS.materialsPerM2.cost;
  let materialsSell = effectiveArea * KITCHEN_BENCHMARKS.materialsPerM2.sell;
  materialsCost = Math.max(
    materialsCost,
    KITCHEN_BENCHMARKS.minimumPackage.cost
  );
  materialsSell = Math.max(
    materialsSell,
    KITCHEN_BENCHMARKS.minimumPackage.sell
  );

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Kitchen materials/finishes allowance",
      category: "materials",
      recommendedCost: materialsCost,
      recommendedSell: materialsSell,
      rateSource: "Benchmark allowance",
      notes: `Rough kitchen package allowance · Finish level: ${finishLevel}`,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
  };
}
