import { getQualityFactor } from "@/lib/estimate/adjustments";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
  getStringFact,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createFixedLabourLineItem,
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

export function calculateBathroom(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions = [
    "Structural changes",
    "Consent unless confirmed",
    "Final fixture selections beyond allowance",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, "bathroom.area_m2");
  if (!area) missingInfo.push(formatMissing("Bathroom area"));

  const tileExtent = getStringFact(facts, workArea.id, "bathroom.tile_extent");
  if (!tileExtent) missingInfo.push(formatMissing("Tiling extent"));

  const effectiveArea = area ?? 5;
  if (!area) {
    assumptions.push("Using assumed bathroom area of 5 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const packageProductivity = resolveProductivity({
    productivityKey: "bathroom.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 22,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Bathroom labour",
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: packageProductivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  if (getBooleanFact(facts, workArea.id, "bathroom.demolition_required")) {
    const demo = resolveProductivity({
      productivityKey: "bathroom.demolition_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 8,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Demolition/strip-out",
        labourHours: demo.hoursPerUnit * qualityFactor,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: demo.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "bathroom.waterproofing_required")) {
    const waterproofing = resolveProductivity({
      productivityKey: "bathroom.waterproofing_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 6,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waterproofing labour",
        labourHours: waterproofing.hoursPerUnit * qualityFactor,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: waterproofing.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waterproofing allowance",
        category: "subcontractor",
        recommendedCost: 1200,
        recommendedSell: 1800,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  const tilingProductivity = resolveProductivity({
    productivityKey: "bathroom.tiling_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 2.0,
  });

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Tiling allowance",
      category: "subcontractor",
      quantity: effectiveArea,
      unit: "m²",
      costRate: 180,
      sellRate: 280,
      rateSource: "Benchmark allowance",
      notes: tileExtent ?? "Tiling extent allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  assumptions.push(
    `Tiling productivity benchmark: ${tilingProductivity.hoursPerUnit} hrs/m² where applicable.`
  );

  let fixturesCost = 0;
  let fixturesSell = 0;
  if (getBooleanFact(facts, workArea.id, "bathroom.includes_vanity")) {
    fixturesCost += 900;
    fixturesSell += 1400;
  } else {
    missingInfo.push(formatMissing("Vanity scope"));
  }
  if (getBooleanFact(facts, workArea.id, "bathroom.includes_shower")) {
    fixturesCost += 1200;
    fixturesSell += 1800;
  } else {
    missingInfo.push(formatMissing("Shower scope"));
  }
  if (getBooleanFact(facts, workArea.id, "bathroom.includes_toilet")) {
    fixturesCost += 700;
    fixturesSell += 1100;
  } else {
    missingInfo.push(formatMissing("Toilet scope"));
  }

  if (fixturesCost > 0) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Fixtures allowance",
        recommendedCost: fixturesCost,
        recommendedSell: fixturesSell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  let materialsCost = effectiveArea * 1800;
  let materialsSell = effectiveArea * 2600;
  materialsCost = Math.max(materialsCost, 18000);
  materialsSell = Math.max(materialsSell, 25000);

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Bathroom materials/finishes allowance",
      category: "materials",
      recommendedCost: materialsCost,
      recommendedSell: materialsSell,
      rateSource: "Benchmark allowance",
      notes: "Rough bathroom package allowance",
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
