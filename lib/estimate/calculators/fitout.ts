import { getQualityFactor } from "@/lib/estimate/adjustments";
import { FITOUT_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
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

type FitoutConfig = {
  areaKey: string;
  rate: { cost: number; sell: number };
  label: string;
  productivityKey: string;
  fallbackHoursPerM2: number;
};

function calculateAreaBasedFitout(
  context: EstimateContext,
  workArea: EstimateWorkArea,
  config: FitoutConfig
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, config.areaKey);
  if (!area) missingInfo.push(formatMissing("Area"));

  const effectiveArea = area ?? 20;
  if (!area) {
    assumptions.push(`Using assumed area of 20 m² for rough ${workArea.name} estimate.`);
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const productivity = resolveProductivity({
    productivityKey: config.productivityKey,
    unit: "m²",
    fallbackHoursPerUnit: config.fallbackHoursPerM2,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: `${config.label} labour`,
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: productivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      rateSource: labourRate.sourceLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: `${config.label} materials allowance`,
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      costRate: config.rate.cost,
      sellRate: config.rate.sell,
      rateSource: "Benchmark allowance",
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

export function calculateInternalWalls(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "internal_walls.length_lm");
  const height = getNumberFact(facts, workArea.id, "internal_walls.height_m");
  const sides = getStringFact(facts, workArea.id, "internal_walls.lining_sides");
  const sideFactor = sides?.toLowerCase().includes("both") ? 2 : 1;

  if (!length) missingInfo.push(formatMissing("Wall length"));
  if (!height) missingInfo.push(formatMissing("Wall height"));

  const effectiveArea =
    length && height ? round2(length * height * sideFactor) : 20;
  if (!length || !height) {
    assumptions.push("Using assumed internal wall area of 20 m².");
  } else {
    assumptions.push(`Calculated lining area: ${effectiveArea} m².`);
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const productivity = resolveProductivity({
    productivityKey: "internal_walls.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 1.4,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Internal wall labour",
      quantity: effectiveArea,
      unit: "m²",
      productivityHoursPerUnit: productivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      rateSource: labourRate.sourceLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Internal wall materials allowance",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      costRate: FITOUT_BENCHMARKS.internalWallsPerM2.cost,
      sellRate: FITOUT_BENCHMARKS.internalWallsPerM2.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (getBooleanFact(facts, workArea.id, "internal_walls.skirtings_included")) {
    const skirtingLm =
      getNumberFact(facts, workArea.id, "internal_walls.skirting_length_lm") ??
      length ??
      0;
    if (skirtingLm > 0) {
      lineItems.push(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Skirting",
          category: "materials",
          quantity: skirtingLm,
          unit: "lm",
          costRate: FITOUT_BENCHMARKS.skirtingLm.cost,
          sellRate: FITOUT_BENCHMARKS.skirtingLm.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}

export function calculateCeilings(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const result = calculateAreaBasedFitout(context, workArea, {
    areaKey: "ceilings.area_m2",
    rate: FITOUT_BENCHMARKS.ceilingsPerM2,
    label: "Ceiling",
    productivityKey: "ceilings.labour_hours_per_m2",
    fallbackHoursPerM2: 0.9,
  });

  const edgeLm = getNumberFact(facts, workArea.id, "ceilings.edge_lining_length_lm");
  const edgeType = getStringFact(facts, workArea.id, "ceilings.edge_lining_type");
  if (edgeLm && edgeType && edgeType.toLowerCase() !== "none") {
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: `${edgeType} edge lining`,
        category: "materials",
        quantity: edgeLm,
        unit: "lm",
        costRate: FITOUT_BENCHMARKS.skirtingLm.cost,
        sellRate: FITOUT_BENCHMARKS.skirtingLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor: getQualityFactor(
          context.project,
          context.organisationSettings
        ),
      })
    );
  }

  return result;
}

export function calculateDoors(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const count = getNumberFact(facts, workArea.id, "doors.count");
  if (!count) missingInfo.push(formatMissing("Door count"));

  const effectiveCount = count ?? 3;
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Door supply/install allowance",
      recommendedCost: effectiveCount * FITOUT_BENCHMARKS.doorsEach.cost,
      recommendedSell: effectiveCount * FITOUT_BENCHMARKS.doorsEach.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  const prehung = getBooleanFact(facts, workArea.id, "doors.prehung");
  if (prehung === false) {
    if (getBooleanFact(facts, workArea.id, "doors.frames_included")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Door frame allowance",
          recommendedCost: effectiveCount * 120,
          recommendedSell: effectiveCount * 180,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
    if (getBooleanFact(facts, workArea.id, "doors.hardware_install_included")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Door hardware installation",
          recommendedCost: effectiveCount * 80,
          recommendedSell: effectiveCount * 120,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}

export function calculateFlooring(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const result = calculateAreaBasedFitout(context, workArea, {
    areaKey: "flooring.area_m2",
    rate: FITOUT_BENCHMARKS.flooringPerM2,
    label: "Flooring",
    productivityKey: "flooring.labour_hours_per_m2",
    fallbackHoursPerM2: 0.8,
  });

  if (getBooleanFact(facts, workArea.id, "flooring.existing_flooring_removal")) {
    const area =
      getNumberFact(facts, workArea.id, "flooring.area_m2") ?? 20;
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing flooring removal",
        category: "labour",
        quantity: area,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.removalPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.removalPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor: getQualityFactor(
          context.project,
          context.organisationSettings
        ),
      })
    );
  }

  return result;
}

export function calculatePainting(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const location = getStringFact(facts, workArea.id, "painting.location");
  const internalArea = getNumberFact(facts, workArea.id, "painting.internal_area_m2");
  const externalArea = getNumberFact(facts, workArea.id, "painting.external_area_m2");
  const coats = getStringFact(facts, workArea.id, "painting.coats_required");
  const coatFactor = coats === "3" ? 1.35 : coats === "1" ? 0.75 : 1;
  const prep = getStringFact(facts, workArea.id, "painting.prep_level");
  const prepFactor =
    prep?.toLowerCase().includes("heavy")
      ? 1.3
      : prep?.toLowerCase().includes("light")
        ? 0.85
        : 1;

  let totalArea = 0;
  if (location?.toLowerCase().includes("internal") || location === "Both") {
    totalArea += internalArea ?? 0;
  }
  if (location?.toLowerCase().includes("external") || location === "Both") {
    totalArea += externalArea ?? 0;
  }
  if (!totalArea) {
    missingInfo.push(formatMissing("Painting area"));
    totalArea = 50;
    assumptions.push("Using assumed painting area of 50 m².");
  }

  const adjustedArea = round2(totalArea * coatFactor * prepFactor);
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const productivity = resolveProductivity({
    productivityKey: "painting.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.12,
  });

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Painting labour",
      quantity: adjustedArea,
      unit: "m²",
      productivityHoursPerUnit: productivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      rateSource: labourRate.sourceLabel,
      notes: [coats ? `${coats} coats` : null, prep ? `${prep} prep` : null]
        .filter(Boolean)
        .join(" · "),
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  if (!getBooleanFact(facts, workArea.id, "painting.paint_client_supplied")) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Paint materials",
        category: "materials",
        quantity: adjustedArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.paintingPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.paintingPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    assumptions.push("Paint supplied by client — labour/coordination only.");
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
  };
}

export function calculatePlastering(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const result = calculateAreaBasedFitout(context, workArea, {
    areaKey: "plastering.area_m2",
    rate: FITOUT_BENCHMARKS.plasteringPerM2,
    label: "Plastering",
    productivityKey: "plastering.labour_hours_per_m2",
    fallbackHoursPerM2: 0.45,
  });

  const level = getStringFact(facts, workArea.id, "plastering.level");
  if (level) {
    const lower = level.toLowerCase();
    if (lower.includes("level 5")) {
      result.assumptions.push("Level 5 plastering adds finish labour factor.");
    } else if (lower.includes("level 3")) {
      result.assumptions.push("Level 3 plastering — standard finish allowance.");
    }
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Plastering subcontractor allowance",
        category: "subcontractor",
        recommendedCost:
          (getNumberFact(facts, workArea.id, "plastering.area_m2") ?? 20) *
          FITOUT_BENCHMARKS.plasteringPerM2.cost,
        recommendedSell:
          (getNumberFact(facts, workArea.id, "plastering.area_m2") ?? 20) *
          FITOUT_BENCHMARKS.plasteringPerM2.sell,
        rateSource: "Benchmark allowance",
        notes: level,
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor: getQualityFactor(
          context.project,
          context.organisationSettings
        ),
      })
    );
  }

  return result;
}
