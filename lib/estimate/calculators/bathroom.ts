import { getQualityFactor, getQualityFactorNote } from "@/lib/estimate/adjustments";
import { BATHROOM_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
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
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { rateFieldsFromResolved } from "@/lib/estimate/line-item-helpers";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
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

  const finishLevel = getFinishLevel(
    facts,
    workArea.id,
    "bathroom",
    context.project.qualityLevel
  );

  if (
    !getStringFact(facts, workArea.id, "bathroom.finish_level") &&
    context.project.qualityLevel &&
    context.project.qualityLevel !== "unknown"
  ) {
    assumptions.push(`Finish level from project spec: ${finishLevel}.`);
  }

  const qualityNote = getQualityFactorNote(context.project);
  if (qualityNote) {
    assumptions.push(qualityNote);
  }

  const effectiveArea = area ?? 5;
  if (!area) {
    assumptions.push("Using assumed bathroom area of 5 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  // Quality factor applies once to material/allowance lines only (not labour).
  // Benchmark allowances are calibrated at standard spec; premium/budget scales finishes/fixtures.
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
      rateSource: labourRate.sourceLabel,
      notes: `Finish level: ${finishLevel}`,
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
        labourHours: demo.hoursPerUnit,
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
        labourHours: waterproofing.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: waterproofing.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    const waterproofingRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "bathroom.waterproofing.allowance",
      workAreaType: "bathroom",
      unit: "allowance",
      fallbackCostRate: BATHROOM_BENCHMARKS.waterproofing.cost,
      fallbackSellRate: BATHROOM_BENCHMARKS.waterproofing.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waterproofing allowance",
        category: "subcontractor",
        recommendedCost: waterproofingRates.costRate,
        recommendedSell: waterproofingRates.sellRate,
        rateSource: waterproofingRates.sourceLabel,
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

  const tilingRates = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "bathroom.tiling.m2",
    workAreaType: "bathroom",
    unit: "m2",
    fallbackCostRate: BATHROOM_BENCHMARKS.tilingPerM2.cost,
    fallbackSellRate: BATHROOM_BENCHMARKS.tilingPerM2.sell,
    organisationSettings: context.organisationSettings,
  });

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Tiling allowance",
      category: "subcontractor",
      quantity: effectiveArea,
      unit: "m²",
      costRate: tilingRates.costRate,
      sellRate: tilingRates.sellRate,
      rateSource: tilingRates.sourceLabel,
      notes: tileExtent
        ? `${tileExtent} · productivity ${tilingProductivity.hoursPerUnit} hrs/m²`
        : `Tiling extent allowance · productivity ${tilingProductivity.hoursPerUnit} hrs/m²`,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  let fixturesCost = 0;
  let fixturesSell = 0;

  if (getBooleanFact(facts, workArea.id, "bathroom.includes_vanity")) {
    fixturesCost += BATHROOM_BENCHMARKS.vanity.cost;
    fixturesSell += BATHROOM_BENCHMARKS.vanity.sell;
  } else {
    missingInfo.push(formatMissing("Vanity scope"));
  }
  if (getBooleanFact(facts, workArea.id, "bathroom.includes_shower")) {
    fixturesCost += BATHROOM_BENCHMARKS.shower.cost;
    fixturesSell += BATHROOM_BENCHMARKS.shower.sell;
  } else {
    missingInfo.push(formatMissing("Shower scope"));
  }
  if (getBooleanFact(facts, workArea.id, "bathroom.includes_toilet")) {
    fixturesCost += BATHROOM_BENCHMARKS.toilet.cost;
    fixturesSell += BATHROOM_BENCHMARKS.toilet.sell;
  } else {
    missingInfo.push(formatMissing("Toilet scope"));
  }

  if (fixturesCost > 0) {
    const fixturesRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "bathroom.fixtures.allowance",
      workAreaType: "bathroom",
      unit: "allowance",
      fallbackCostRate: fixturesCost,
      fallbackSellRate: fixturesSell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Fixtures allowance",
        recommendedCost: fixturesRates.costRate,
        recommendedSell: fixturesRates.sellRate,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
        ...rateFieldsFromResolved(fixturesRates),
      })
    );
  }

  let materialsCost =
    effectiveArea * BATHROOM_BENCHMARKS.materialsPerM2.cost;
  let materialsSell =
    effectiveArea * BATHROOM_BENCHMARKS.materialsPerM2.sell;
  materialsCost = Math.max(
    materialsCost,
    BATHROOM_BENCHMARKS.minimumPackage.cost
  );
  materialsSell = Math.max(
    materialsSell,
    BATHROOM_BENCHMARKS.minimumPackage.sell
  );

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Bathroom materials/finishes allowance",
      category: "materials",
      recommendedCost: materialsCost,
      recommendedSell: materialsSell,
      rateSource: "Benchmark allowance",
      notes: `Rough bathroom package allowance · Finish level: ${finishLevel}`,
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
