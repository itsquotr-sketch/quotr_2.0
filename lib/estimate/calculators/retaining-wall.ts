import {
  getConstraintNotes,
  getLabourAdjustmentFactor,
  getQualityFactor,
  hasPoorAccess,
} from "@/lib/estimate/adjustments";
import { NO_FINISH_QUALITY_FACTOR } from "@/lib/estimate/constants";
import { RETAINING_WALL_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getNumberFact,
  getNumberFactAny,
  getStringFact,
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
  EstimateWorkArea,
} from "@/lib/estimate/types";

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
  const normalized = material?.toLowerCase() ?? "";
  if (
    normalized.includes("concrete") ||
    normalized.includes("block")
  ) {
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
  if (!material) missingInfo.push(formatMissing("Wall material"));

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
  const labourAdjustment = getLabourAdjustmentFactor(context.constraints);
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

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

  if (getBooleanFact(facts, workArea.id, "retaining_wall.drainage_required")) {
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
  } else {
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

  if (getBooleanFact(facts, workArea.id, "retaining_wall.backfill_included")) {
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
        assumptions.push(`Backfill volume calculated: ${volume} m³.`);
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
  } else {
    missingInfo.push(formatMissing("Backfill scope"));
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

  const cartingDistance = getNumberFact(
    facts,
    workArea.id,
    "retaining_wall.carting_distance_m"
  );
  const access = getStringFact(facts, workArea.id, "retaining_wall.access");

  if (cartingDistance || access || hasPoorAccess(context.constraints)) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Carting/material handling allowance",
        recommendedCost:
          cartingDistance && cartingDistance > 30
            ? RETAINING_WALL_BENCHMARKS.cartingLong.cost
            : RETAINING_WALL_BENCHMARKS.cartingModerate.cost,
        recommendedSell:
          cartingDistance && cartingDistance > 30
            ? RETAINING_WALL_BENCHMARKS.cartingLong.sell
            : RETAINING_WALL_BENCHMARKS.cartingModerate.sell,
        rateSource: "Benchmark allowance",
        notes: [
          cartingDistance ? `${cartingDistance} m carting distance` : null,
          access ? `${access} access` : null,
        ]
          .filter(Boolean)
          .join(" · "),
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
  };
}
