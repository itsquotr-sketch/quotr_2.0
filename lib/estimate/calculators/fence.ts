import {
  getCombinedLabourAccessFactor,
  getFenceHeightMaterialFactor,
  getIntentLabourAdjustmentFactor,
  getQualityFactor,
  getSlopeLabourFactor,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { FENCE_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
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
import { benchmarkRateFields } from "@/lib/estimate/line-item-helpers";
import {
  createFenceScopeBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
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
  EstimateFact,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import { resolveLegacyWorkAreaAccess } from "@/lib/project-conditions/legacy-adapter";
import { buildFencePhysicalModel } from "@/lib/estimate/fence-physical";
import {
  classifyFenceSystem,
  fenceGateScopeApplies,
  type FenceSystemClass,
} from "@/lib/estimate/fence-systems";
import {
  commercializeFenceWithLabour,
  detailedFenceLabour,
  detailedFenceLabourFromCost,
  detailedFenceMoneyMaterials,
  fenceCommercialLineLabel,
  fenceLabourIncludesCarry,
} from "@/lib/estimate/fence-commercial";
import {
  adaptPricedMaterialRequirementWithoutLegacy,
  adaptUnpricedLabourRequirementToEstimateLine,
  adaptUnpricedMaterialRequirementToEstimateLine,
  isPricedMaterialRequirement,
} from "@/lib/estimate/requirement-commercial-line";

export const FENCE_CALCULATOR_CONSUMED_FACTS = [
  "fence.length_m",
  "fence.height_m",
  "fence.system",
  "fence.material",
  "fence.timber_species",
  "fence.board_thickness_mm",
  "fence.top_capping",
  "fence.slat_gap_mm",
  "fence.post_spacing_m",
  "fence.post_embedment_m",
  "fence.post_stock_length_m",
  "fence.hole_diameter_m",
  "fence.rail_count",
  "fence.section_width_m",
  "fence.section_count",
  "fence.section_height_m",
  "fence.section_product_key",
  "fence.modular_fixings_included",
  "fence.modular_gate_requested",
  "fence.metal_material",
  "fence.paling_or_panel_type",
  "fence.gate_included",
  "fence.gate_count",
  "fence.gate_width_m",
  "fence.gate_position",
  "fence.gate_capping",
  "fence.horizontal_course_count",
  "fence.vertical_paling_gap_mm",
  "fence.rail_section",
  "fence.demolition_required",
  "fence.disposal_required",
  "fence.slope_condition",
  "fence.finish_required",
  "fence.finish_type",
  "fence.finish_sides",
  "fence.boundary_approval_status",
  "fence.services_risk",
] as const;

export const FENCE_HARD_MINIMUM_FACT_KEYS = [
  "fence.length_m",
  "fence.height_m",
  "fence.system",
  "fence.material",
] as const;

export function fenceHasCoreLength(
  facts: EstimateFact[],
  workAreaId: string
): boolean {
  const length = getNumberFact(facts, workAreaId, "fence.length_m");
  return length != null && length > 0;
}

export function fenceHasCoreHeight(
  facts: EstimateFact[],
  workAreaId: string
): boolean {
  const height = getNumberFact(facts, workAreaId, "fence.height_m");
  return height != null && height > 0;
}

export type FenceSystemReadiness =
  | "MISSING"
  | "NOT_SURE"
  | "SUPPORTED"
  | "UNSUPPORTED_EXPLICIT";

export function fenceSystemReadiness(
  facts: EstimateFact[],
  workAreaId: string
): FenceSystemReadiness {
  const raw =
    getStringFact(facts, workAreaId, "fence.system") ??
    getStringFact(facts, workAreaId, "fence.material");
  if (!raw) return "MISSING";
  const classified: FenceSystemClass = classifyFenceSystem(
    raw,
    getStringFact(facts, workAreaId, "fence.paling_or_panel_type")
  );
  if (classified === "missing") return "NOT_SURE";
  if (classified === "unsupported") return "UNSUPPORTED_EXPLICIT";
  return "SUPPORTED";
}

export const FENCE_UNSUPPORTED_SYSTEM_MESSAGE =
  "Quotr doesn't currently have a trusted estimating model for this fence type.";

function getFenceMaterialRates(material: string | null, context: EstimateContext) {
  const normalized = material?.toLowerCase() ?? "";
  if (
    normalized.includes("metal") ||
    normalized.includes("composite") ||
    normalized.includes("plastic") ||
    normalized.includes("aluminium") ||
    normalized.includes("aluminum") ||
    normalized.includes("steel")
  ) {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "fence.material.metal.lm",
      workAreaType: "fence",
      unit: "lm",
      fallbackCostRate: FENCE_BENCHMARKS.metalPerLm.cost,
      fallbackSellRate: FENCE_BENCHMARKS.metalPerLm.sell,
      organisationSettings: context.organisationSettings,
    });
    return {
      cost: resolved.costRate,
      sell: resolved.sellRate,
      rateSource: resolved.sourceLabel,
      materialLabel: normalized.includes("composite") || normalized.includes("plastic")
        ? "composite"
        : "metal",
    };
  }

  const resolved = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "fence.material.timber.lm",
    workAreaType: "fence",
    unit: "lm",
    fallbackCostRate: FENCE_BENCHMARKS.timberPerLm.cost,
    fallbackSellRate: FENCE_BENCHMARKS.timberPerLm.sell,
    organisationSettings: context.organisationSettings,
  });

  return {
    cost: resolved.costRate,
    sell: resolved.sellRate,
    rateSource: resolved.sourceLabel,
    materialLabel: "timber",
  };
}

