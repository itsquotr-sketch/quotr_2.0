import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { PERGOLA_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
  getStringFact,
} from "@/lib/estimate/facts";
import {
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

export function calculatePergola(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  let area = getNumberFact(facts, workArea.id, "pergola.area_m2");
  if (!area) {
    const deckArea = context.confirmedWorkAreas
      .filter((item) => item.type === "deck")
      .map((deck) => getNumberFact(facts, deck.id, "deck.area_m2"))
      .find((value) => value != null);

    if (deckArea) {
      area = deckArea;
      assumptions.push("Pergola area assumed similar to deck area.");
    }
  }

  if (!area) {
    missingInfo.push(formatMissing("Pergola area"));
    area = 15;
    assumptions.push("Using assumed pergola area of 15 m² for rough estimate.");
  }

  const material = getStringFact(facts, workArea.id, "pergola.material");
  if (!material) missingInfo.push(formatMissing("Pergola material"));

  const roofingIncluded =
    getBooleanFact(facts, workArea.id, "pergola.roofing_included") ?? true;

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
    productivityKey: "pergola.base_labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.9,
  });

  let totalHoursPerM2 = baseProductivity.hoursPerUnit;
  if (roofingIncluded) {
    const roofingProductivity = resolveProductivity({
      productivityKey: "pergola.roofing_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.35,
    });
    totalHoursPerM2 += roofingProductivity.hoursPerUnit;
  }

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Pergola labour",
      quantity: area,
      unit: "m²",
      productivityHoursPerUnit: totalHoursPerM2,
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

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Pergola frame/materials",
      category: "materials",
      quantity: area,
      unit: "m²",
      costRate: PERGOLA_BENCHMARKS.frameMaterials.cost,
      sellRate: PERGOLA_BENCHMARKS.frameMaterials.sell,
      rateSource: "Benchmark allowance",
      notes: material ? `${material} pergola allowance` : undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (roofingIncluded) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Roofing/covering allowance",
        category: "allowance",
        quantity: area,
        unit: "m²",
        costRate: PERGOLA_BENCHMARKS.roofing.cost,
        sellRate: PERGOLA_BENCHMARKS.roofing.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Roofing/covering scope"));
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}
