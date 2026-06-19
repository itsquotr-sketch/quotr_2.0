import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
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
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function getDeckMaterialRates(material: string | null) {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("hardwood")) {
    return { cost: 230, sell: 340, label: "Hardwood decking" };
  }
  if (normalized.includes("composite")) {
    return { cost: 260, sell: 380, label: "Composite decking" };
  }
  return { cost: 160, sell: 240, label: "Treated pine decking" };
}

export function calculateDeck(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  let area = getNumberFact(facts, workArea.id, "deck.area_m2");
  const length = getNumberFact(facts, workArea.id, "deck.length_m");
  const width = getNumberFact(facts, workArea.id, "deck.width_m");

  if (!area && length && width) {
    area = round2(length * width);
    assumptions.push("Deck area calculated from length × width.");
  }

  if (!area) missingInfo.push(formatMissing("Deck area or dimensions"));

  const material = getStringFact(facts, workArea.id, "deck.material");
  if (!material) missingInfo.push(formatMissing("Decking material"));

  const level = getStringFact(facts, workArea.id, "deck.level");
  if (!level) missingInfo.push(formatMissing("Deck level"));

  const effectiveArea = area ?? 20;
  if (!area) {
    assumptions.push("Using assumed deck area of 20 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getLabourAdjustmentFactor(context.constraints);
  const constraintNotes = getConstraintNotes(context.constraints);
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const baseProductivity = resolveProductivity({
    productivityKey: "deck.base_labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 1.2,
  });

  let hoursPerM2 = baseProductivity.hoursPerUnit;
  if (level?.toLowerCase().includes("elevated")) {
    const elevated = resolveProductivity({
      productivityKey: "deck.elevated_extra_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.25,
    });
    hoursPerM2 += elevated.hoursPerUnit;
    assumptions.push("Elevated deck adds extra labour productivity allowance.");
  }

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Deck labour",
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: hoursPerM2,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      notes: constraintNotes || undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  const deckingRates = getDeckMaterialRates(material);
  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Decking materials",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      costRate: deckingRates.cost,
      sellRate: deckingRates.sell,
      rateSource: "Benchmark allowance",
      notes: deckingRates.label,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Framing/substructure",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      costRate: 120,
      sellRate: 180,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Fixings and consumables",
      category: "materials",
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

  if (getBooleanFact(facts, workArea.id, "deck.demolition_required")) {
    const demoProductivity = resolveProductivity({
      productivityKey: "deck.demolition_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.35,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing deck removal",
        quantity: effectiveArea,
        unit: "m²",
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

  const hasExternalStairs = context.confirmedWorkAreas.some(
    (areaItem) => areaItem.type === "external_stairs"
  );

  if (
    !hasExternalStairs &&
    getBooleanFact(facts, workArea.id, "deck.has_stairs") === true
  ) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Stairs allowance",
        recommendedCost: 1000,
        recommendedSell: 1500,
        rateSource: "Benchmark allowance",
        notes: "Basic external stair allowance included with deck.",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "deck.has_balustrade") === true) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Balustrade allowance",
        recommendedCost: 900,
        recommendedSell: 1400,
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
    exclusions,
    confidence: baseConfidence(missingInfo.length),
  };
}
