import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { DECK_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getBooleanFactAny,
  getNumberFact,
  getNumberFactAny,
  getStringFact,
  getStringFactAny,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import {
  benchmarkRateFields,
  rateFieldsFromResolved,
} from "@/lib/estimate/line-item-helpers";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import type { ResolvedRate } from "@/lib/estimate/types";
import { baseConfidence } from "@/lib/estimate/summary";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function getDeckMaterialRate(
  material: string | null,
  context: EstimateContext
): ResolvedRate & { materialLabel: string } {
  const normalized = material?.toLowerCase() ?? "";
  if (normalized.includes("kwila")) {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "deck.material.hardwood.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.kwilaDecking.cost,
      fallbackSellRate: DECK_BENCHMARKS.kwilaDecking.sell,
      organisationSettings: context.organisationSettings,
    });
    return { ...resolved, materialLabel: "Kwila decking" };
  }
  if (normalized.includes("hardwood")) {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "deck.material.hardwood.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.hardwoodDecking.cost,
      fallbackSellRate: DECK_BENCHMARKS.hardwoodDecking.sell,
      organisationSettings: context.organisationSettings,
    });
    return { ...resolved, materialLabel: "Hardwood decking" };
  }
  if (normalized.includes("composite")) {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "deck.material.composite.m2",
      workAreaType: "deck",
      unit: "m2",
      fallbackCostRate: DECK_BENCHMARKS.compositeDecking.cost,
      fallbackSellRate: DECK_BENCHMARKS.compositeDecking.sell,
      organisationSettings: context.organisationSettings,
    });
    return { ...resolved, materialLabel: "Composite decking" };
  }
  const resolved = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "deck.material.treated_pine.m2",
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.treatedPineDecking.cost,
    fallbackSellRate: DECK_BENCHMARKS.treatedPineDecking.sell,
    organisationSettings: context.organisationSettings,
  });
  return { ...resolved, materialLabel: "Treated pine decking" };
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

  const material = getStringFactAny(facts, workArea.id, [
    "deck.board_material",
    "deck.material",
  ]);
  if (!material) missingInfo.push(formatMissing("Decking material"));

  const deckHeight = getNumberFact(facts, workArea.id, "deck.height_m");
  const level =
    getStringFact(facts, workArea.id, "deck.level") ??
    (deckHeight !== null
      ? deckHeight > 0.3
        ? "Elevated"
        : "Ground-level"
      : null);
  if (!level && deckHeight === null) {
    missingInfo.push(formatMissing("Deck height or level"));
  }

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
  const elevated =
    level?.toLowerCase().includes("elevated") ||
    (deckHeight !== null && deckHeight > 0.3);
  if (elevated) {
    const elevatedProductivity = resolveProductivity({
      productivityKey: "deck.elevated_extra_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 0.25,
    });
    hoursPerM2 += elevatedProductivity.hoursPerUnit;
    assumptions.push("Elevated deck adds extra labour productivity allowance.");
  }

  if (deckHeight !== null && deckHeight > 1) {
    assumptions.push(
      "Deck height above 1 m may require stairs, balustrade or consent confirmation."
    );
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
      notes: constraintNotes || undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      ...rateFieldsFromResolved(labourRate),
    })
  );

  const deckingRates = getDeckMaterialRate(material, context);
  const boardWidthMm =
    getNumberFactAny(facts, workArea.id, ["deck.board_width_mm"]) ?? 140;
  const wastagePercent =
    getNumberFact(facts, workArea.id, "deck.board_wastage_percent") ?? 10;
  const boardLm = round2(
    (effectiveArea / (boardWidthMm / 1000)) * (1 + wastagePercent / 100)
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Decking boards",
      category: "materials",
      quantity: boardLm,
      unit: "lm",
      notes: `${deckingRates.materialLabel} · ${boardWidthMm} mm boards · ${wastagePercent}% wastage`,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
      costRate: DECK_BENCHMARKS.boardLm.cost,
      sellRate: DECK_BENCHMARKS.boardLm.sell,
      rateSource: deckingRates.sourceLabel ?? "Benchmark allowance",
    })
  );

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Decking materials package",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      notes: deckingRates.materialLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
      ...rateFieldsFromResolved(deckingRates),
    })
  );

  const framingRates = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "deck.substructure.m2",
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.framing.cost,
    fallbackSellRate: DECK_BENCHMARKS.framing.sell,
    organisationSettings: context.organisationSettings,
  });

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Framing/substructure",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
      ...rateFieldsFromResolved(framingRates),
    })
  );

  const fixingsRates = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "deck.fixings.m2",
    workAreaType: "deck",
    unit: "m2",
    fallbackCostRate: DECK_BENCHMARKS.fixings.cost,
    fallbackSellRate: DECK_BENCHMARKS.fixings.sell,
    organisationSettings: context.organisationSettings,
  });

  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Fixings and consumables",
      category: "materials",
      quantity: effectiveArea,
      unit: "m²",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
      ...rateFieldsFromResolved(fixingsRates),
    })
  );

  if (
    getBooleanFactAny(facts, workArea.id, [
      "deck.existing_deck_removal",
      "deck.demolition_required",
    ])
  ) {
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
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        notes: `Productivity: ${demoProductivity.hoursPerUnit} hrs/m²`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        ...rateFieldsFromResolved(labourRate),
      })
    );
  }

  const hasExternalStairs = context.confirmedWorkAreas.some(
    (areaItem) => areaItem.type === "external_stairs"
  );

  const accessType = getStringFact(facts, workArea.id, "deck.access_type");
  const legacyStairs = getBooleanFact(facts, workArea.id, "deck.has_stairs");

  if (!hasExternalStairs) {
    const accessLower = accessType?.toLowerCase() ?? "";
    if (
      accessLower.includes("stair set") ||
      (legacyStairs === true && !accessType)
    ) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Stair set allowance",
          recommendedCost: DECK_BENCHMARKS.stairsAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.stairsAllowance.sell,
          ...benchmarkRateFields(),
          notes: "External stair set allowance included with deck.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
      if (deckHeight !== null && deckHeight > 1) {
        assumptions.push(
          "Final stair design, handrail and consent requirements are subject to confirmation."
        );
      }
    } else if (accessLower.includes("multiple")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Multi-side step-down allowance",
          recommendedCost: DECK_BENCHMARKS.multiSideStairsAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.multiSideStairsAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    } else if (accessLower.includes("single step")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Step-down allowance",
          recommendedCost: DECK_BENCHMARKS.stepAllowance.cost,
          recommendedSell: DECK_BENCHMARKS.stepAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  }

  if (
    getBooleanFactAny(facts, workArea.id, [
      "deck.balustrade_required",
      "deck.has_balustrade",
    ]) === true
  ) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Balustrade allowance",
        recommendedCost: DECK_BENCHMARKS.balustradeAllowance.cost,
        recommendedSell: DECK_BENCHMARKS.balustradeAllowance.sell,
        ...benchmarkRateFields(),
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    assumptions.push(
      "Final balustrade design and compliance are subject to confirmation."
    );
  }

  if (
    getBooleanFact(facts, workArea.id, "deck.vertical_face_boards_required") ===
    true
  ) {
    const faceLm =
      getNumberFact(facts, workArea.id, "deck.vertical_face_board_length_lm") ??
      round2(
        length && width ? length * 2 + width * 2 : effectiveArea * 0.5
      );
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Vertical face/fascia boards",
        category: "materials",
        quantity: faceLm,
        unit: "lm",
        costRate: DECK_BENCHMARKS.faceBoardLm.cost,
        sellRate: DECK_BENCHMARKS.faceBoardLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Face board labour allowance",
        recommendedCost: round2(faceLm * 35),
        recommendedSell: round2(faceLm * 55),
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