export function calculateFence(
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

  const length = getNumberFact(facts, workArea.id, "fence.length_m");
  const height = getNumberFact(facts, workArea.id, "fence.height_m");
  const material = getStringFact(facts, workArea.id, "fence.material");
  const systemRaw = getStringFact(facts, workArea.id, "fence.system");

  if (!length) missingInfo.push(formatMissing("Fence length"));
  if (!height) missingInfo.push(formatMissing("Fence height"));
  if (!material && !systemRaw) missingInfo.push(formatMissing("Fence type"));

  const physical = buildFencePhysicalModel({
    context,
    workAreaId: workArea.id,
  });
  assumptions.push(...physical.assumptions);
  for (const item of physical.attention) {
    assumptions.push(item);
  }

  let effectiveLength = length;
  if (!effectiveLength) {
    effectiveLength = recordDefaultedNumber(assumptionMetadata, {
      key: "fence.length_m",
      label: "Fence length",
      workAreaId: workArea.id,
      assumedValue: 18,
      unit: "m",
      reason: "No fence length provided",
    });
    assumptions.push("Using assumed fence length of 18 m for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const workAreaAccess = resolveLegacyWorkAreaAccess({
    constraints: context.constraints,
    facts,
    workAreaId: workArea.id,
    workAreaType: "fence",
  });
  const labourAdjustment =
    getCombinedLabourAccessFactor({
      constraints: context.constraints,
      workAreaAccess,
    }) *
    getSlopeLabourFactor(
      getStringFact(facts, workArea.id, "fence.slope_condition")
    );

  const slope = getStringFact(facts, workArea.id, "fence.slope_condition");
  if (slope?.toLowerCase().includes("steep") || slope?.toLowerCase().includes("slop")) {
    assumptions.push("Sloping ground adds labour productivity allowance.");
  }

  const boundaryStatus = getStringFact(
    facts,
    workArea.id,
    "fence.boundary_approval_status"
  );
  if (boundaryStatus?.toLowerCase().includes("pending")) {
    assumptions.push("Boundary/neighbour approval is pending confirmation.");
  } else if (boundaryStatus?.toLowerCase().includes("not sure")) {
    exclusions.push("Boundary survey and neighbour approvals excluded unless confirmed.");
  }

  const servicesRisk = getStringFact(facts, workArea.id, "fence.services_risk");
  if (
    servicesRisk?.toLowerCase().includes("possible") ||
    servicesRisk?.toLowerCase().includes("known")
  ) {
    assumptions.push(
      "Underground services may affect post footing locations — subject to confirmation."
    );
  }

  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const commercial = commercializeFenceWithLabour({
    physical,
    facts,
    workAreaId: workArea.id,
    rates: context.rates,
    organisationSettings: context.organisationSettings,
    constraints: context.constraints,
    hourlyCost: labourRate.costRate,
  });
  assumptions.push(...commercial.assumptions);
  const detailed = commercial.mode === "DETAILED_COMPONENT_AUTHORITY";
  if (detailed) {
    missingInfo.push(...commercial.missingInfo);
  }

  if (!detailed) {
  const fenceProductivity = resolveProductivity({
    productivityKey: "fence.labour_hours_per_lm",
    unit: "lm",
    fallbackHoursPerUnit: 0.6,
  });

  lineItems.push({
    ...createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Fence labour",
      quantity: effectiveLength,
      unit: "lm",
      productivityHoursPerUnit: fenceProductivity.hoursPerUnit,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      adjustmentFactor: labourAdjustment,
      qualityFactor,
      rateSource: labourRate.sourceLabel,
      notes: height ? `${height} m high fence` : undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    }),
    identitySummary: "Package labour — not a task takeoff",
  });

  const materialRates = getFenceMaterialRates(systemRaw ?? material, context);
  const heightFactor = getFenceHeightMaterialFactor(height);
  const adjustedCostRate = round2(materialRates.cost * heightFactor);
  const adjustedSellRate = round2(materialRates.sell * heightFactor);

  const fenceBuildUp =
    length && height
      ? createFenceScopeBuildUp({
          lengthLm: effectiveLength,
          heightM: height,
          materialLabel: materialRates.materialLabel,
        })
      : null;

  lineItems.push(
    withMaterialBuildUp(
      {
        ...createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fence materials",
          category: "materials",
          quantity: effectiveLength,
          unit: "lm",
          costRate: adjustedCostRate,
          sellRate: adjustedSellRate,
          rateSource: materialRates.rateSource,
          notes: height
            ? `${height} m high · height factor ${heightFactor.toFixed(2)}`
            : undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        identitySummary: "Package estimate — not a component takeoff",
      },
      fenceBuildUp
    )
  );
  }

  if (
    !detailed &&
    fenceGateScopeApplies(physical.system) &&
    getBooleanFact(facts, workArea.id, "fence.gate_included")
  ) {
    const gateCount =
      getNumberFact(facts, workArea.id, "fence.gate_count") ?? 1;
    const gateProductivity = resolveProductivity({
      productivityKey: "fence.gate_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 2,
    });
    const gateRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "fence.gate.allowance",
      workAreaType: "fence",
      unit: "allowance",
      fallbackCostRate: FENCE_BENCHMARKS.gate.cost,
      fallbackSellRate: FENCE_BENCHMARKS.gate.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Gate labour allowance",
        quantity: gateCount,
        unit: "allowance",
        productivityHoursPerUnit: gateProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
        rateSource: gateProductivity.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: gateCount > 1 ? `Gate allowance (×${gateCount})` : "Gate allowance",
        recommendedCost: round2(gateRates.costRate * gateCount),
        recommendedSell: round2(gateRates.sellRate * gateCount),
        rateSource: gateRates.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (detailed) {
    const labourMoney = detailedFenceLabourFromCost(
      labourRate.costRate,
      context.organisationSettings
    );
    for (const requirement of detailedFenceMoneyMaterials(commercial.requirements)) {
      if (isPricedMaterialRequirement(requirement)) {
        lineItems.push({
          ...adaptPricedMaterialRequirementWithoutLegacy({
            requirement,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: fenceCommercialLineLabel(requirement),
          }),
          notes: requirement.specification ?? undefined,
          identitySummary: requirement.specification ?? requirement.description,
        });
      } else {
        lineItems.push(
          adaptUnpricedMaterialRequirementToEstimateLine({
            requirement,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: fenceCommercialLineLabel(requirement),
          })
        );
      }
    }
    for (const requirement of detailedFenceLabour(commercial.requirements)) {
      if (requirement.priced === true && requirement.hourlyCost != null) {
        const includeMaterialCarry = fenceLabourIncludesCarry(
          requirement.componentKey
        );
        const intentAdjustment = getIntentLabourAdjustmentFactor({
          constraints: context.constraints,
          workAreaAccess,
          includeMaterialCarry,
        }) * getSlopeLabourFactor(
          getStringFact(facts, workArea.id, "fence.slope_condition")
        );
        lineItems.push(
          createLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: fenceCommercialLineLabel(requirement),
            quantity: requirement.productivityBasis.quantity,
            unit: requirement.productivityBasis.unit,
            productivityHoursPerUnit: requirement.productivityBasis.hoursPerUnit,
            labourCostRate: labourMoney.costPerHour,
            labourSellRate: labourMoney.sellPerHour,
            adjustmentFactor: intentAdjustment,
            qualityFactor: NO_FINISH_QUALITY_FACTOR,
            rateSource: labourRate.sourceLabel,
            componentKey: requirement.componentKey,
            sellDerivedFromMargin: true,
            sellAuthority: labourMoney.sellAuthority,
            notes: `${requirement.productivityBasis.quantity} ${requirement.productivityBasis.unit} × ${requirement.productivityBasis.hoursPerUnit} labour-h/${requirement.productivityBasis.unit}`,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          })
        );
      } else {
        lineItems.push(
          adaptUnpricedLabourRequirementToEstimateLine({
            requirement,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: fenceCommercialLineLabel(requirement),
          })
        );
      }
    }
  }

  if (getBooleanFact(facts, workArea.id, "fence.demolition_required")) {
    const demoProductivity = resolveProductivity({
      productivityKey: "fence.demolition_hours_per_lm",
      unit: "lm",
      fallbackHoursPerUnit: 0.25,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing fence removal",
        quantity: effectiveLength,
        unit: "lm",
        productivityHoursPerUnit: demoProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        rateSource: demoProductivity.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    if (getBooleanFact(facts, workArea.id, "fence.disposal_required")) {
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fence disposal allowance",
          recommendedCost: FENCE_BENCHMARKS.disposalAllowance.cost,
          recommendedSell: FENCE_BENCHMARKS.disposalAllowance.sell,
          ...benchmarkRateFields(),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor: NO_FINISH_QUALITY_FACTOR,
        })
      );
    }
  }

  const finishRequired = getBooleanFact(facts, workArea.id, "fence.finish_required");
  if (finishRequired === true) {
    const finishType = getStringFact(facts, workArea.id, "fence.finish_type");
    const finishSides = getStringFact(facts, workArea.id, "fence.finish_sides");
    const sideFactor =
      finishSides?.includes("both") ? 2 : finishSides?.includes("one") ? 1 : 1.5;

    const finishRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "fence.finish.lm",
      workAreaType: "fence",
      unit: "lm",
      fallbackCostRate: FENCE_BENCHMARKS.finishAllowanceLm.cost,
      fallbackSellRate: FENCE_BENCHMARKS.finishAllowanceLm.sell,
      organisationSettings: context.organisationSettings,
    });

    const finishQuantity = round2(effectiveLength * sideFactor);
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Fence painting/staining allowance",
        category: "allowance",
        recommendedCost: round2(finishRates.costRate * finishQuantity),
        recommendedSell: round2(finishRates.sellRate * finishQuantity),
        rateSource: finishRates.sourceLabel,
        notes: [
          finishType ? `${finishType} finish` : null,
          finishSides ? `${finishSides.replace(/_/g, " ")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Finish allowance placeholder",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
    assumptions.push(
      "Final fence finish scope and surface preparation are subject to confirmation."
    );
  } else if (finishRequired === false) {
    exclusions.push("Final painting or staining of the fence is excluded.");
  } else if (finishRequired === null) {
    exclusions.push("Final painting or staining excluded unless stated.");
  }

  let confidence = baseConfidence(missingInfo.length);
  if (physical.system === "missing" || physical.system === "unsupported") {
    confidence = Math.min(confidence, 45);
  }
  if (physical.modular?.sectionWidthAssumed) {
    confidence = Math.max(0, confidence - 5);
  }
  if (physical.attention.some((row) => /slat gap/i.test(row))) {
    confidence = Math.max(0, confidence - 5);
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence,
    assumptionMetadata,
    ...(commercial.requirements.length > 0
      ? { requirements: commercial.requirements }
      : physical.requirements.length > 0
        ? { requirements: physical.requirements }
        : {}),
  };
}
