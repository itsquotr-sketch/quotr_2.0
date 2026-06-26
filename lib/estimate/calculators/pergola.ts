import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
  getWorkAreaAccessFactor,
} from "@/lib/estimate/adjustments";
import { PERGOLA_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
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
import {
  createPergolaAreaBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import {
  PERGOLA_ALLOWANCE_RATE_KEYS,
  resolvePergolaFrameRate,
  resolvePergolaRoofRate,
} from "@/lib/estimate/pergola-rates";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { baseConfidence } from "@/lib/estimate/summary";
import {
  createAssumptionMetadata,
  recordDefaultedNumber,
} from "@/lib/estimate/assumption-metadata";
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
  const exclusions: string[] = [];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  let area = getNumberFact(facts, workArea.id, "pergola.area_m2");
  const length = getNumberFact(facts, workArea.id, "pergola.length_m");
  const width = getNumberFact(facts, workArea.id, "pergola.width_m");

  if (!area && length && width) {
    area = round2(length * width);
    assumptions.push("Pergola area calculated from length × width.");
  }

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
    area = recordDefaultedNumber(assumptionMetadata, {
      key: "pergola.area_m2",
      label: "Pergola area",
      workAreaId: workArea.id,
      assumedValue: 15,
      unit: "m²",
      reason: "No pergola area or dimensions provided",
    });
    assumptions.push("Using assumed pergola area of 15 m² for rough estimate.");
  }

  const material = getStringFact(facts, workArea.id, "pergola.material");
  if (!material) missingInfo.push(formatMissing("Pergola material"));

  const attached = getStringFact(facts, workArea.id, "pergola.attached");
  const roofingIncluded = getBooleanFact(
    facts,
    workArea.id,
    "pergola.roofing_included"
  );
  const roofingType = getStringFact(facts, workArea.id, "pergola.roofing_type");

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment =
    getLabourAdjustmentFactor(context.constraints) *
    getWorkAreaAccessFactor(getStringFact(facts, workArea.id, "pergola.access"));

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

  const attachedLower = attached?.toLowerCase() ?? "";
  if (attachedLower.includes("attach")) {
    totalHoursPerM2 *= 1.1;
    assumptions.push("Attached pergola adds tie-in complexity allowance.");
  }

  if (getBooleanFact(facts, workArea.id, "pergola.tie_in_existing")) {
    totalHoursPerM2 *= 1.05;
    assumptions.push("Tie-in to existing structure adds labour allowance.");
  }

  if (roofingIncluded === true) {
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

  const frameRates = resolvePergolaFrameRate({
    material,
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const pergolaBuildUp = createPergolaAreaBuildUp({
    areaM2: area,
    materialLabel: material ?? "pergola",
    attached,
  });

  lineItems.push(
    withMaterialBuildUp(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Pergola frame/materials",
        category: "materials",
        quantity: area,
        unit: "m²",
        costRate: frameRates.costRate,
        sellRate: frameRates.sellRate,
        rateSource: frameRates.sourceLabel,
        notes: material ? `${material} pergola allowance` : undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      }),
      pergolaBuildUp
    )
  );

  if (roofingIncluded === true) {
    const roofingRates = resolvePergolaRoofRate({
      roofingType,
      rates: context.rates,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Roofing/covering allowance",
        category: "allowance",
        quantity: area,
        unit: "m²",
        costRate: roofingRates.costRate,
        sellRate: roofingRates.sellRate,
        rateSource: roofingRates.sourceLabel,
        notes: roofingType ?? undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else if (roofingIncluded === null) {
    assumptions.push("Roofing/covering scope is subject to confirmation.");
  }

  const isFreestanding =
    attachedLower.includes("free") || attachedLower.includes("stand");
  const footingsRequired =
    getBooleanFact(facts, workArea.id, "pergola.footings_required") ??
    isFreestanding;

  if (footingsRequired) {
    const footingRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: PERGOLA_ALLOWANCE_RATE_KEYS.footingsEach,
      workAreaType: "pergola",
      unit: "each",
      fallbackCostRate: PERGOLA_BENCHMARKS.footingsEach.cost,
      fallbackSellRate: PERGOLA_BENCHMARKS.footingsEach.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Footings/posts allowance",
        recommendedCost: footingRates.costRate,
        recommendedSell: footingRates.sellRate,
        rateSource: footingRates.sourceLabel,
        notes: isFreestanding ? "Freestanding pergola footings" : undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "pergola.gutters_included")) {
    const gutterLength =
      length && width ? round2(length * 2 + width) : round2(Math.sqrt(area) * 4);
    const gutterRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: PERGOLA_ALLOWANCE_RATE_KEYS.guttersLm,
      workAreaType: "pergola",
      unit: "lm",
      fallbackCostRate: PERGOLA_BENCHMARKS.gutterPerLm.cost,
      fallbackSellRate: PERGOLA_BENCHMARKS.gutterPerLm.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Gutter/drainage allowance",
        recommendedCost: round2(gutterRates.costRate * gutterLength),
        recommendedSell: round2(gutterRates.sellRate * gutterLength),
        rateSource: gutterRates.sourceLabel,
        notes: `${gutterLength} lm gutter allowance`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  const finishRequired = getBooleanFact(facts, workArea.id, "pergola.finish_required");
  const materialLower = material?.toLowerCase() ?? "";
  const isPowdercoated =
    materialLower.includes("aluminium") ||
    materialLower.includes("aluminum") ||
    materialLower.includes("steel");
  const finishType = getStringFact(facts, workArea.id, "pergola.finish_type")?.toLowerCase();

  if (finishRequired === true) {
    const skipSeparateFinish =
      isPowdercoated &&
      (finishType?.includes("powder") || finishType == null || finishType === "unknown");

    if (!skipSeparateFinish) {
      const finishRates = resolveRate({
        rates: context.rates,
        rateType: "allowance",
        itemKey: "pergola.finish.allowance",
        workAreaType: "pergola",
        unit: "allowance",
        fallbackCostRate: PERGOLA_BENCHMARKS.finishAllowance.cost,
        fallbackSellRate: PERGOLA_BENCHMARKS.finishAllowance.sell,
        organisationSettings: context.organisationSettings,
      });

      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Pergola painting/staining allowance",
          category: "allowance",
          recommendedCost: finishRates.costRate,
          recommendedSell: finishRates.sellRate,
          rateSource: finishRates.sourceLabel,
          notes: finishType ?? "Finish allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  } else if (finishRequired === false) {
    exclusions.push("Final painting or staining of the pergola is excluded.");
  } else if (finishRequired === null && materialLower.includes("timber")) {
    exclusions.push("Final painting or staining excluded unless stated.");
  }

  const consentStatus = getStringFact(
    facts,
    workArea.id,
    "pergola.engineering_or_consent_status"
  );
  if (consentStatus?.toLowerCase().includes("required")) {
    exclusions.push("Engineering and consent costs excluded unless confirmed.");
  } else if (consentStatus?.toLowerCase().includes("not sure")) {
    assumptions.push("Engineering/consent requirements are subject to confirmation.");
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
  };
}
