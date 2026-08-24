import {
  getCombinedLabourAccessFactor,
  getConstraintNotes,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { RETAINING_WALL_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getFact,
  getNumberFact,
  getNumberFactAny,
  getStringFact,
  hasFactValue,
  isNotSureValue,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { calculateBackfillVolume, calculateDrainageLm } from "@/lib/estimate/material-buildups";
import {
  createBackfillVolumeBuildUp,
  createDrainageBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
import { MATERIAL_RATE_KEYS } from "@/lib/estimate/material-rate-keys";
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
import {
  resolveLegacyCartingMetres,
  resolveLegacyWorkAreaAccess,
} from "@/lib/project-conditions/legacy-adapter";
import { buildRetainingWallPhysicalModel } from "@/lib/estimate/retaining-wall-physical";
import {
  classifyRetainingWallSystem,
  retainingWallLegacyCommercialFamily,
} from "@/lib/estimate/retaining-wall-systems";
import {
  commercializeRetainingWall,
  detailedLabour,
  detailedMoneyMaterials,
} from "@/lib/estimate/retaining-wall-commercial";
import {
  resolveRetainingWallBackfillIncluded,
  resolveRetainingWallDrainageIncluded,
  RW_BACKFILL_STANDARD_ASSUMPTION,
  RW_DRAINAGE_STANDARD_ASSUMPTION,
} from "@/lib/estimate/retaining-wall-defaults";
import {
  adaptPricedMaterialRequirementWithoutLegacy,
  adaptUnpricedLabourRequirementToEstimateLine,
  adaptUnpricedMaterialRequirementToEstimateLine,
  isPricedMaterialRequirement,
} from "@/lib/estimate/requirement-commercial-line";
import { RW_FACE_AREA_COMPONENT } from "@/lib/estimate/retaining-wall-identities";

/** Facts this calculator reads. Physical-only keys do not change 1A money. */
export const RETAINING_WALL_CALCULATOR_CONSUMED_FACTS = [
  "retaining_wall.length_m",
  "retaining_wall.height_m",
  "retaining_wall.height_high_m",
  "retaining_wall.high_height_m",
  "retaining_wall.height_low_m",
  "retaining_wall.low_height_m",
  "retaining_wall.is_raking",
  "retaining_wall.material",
  "retaining_wall.fixing_type",
  "retaining_wall.surcharge",
  "retaining_wall.surcharge_type",
  "retaining_wall.excavation_required",
  "retaining_wall.excavation_volume_m3",
  "retaining_wall.drainage_required",
  "retaining_wall.drain_connection_required",
  "retaining_wall.backfill_included",
  "retaining_wall.backfill_length_m",
  "retaining_wall.backfill_height_m",
  "retaining_wall.backfill_depth_m",
  "retaining_wall.post_spacing_m",
  "retaining_wall.pile_embedment_m",
  "retaining_wall.pile_embedment_ratio",
  "retaining_wall.face_board_section",
  "retaining_wall.sleeper_length_m",
  "retaining_wall.sleeper_face_height_m",
  "retaining_wall.sleeper_post_embedment_m",
  "retaining_wall.hole_diameter_m",
  "retaining_wall.premix_bag_yield_m3",
  "retaining_wall.block_series",
  "retaining_wall.block_laying_method",
  "retaining_wall.footing_width_m",
  "retaining_wall.footing_depth_m",
  "retaining_wall.vertical_starter_spacing_m",
  "retaining_wall.horizontal_rebar_runs",
  "retaining_wall.waterproofing_required",
  "retaining_wall.waterproofing_type",
  "retaining_wall.waterproofing_method",
  "retaining_wall.engineering_or_consent_status",
  "retaining_wall.carting_distance_m",
  "retaining_wall.disposal_included",
] as const;

export const RETAINING_WALL_HARD_MINIMUM_FACT_KEYS = [
  "retaining_wall.length_m",
  "retaining_wall.height_m",
  "retaining_wall.material",
] as const;

export const BACKFILL_REFERENCE_ONLY_ASSUMPTION =
  "Planning backfill volume (m³) is takeoff only; the current commercial backfill allowance is not volume priced.";

export const RETAINING_WALL_UNSUPPORTED_MATERIAL_MESSAGE =
  "Quotr doesn't currently have a trusted price model for this retaining wall material.";

/** Commercially supported families that emit a material line today. Block maps to concrete. */
export const RETAINING_WALL_SUPPORTED_MATERIAL_FAMILIES = [
  "timber",
  "concrete",
] as const;

export type RetainingWallMaterialClass =
  | "timber"
  | "concrete"
  | "missing"
  | "unsupported";

export type RetainingWallMaterialReadiness =
  | "MISSING"
  | "NOT_SURE"
  | "SUPPORTED"
  | "UNSUPPORTED_EXPLICIT";


/**
 * Commercial family for the 1A package. Physical system is classified
 * separately; sleeper/masonry still price through the concrete face-m² package.
 */
export function classifyRetainingWallMaterial(
  material: string | null
): RetainingWallMaterialClass {
  const system = classifyRetainingWallSystem(material);
  if (system === "missing") return "missing";
  const family = retainingWallLegacyCommercialFamily(system);
  if (family) return family;
  return "unsupported";
}

export function retainingWallMaterialReadiness(
  facts: readonly EstimateFact[],
  workAreaId: string
): RetainingWallMaterialReadiness {
  const row = getFact(
    facts as EstimateFact[],
    workAreaId,
    "retaining_wall.material"
  );
  if (!row || !hasFactValue(row.value)) return "MISSING";
  if (isNotSureValue(row.value)) return "NOT_SURE";
  const classified = classifyRetainingWallMaterial(String(row.value).trim());
  if (classified === "timber" || classified === "concrete") return "SUPPORTED";
  return "UNSUPPORTED_EXPLICIT";
}

export function retainingWallHasCoreLength(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return getNumberFact(facts as EstimateFact[], workAreaId, "retaining_wall.length_m") != null;
}

export function retainingWallHasCoreHeight(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return resolveWallHeight(facts as EstimateFact[], workAreaId).height != null;
}

export function retainingWallHasSupportedMaterial(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  return retainingWallMaterialReadiness(facts, workAreaId) === "SUPPORTED";
}

export function retainingWallHasMaterialAnswer(
  facts: readonly EstimateFact[],
  workAreaId: string
): boolean {
  const state = retainingWallMaterialReadiness(facts, workAreaId);
  return state === "SUPPORTED" || state === "UNSUPPORTED_EXPLICIT";
}

function resolveWallHeight(
  facts: EstimateContext["facts"],
  workAreaId: string
): { height: number | null; assumptions: string[] } {
  const assumptions: string[] = [];
  const directHeight = getNumberFact(
    facts,
    workAreaId,
    "retaining_wall.height_m"
  );
  if (directHeight) {
    return { height: directHeight, assumptions };
  }

  const high = getNumberFactAny(facts, workAreaId, [
    "retaining_wall.height_high_m",
    "retaining_wall.high_height_m",
  ]);
  const low = getNumberFactAny(facts, workAreaId, [
    "retaining_wall.height_low_m",
    "retaining_wall.low_height_m",
  ]);
  if (high != null && low != null) {
    assumptions.push("Average retaining wall height calculated from high/low points.");
    return { height: round2((high + low) / 2), assumptions };
  }

  return { height: null, assumptions };
}

function getWallMaterialRates(material: string | null, context: EstimateContext) {
  const classified = classifyRetainingWallMaterial(material);
  if (classified === "unsupported") {
    throw new Error(
      "Unsupported retaining wall material must not resolve a commercial rate"
    );
  }
  if (classified === "concrete") {
    const resolved = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "retaining_wall.material.concrete.face_m2",
      workAreaType: "retaining_wall",
      unit: "m2",
      fallbackCostRate: RETAINING_WALL_BENCHMARKS.concreteFace.cost,
      fallbackSellRate: RETAINING_WALL_BENCHMARKS.concreteFace.sell,
      organisationSettings: context.organisationSettings,
    });
    return {
      cost: resolved.costRate,
      sell: resolved.sellRate,
      rateSource: resolved.sourceLabel,
    };
  }

  const resolved = resolveRate({
    rates: context.rates,
    rateType: "material",
    itemKey: "retaining_wall.material.timber.face_m2",
    workAreaType: "retaining_wall",
    unit: "m2",
    fallbackCostRate: RETAINING_WALL_BENCHMARKS.timberFace.cost,
    fallbackSellRate: RETAINING_WALL_BENCHMARKS.timberFace.sell,
    organisationSettings: context.organisationSettings,
  });

  return {
    cost: resolved.costRate,
    sell: resolved.sellRate,
    rateSource: resolved.sourceLabel,
  };
}

export function calculateRetainingWall(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions = ["Engineering/consent unless confirmed"];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "retaining_wall.length_m");
  if (!length) missingInfo.push(formatMissing("Wall length"));

  const heightResult = resolveWallHeight(facts, workArea.id);
  assumptions.push(...heightResult.assumptions);
  if (!heightResult.height) missingInfo.push(formatMissing("Wall height"));

  const material = getStringFact(facts, workArea.id, "retaining_wall.material");
  const materialReadiness = retainingWallMaterialReadiness(facts, workArea.id);
  if (!material) missingInfo.push(formatMissing("Wall material"));

  if (
    materialReadiness === "UNSUPPORTED_EXPLICIT" ||
    materialReadiness === "NOT_SURE"
  ) {
    missingInfo.push(
      formatMissing(
        materialReadiness === "UNSUPPORTED_EXPLICIT"
          ? "Trusted retaining wall material pricing"
          : "Wall material"
      )
    );
    return {
      lineItems: [],
      assumptions,
      missingInfo,
      exclusions,
      confidence: baseConfidence(missingInfo.length),
      assumptionMetadata,
    };
  }

  let effectiveLength = length;
  if (!effectiveLength) {
    effectiveLength = recordDefaultedNumber(assumptionMetadata, {
      key: "retaining_wall.length_m",
      label: "Retaining wall length",
      workAreaId: workArea.id,
      assumedValue: 10,
      unit: "m",
      reason: "No wall length provided",
    });
  }

  let effectiveHeight = heightResult.height;
  if (!effectiveHeight) {
    effectiveHeight = recordDefaultedNumber(assumptionMetadata, {
      key: "retaining_wall.height_m",
      label: "Retaining wall height",
      workAreaId: workArea.id,
      assumedValue: 1.5,
      unit: "m",
      reason: "No wall height provided",
    });
  }

  if (!length || !heightResult.height) {
    assumptions.push("Using assumed retaining wall dimensions for rough estimate.");
  }

  const faceArea = round2(effectiveLength * effectiveHeight);
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getCombinedLabourAccessFactor({
    constraints: context.constraints,
    workAreaAccess: resolveLegacyWorkAreaAccess({
      constraints: context.constraints,
      facts,
      workAreaId: workArea.id,
      workAreaType: "retaining_wall",
    }),
  });
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const physical = buildRetainingWallPhysicalModel({
    context,
    workAreaId: workArea.id,
    material,
  });
  const commercial = commercializeRetainingWall({
    physical,
    facts,
    workAreaId: workArea.id,
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const detailed =
    commercial.mode === "DETAILED_COMPONENT_AUTHORITY";
  const drainageScope = resolveRetainingWallDrainageIncluded({
    facts,
    workAreaId: workArea.id,
    system: physical.system,
  });
  const backfillScope = resolveRetainingWallBackfillIncluded({
    facts,
    workAreaId: workArea.id,
    system: physical.system,
  });
  if (drainageScope.assumed) assumptions.push(RW_DRAINAGE_STANDARD_ASSUMPTION);
  if (backfillScope.assumed) assumptions.push(RW_BACKFILL_STANDARD_ASSUMPTION);
  assumptions.push(...physical.assumptions, ...commercial.assumptions);
  if (detailed) {
    missingInfo.push(...commercial.missingInfo);
  }

  if (!detailed) {
  const baseProductivity = resolveProductivity({
    productivityKey: "retaining_wall.base_labour_hours_per_face_m2",
    unit: "face m²",
    fallbackHoursPerUnit: 2.0,
  });

  let labourHoursPerFaceM2 = baseProductivity.hoursPerUnit;

  const fixingType = getStringFact(facts, workArea.id, "retaining_wall.fixing_type");
  if (fixingType?.toLowerCase().includes("face")) {
    labourHoursPerFaceM2 *= 1.15;
    assumptions.push("Face-fixed retaining wall adds labour complexity allowance.");
  }

  if (getBooleanFact(facts, workArea.id, "retaining_wall.excavation_required")) {
    const excavation = resolveProductivity({
      productivityKey: "retaining_wall.excavation_hours_per_face_m2",
      unit: "face m²",
      fallbackHoursPerUnit: 0.6,
    });
    labourHoursPerFaceM2 += excavation.hoursPerUnit;
  }

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Retaining wall labour",
      quantity: faceArea,
      unit: "face m²",
      productivityHoursPerUnit: labourHoursPerFaceM2,
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

  if (drainageScope.included) {
    const drainage = resolveProductivity({
      productivityKey: "retaining_wall.drainage_hours_per_m",
      unit: "m",
      fallbackHoursPerUnit: 0.4,
    });
    lineItems.push(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Drainage labour",
        quantity: effectiveLength,
        unit: "m",
        productivityHoursPerUnit: drainage.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
        rateSource: labourRate.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    const novacoilRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: MATERIAL_RATE_KEYS.drainageNovacoilLm,
      workAreaType: "retaining_wall",
      unit: "lm",
      fallbackCostRate: RETAINING_WALL_BENCHMARKS.novacoilPerM.cost,
      fallbackSellRate: RETAINING_WALL_BENCHMARKS.novacoilPerM.sell,
      organisationSettings: context.organisationSettings,
    });

    const drainageWastagePercent = resolveMaterialWastage(
      context.materialWastageSettings,
      "default"
    );
    const drainageLength = length ?? effectiveLength;
    const drainageBuildUp = calculateDrainageLm({
      wallLengthM: drainageLength,
      wastagePercent: drainageWastagePercent,
    });
    const drainageMetadata = drainageBuildUp
      ? createDrainageBuildUp({
          result: drainageBuildUp,
          wallLengthM: drainageLength,
          wastagePercent: drainageWastagePercent,
        })
      : null;

    lineItems.push(
      withMaterialBuildUp(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Novacoil drainage with sock/sleeve",
          category: "materials",
          quantity: drainageBuildUp?.novacoilLm ?? effectiveLength,
          unit: "lm",
          notes: "Drainage aggregate allowance included",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor: NO_FINISH_QUALITY_FACTOR,
          costRate: novacoilRates.costRate,
          sellRate: novacoilRates.sellRate,
          rateSource: novacoilRates.sourceLabel,
        }),
        drainageMetadata
      )
    );

    const drainConnection = getStringFact(
      facts,
      workArea.id,
      "retaining_wall.drain_connection_required"
    );
    if (drainConnection) {
      const lower = drainConnection.toLowerCase();
      if (lower.includes("cesspit") || lower.includes("connect")) {
        lineItems.push(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Drainage connection allowance",
            category: "subcontractor",
            recommendedCost: RETAINING_WALL_BENCHMARKS.drainConnection.cost,
            recommendedSell: RETAINING_WALL_BENCHMARKS.drainConnection.sell,
            rateSource: "Benchmark allowance",
            notes: drainConnection,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor: NO_FINISH_QUALITY_FACTOR,
          })
        );
      } else if (lower.includes("not sure")) {
        exclusions.push("Final drainage connection excluded until confirmed.");
      }
    } else {
      assumptions.push(
        "Drainage design and outfall are subject to confirmation."
      );
    }
  } else if (getBooleanFact(facts, workArea.id, "retaining_wall.drainage_required") === null && !drainageScope.assumed) {
    missingInfo.push(formatMissing("Drainage scope"));
  }

  const materialRates = getWallMaterialRates(material, context);
  lineItems.push(
    createRateLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Retaining wall materials",
      category: "materials",
      quantity: faceArea,
      unit: "face m²",
      costRate: materialRates.cost,
      sellRate: materialRates.sell,
      rateSource: materialRates.rateSource,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (backfillScope.included) {
    const backfillLength =
      getNumberFact(facts, workArea.id, "retaining_wall.backfill_length_m") ??
      effectiveLength;
    const backfillHeight =
      getNumberFact(facts, workArea.id, "retaining_wall.backfill_height_m") ??
      effectiveHeight;
    const backfillDepth = getNumberFact(
      facts,
      workArea.id,
      "retaining_wall.backfill_depth_m"
    );

    if (backfillDepth) {
      const backfillLengthValue =
        getNumberFact(facts, workArea.id, "retaining_wall.backfill_length_m") ??
        length ??
        effectiveLength;
      const backfillHeightValue =
        getNumberFact(facts, workArea.id, "retaining_wall.backfill_height_m") ??
        heightResult.height ??
        effectiveHeight;

      const volume =
        backfillLengthValue && backfillHeightValue
          ? calculateBackfillVolume({
              lengthM: backfillLengthValue,
              heightM: backfillHeightValue,
              depthM: backfillDepth,
            })
          : round2(backfillLength * backfillHeight * backfillDepth);

      if (volume != null) {
        assumptions.push(BACKFILL_REFERENCE_ONLY_ASSUMPTION);
        const backfillBuildUp =
          backfillLengthValue && backfillHeightValue
            ? createBackfillVolumeBuildUp({
                volumeM3: volume,
                lengthM: backfillLengthValue,
                heightM: backfillHeightValue,
                depthM: backfillDepth,
              })
            : null;

        const backfillRates = resolveRate({
          rates: context.rates,
          rateType: "material",
          itemKey: "retaining_wall.backfill.face_m2",
          workAreaType: "retaining_wall",
          unit: "m2",
          fallbackCostRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.cost,
          fallbackSellRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.sell,
          organisationSettings: context.organisationSettings,
        });

        lineItems.push(
          withMaterialBuildUp(
            createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Backfill allowance",
              category: "materials",
              quantity: faceArea,
              unit: "face m²",
              costRate: backfillRates.costRate,
              sellRate: backfillRates.sellRate,
              rateSource: backfillRates.sourceLabel,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor: NO_FINISH_QUALITY_FACTOR,
            }),
            backfillBuildUp
          )
        );
      }
    } else {
      const backfillRates = resolveRate({
        rates: context.rates,
        rateType: "material",
        itemKey: "retaining_wall.backfill.face_m2",
        workAreaType: "retaining_wall",
        unit: "m2",
        fallbackCostRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.cost,
        fallbackSellRate: RETAINING_WALL_BENCHMARKS.backfillPerFaceM2.sell,
        organisationSettings: context.organisationSettings,
      });

      lineItems.push(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Backfill allowance",
          category: "materials",
          quantity: faceArea,
          unit: "face m²",
          costRate: backfillRates.costRate,
          sellRate: backfillRates.sellRate,
          rateSource: backfillRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor: NO_FINISH_QUALITY_FACTOR,
        })
      );
    }
  } else if (getBooleanFact(facts, workArea.id, "retaining_wall.backfill_included") === null && !backfillScope.assumed) {
    missingInfo.push(formatMissing("Backfill scope"));
  }
  } else {
    for (const requirement of detailedMoneyMaterials(commercial.requirements)) {
      if (requirement.componentKey === RW_FACE_AREA_COMPONENT) continue;
      if (isPricedMaterialRequirement(requirement)) {
        lineItems.push(
          adaptPricedMaterialRequirementWithoutLegacy({
            requirement,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: requirement.description,
          })
        );
      } else {
        lineItems.push(
          adaptUnpricedMaterialRequirementToEstimateLine({
            requirement,
            workAreaName: workArea.name,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            label: requirement.description,
          })
        );
      }
    }
    for (const requirement of detailedLabour(commercial.requirements)) {
      if (requirement.priced && requirement.hourlyCost != null) {
        lineItems.push(
          createLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: requirement.description,
            quantity: requirement.productivityBasis.quantity,
            unit: requirement.productivityBasis.unit,
            productivityHoursPerUnit: requirement.productivityBasis.hoursPerUnit,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            adjustmentFactor: labourAdjustment,
            qualityFactor: NO_FINISH_QUALITY_FACTOR,
            rateSource: labourRate.sourceLabel,
            componentKey: requirement.componentKey,
            notes: `${requirement.productivityBasis.quantity} ${requirement.productivityBasis.unit} × ${requirement.productivityBasis.hoursPerUnit} h/${requirement.productivityBasis.unit}`,
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
            label: requirement.description,
          })
        );
      }
    }
  }

  const consentStatus = getStringFact(
    facts,
    workArea.id,
    "retaining_wall.engineering_or_consent_status"
  );
  if (consentStatus?.toLowerCase().includes("required")) {
    exclusions.push("Engineering and consent costs excluded unless confirmed.");
  } else if (consentStatus?.toLowerCase().includes("not sure")) {
    assumptions.push("Engineering/consent requirements are subject to confirmation.");
  }

  const cartingDistance = resolveLegacyCartingMetres({
    facts,
    workAreaId: workArea.id,
    factKey: "retaining_wall.carting_distance_m",
  });

  if (cartingDistance && cartingDistance > 0) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Carting/material handling allowance",
        recommendedCost:
          cartingDistance > 30
            ? RETAINING_WALL_BENCHMARKS.cartingLong.cost
            : RETAINING_WALL_BENCHMARKS.cartingModerate.cost,
        recommendedSell:
          cartingDistance > 30
            ? RETAINING_WALL_BENCHMARKS.cartingLong.sell
            : RETAINING_WALL_BENCHMARKS.cartingModerate.sell,
        rateSource: "Benchmark allowance",
        notes: `${cartingDistance} m carting distance — haulage cost, not a second site-access labour multiplier`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
      })
    );
  }

  const disposalIncluded = getBooleanFact(
    facts,
    workArea.id,
    "retaining_wall.disposal_included"
  );
  const hasDisposalLine = lineItems.some((item) =>
    /disposal|cartage allowance/i.test(item.label)
  );

  if (disposalIncluded === true && !hasDisposalLine) {
    const disposalRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "retaining_wall.disposal.allowance",
      workAreaType: "retaining_wall",
      unit: "allowance",
      fallbackCostRate: RETAINING_WALL_BENCHMARKS.disposalAllowance.cost,
      fallbackSellRate: RETAINING_WALL_BENCHMARKS.disposalAllowance.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Disposal / cartage allowance",
        category: "allowance",
        recommendedCost: disposalRates.costRate,
        recommendedSell: disposalRates.sellRate,
        rateSource: disposalRates.sourceLabel,
        notes: [
          `${effectiveLength} m wall length allowance basis`,
          cartingDistance ? `${cartingDistance} m carting distance` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor: NO_FINISH_QUALITY_FACTOR,
      })
    );
  } else if (disposalIncluded === false) {
    exclusions.push("Spoil disposal and cartage excluded unless stated otherwise.");
  } else if (disposalIncluded === null) {
    assumptions.push(
      "Disposal/cartage is subject to confirmation unless stated otherwise."
    );
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
    ...((commercial.requirements.length > 0
      ? commercial.requirements
      : physical.requirements
    ).length > 0
      ? {
          requirements:
            commercial.requirements.length > 0
              ? commercial.requirements
              : physical.requirements,
        }
      : {}),
  };
}
