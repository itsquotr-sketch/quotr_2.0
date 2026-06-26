import { getQualityFactor } from "@/lib/estimate/adjustments";
import { FITOUT_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getArrayFact,
  getBooleanFact,
  getNumberFact,
  getStringFact,
  isFlooringRemovalOnly,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import {
  calculateFlooringAreaWithWastage,
  calculateLinealMetresWithWastage,
  calculatePaintLitres,
  calculateSheetCount,
} from "@/lib/estimate/material-buildups";
import {
  createFlooringAreaBuildUp,
  createLinealMetresBuildUp,
  createPaintLitresBuildUp,
  createSheetCountBuildUp,
  isSheetMaterialLining,
  sheetMaterialLabel,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { resolveMaterialWastage } from "@/lib/settings/material-wastage";
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
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, config.areaKey);
  if (!area) missingInfo.push(formatMissing("Area"));

  let effectiveArea = area;
  if (!effectiveArea) {
    effectiveArea = recordDefaultedNumber(assumptionMetadata, {
      key: config.areaKey,
      label: "Area",
      workAreaId: workArea.id,
      assumedValue: 20,
      unit: "m²",
      reason: "No area provided",
    });
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
    assumptionMetadata,
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
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const length = getNumberFact(facts, workArea.id, "internal_walls.length_lm");
  const height = getNumberFact(facts, workArea.id, "internal_walls.height_m");
  const sides = getStringFact(facts, workArea.id, "internal_walls.lining_sides");
  const sideFactor = sides?.toLowerCase().includes("both") ? 2 : 1;

  if (!length) missingInfo.push(formatMissing("Wall length"));
  if (!height) missingInfo.push(formatMissing("Wall height"));

  const derivedArea =
    length && height ? round2(length * height * sideFactor) : null;
  let effectiveArea =
    getNumberFact(facts, workArea.id, "internal_walls.area_m2") ?? derivedArea;
  if (!effectiveArea) {
    effectiveArea = recordDefaultedNumber(assumptionMetadata, {
      key: "internal_walls.area_m2",
      label: "Wall lining area",
      workAreaId: workArea.id,
      assumedValue: 20,
      unit: "m²",
      reason: "No wall length/height or area provided",
    });
    assumptions.push("Using assumed internal wall area of 20 m².");
  } else if (derivedArea) {
    assumptions.push(`Calculated lining area: ${effectiveArea} m².`);
  }

  if (getBooleanFact(facts, workArea.id, "internal_walls.demolition_included")) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing wall removal",
        category: "labour",
        quantity: length ?? 10,
        unit: "lm",
        costRate: FITOUT_BENCHMARKS.removalPerM2.cost * 2,
        sellRate: FITOUT_BENCHMARKS.removalPerM2.sell * 2,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor: getQualityFactor(
          context.project,
          context.organisationSettings
        ),
      })
    );
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
      label: "Wall framing labour",
      quantity: length ?? effectiveArea / (height ?? 2.4),
      unit: "lm",
      productivityHoursPerUnit: 0.8,
      labourCostRate: labourRate.costRate,
      labourSellRate: labourRate.sellRate,
      rateSource: labourRate.sourceLabel,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
    })
  );

  lineItems.push(
    createLabourLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Internal wall lining labour",
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

  const liningType = getStringFact(
    facts,
    workArea.id,
    "internal_walls.wall_lining_type"
  );
  const plasterboardType = getStringFact(
    facts,
    workArea.id,
    "internal_walls.plasterboard_type"
  );
  let sheetBuildUp = null;
  if (length && height && (liningType || plasterboardType)) {
    const wastagePercent = resolveMaterialWastage(
      context.materialWastageSettings,
      "sheet_material"
    );
    const sheetResult = calculateSheetCount({
      areaM2: effectiveArea,
      wastagePercent,
    });
    if (sheetResult) {
      sheetBuildUp = createSheetCountBuildUp({
        result: sheetResult,
        areaM2: effectiveArea,
        wastagePercent,
        materialLabel: sheetMaterialLabel(plasterboardType ?? liningType),
      });
    }
  }

  lineItems.push(
    withMaterialBuildUp(
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
      }),
      sheetBuildUp
    )
  );

  if (getBooleanFact(facts, workArea.id, "internal_walls.skirtings_included")) {
    const skirtingLm =
      getNumberFact(facts, workArea.id, "internal_walls.skirting_length_lm") ??
      length ??
      0;
    if (skirtingLm > 0) {
      const skirtingWastage = resolveMaterialWastage(
        context.materialWastageSettings,
        "timber_framing"
      );
      const skirtingBuildUp = calculateLinealMetresWithWastage({
        lengthLm: skirtingLm,
        wastagePercent: skirtingWastage,
      });
      const skirtingMetadata = skirtingBuildUp
        ? createLinealMetresBuildUp({
            result: skirtingBuildUp,
            wastagePercent: skirtingWastage,
            label: "skirting",
          })
        : null;

      lineItems.push(
        withMaterialBuildUp(
          createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Skirting",
            category: "materials",
            quantity: skirtingBuildUp?.totalLm ?? skirtingLm,
            unit: "lm",
            costRate: FITOUT_BENCHMARKS.skirtingLm.cost,
            sellRate: FITOUT_BENCHMARKS.skirtingLm.sell,
            rateSource: "Benchmark allowance",
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          skirtingMetadata
        )
      );
    }
  }

  if (getBooleanFact(facts, workArea.id, "internal_walls.insulation_included")) {
    lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Wall insulation",
        category: "materials",
        quantity: effectiveArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.insulationPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.insulationPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "internal_walls.stopping_included")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Stopping/plastering allowance",
        category: "subcontractor",
        recommendedCost: effectiveArea * FITOUT_BENCHMARKS.stoppingPerM2.cost,
        recommendedSell: effectiveArea * FITOUT_BENCHMARKS.stoppingPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "internal_walls.painting_included")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Painting allowance",
        recommendedCost: effectiveArea * FITOUT_BENCHMARKS.paintingPerM2.cost,
        recommendedSell: effectiveArea * FITOUT_BENCHMARKS.paintingPerM2.sell,
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
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
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

  const ceilingArea = getNumberFact(facts, workArea.id, "ceilings.area_m2");
  const ceilingType = getStringFact(facts, workArea.id, "ceilings.ceiling_type");
  if (ceilingArea && isSheetMaterialLining(ceilingType)) {
    const materialsIndex = result.lineItems.findIndex((item) =>
      item.label.includes("materials allowance")
    );
    if (materialsIndex >= 0) {
      const wastagePercent = resolveMaterialWastage(
        context.materialWastageSettings,
        "sheet_material"
      );
      const sheetResult = calculateSheetCount({
        areaM2: ceilingArea,
        wastagePercent,
      });
      if (sheetResult) {
        const baseItem = result.lineItems[materialsIndex];
        result.lineItems[materialsIndex] = withMaterialBuildUp(
          baseItem,
          createSheetCountBuildUp({
            result: sheetResult,
            areaM2: ceilingArea,
            wastagePercent,
            materialLabel: sheetMaterialLabel(ceilingType),
          })
        );
      }
    }
  }

  const edgeLm = getNumberFact(facts, workArea.id, "ceilings.edge_lining_length_lm");
  const edgeType = getStringFact(facts, workArea.id, "ceilings.edge_lining_type");
  if (edgeLm && edgeType && edgeType.toLowerCase() !== "none") {
    const edgeWastage = resolveMaterialWastage(
      context.materialWastageSettings,
      "timber_framing"
    );
    const edgeBuildUp = calculateLinealMetresWithWastage({
      lengthLm: edgeLm,
      wastagePercent: edgeWastage,
    });
    const edgeMetadata = edgeBuildUp
      ? createLinealMetresBuildUp({
          result: edgeBuildUp,
          wastagePercent: edgeWastage,
          label: `${edgeType} edge lining`,
        })
      : null;

    result.lineItems.push(
      withMaterialBuildUp(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: `${edgeType} edge lining`,
          category: "materials",
          quantity: edgeBuildUp?.totalLm ?? edgeLm,
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
        }),
        edgeMetadata
      )
    );
  }

  const effectiveCeilingArea = ceilingArea ?? 20;
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );

  if (getBooleanFact(facts, workArea.id, "ceilings.demolition_included")) {
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing ceiling removal",
        category: "labour",
        quantity: effectiveCeilingArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.removalPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.removalPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "ceilings.battens_included")) {
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Ceiling battens/framing",
        category: "materials",
        quantity: effectiveCeilingArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.ceilingBattensPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.ceilingBattensPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "ceilings.insulation_included")) {
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Ceiling insulation",
        category: "materials",
        quantity: effectiveCeilingArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.insulationPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.insulationPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "ceilings.stopping_included")) {
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Ceiling stopping/plastering allowance",
        category: "subcontractor",
        recommendedCost: effectiveCeilingArea * FITOUT_BENCHMARKS.stoppingPerM2.cost,
        recommendedSell: effectiveCeilingArea * FITOUT_BENCHMARKS.stoppingPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "ceilings.painting_included")) {
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Ceiling painting allowance",
        recommendedCost: effectiveCeilingArea * FITOUT_BENCHMARKS.paintingPerM2.cost,
        recommendedSell: effectiveCeilingArea * FITOUT_BENCHMARKS.paintingPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
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

  const supplyScope = getStringFact(facts, workArea.id, "doors.supply_scope");
  const installOnly = supplyScope?.toLowerCase().includes("install only");

  lineItems.push(
    createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: installOnly ? "Door installation allowance" : "Door supply/install allowance",
      recommendedCost: effectiveCount * FITOUT_BENCHMARKS.doorsEach.cost,
      recommendedSell: effectiveCount * FITOUT_BENCHMARKS.doorsEach.sell,
      rateSource: "Benchmark allowance",
      notes: getStringFact(facts, workArea.id, "doors.door_type") ?? undefined,
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    })
  );

  if (installOnly) {
    assumptions.push("Doors client supplied — install labour and hardware only.");
  }

  if (getBooleanFact(facts, workArea.id, "doors.existing_removal")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Existing door removal/disposal",
        recommendedCost: effectiveCount * 60,
        recommendedSell: effectiveCount * 90,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "doors.architraves_included")) {
    const archLm = effectiveCount * 5;
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Architraves allowance",
        recommendedCost: archLm * FITOUT_BENCHMARKS.architraveLm.cost,
        recommendedSell: archLm * FITOUT_BENCHMARKS.architraveLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "doors.painting_included")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Door painting/staining allowance",
        recommendedCost: effectiveCount * FITOUT_BENCHMARKS.doorPaintingEach.cost,
        recommendedSell: effectiveCount * FITOUT_BENCHMARKS.doorPaintingEach.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

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
  const removalOnly = isFlooringRemovalOnly(facts, workArea.id);

  if (removalOnly) {
    const missingInfo: string[] = [];
    const assumptions = [
      "Flooring removal only — new flooring supply/install excluded.",
    ];
    const lineItems: CalculatorResult["lineItems"] = [];
    const assumptionMetadata = createAssumptionMetadata();
    let sortOrder = 1;
    const rawArea = getNumberFact(facts, workArea.id, "flooring.area_m2");
    let area = rawArea;
    if (!area) {
      area = recordDefaultedNumber(assumptionMetadata, {
        key: "flooring.area_m2",
        label: "Flooring area",
        workAreaId: workArea.id,
        assumedValue: 20,
        unit: "m²",
        reason: "No flooring area provided",
      });
      missingInfo.push(formatMissing("Flooring area"));
      assumptions.push("Using assumed removal area of 20 m².");
    }
    const qualityFactor = getQualityFactor(
      context.project,
      context.organisationSettings
    );

    lineItems.push(
      withPricingOwnership(
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
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "flooring.removal",
          overlapGroup: "flooring_removal",
        }
      )
    );

    if (getBooleanFact(facts, workArea.id, "flooring.disposal_included")) {
      lineItems.push(
        withPricingOwnership(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Flooring disposal allowance",
            recommendedCost: area * FITOUT_BENCHMARKS.removalPerM2.cost,
            recommendedSell: area * FITOUT_BENCHMARKS.removalPerM2.sell,
            rateSource: "Benchmark allowance",
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            pricingOwner: "subcontractor_allowance",
            scopeKey: "flooring.disposal",
            overlapGroup: "flooring_disposal",
          }
        )
      );
    }

    return {
      lineItems,
      assumptions,
      missingInfo,
      exclusions: [],
      confidence: baseConfidence(missingInfo.length),
      assumptionMetadata,
    };
  }

  const result = calculateAreaBasedFitout(context, workArea, {
    areaKey: "flooring.area_m2",
    rate: FITOUT_BENCHMARKS.flooringPerM2,
    label: "Flooring",
    productivityKey: "flooring.labour_hours_per_m2",
    fallbackHoursPerM2: 0.8,
  });

  const flooringArea = getNumberFact(facts, workArea.id, "flooring.area_m2");
  if (flooringArea) {
    const materialsIndex = result.lineItems.findIndex((item) =>
      item.label.includes("materials allowance")
    );
    if (materialsIndex >= 0) {
      const wastagePercent = resolveMaterialWastage(
        context.materialWastageSettings,
        "flooring"
      );
      const flooringResult = calculateFlooringAreaWithWastage({
        areaM2: flooringArea,
        wastagePercent,
      });
      if (flooringResult) {
        const baseItem = result.lineItems[materialsIndex];
        result.lineItems[materialsIndex] = withMaterialBuildUp(
          baseItem,
          createFlooringAreaBuildUp({
            result: flooringResult,
            wastagePercent,
          })
        );
      }
    }
  }

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

  const floorArea = getNumberFact(facts, workArea.id, "flooring.area_m2") ?? 20;
  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const prepLevel = getStringFact(facts, workArea.id, "flooring.floor_prep_level");
  if (prepLevel && !prepLevel.toLowerCase().includes("none")) {
    const isMajor = prepLevel.toLowerCase().includes("major");
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Floor prep/levelling allowance",
        recommendedCost:
          floorArea *
          (isMajor
            ? FITOUT_BENCHMARKS.floorPrepMajor.cost
            : FITOUT_BENCHMARKS.floorPrepMinor.cost),
        recommendedSell:
          floorArea *
          (isMajor
            ? FITOUT_BENCHMARKS.floorPrepMajor.sell
            : FITOUT_BENCHMARKS.floorPrepMinor.sell),
        rateSource: "Benchmark allowance",
        notes: prepLevel,
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "flooring.underlay_included")) {
    result.lineItems.push(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Underlay",
        category: "materials",
        quantity: floorArea,
        unit: "m²",
        costRate: FITOUT_BENCHMARKS.underlayPerM2.cost,
        sellRate: FITOUT_BENCHMARKS.underlayPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "flooring.scotia_included")) {
    const perimeterLm = Math.sqrt(floorArea) * 4;
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Scotia/skirting allowance",
        recommendedCost: perimeterLm * FITOUT_BENCHMARKS.skirtingLm.cost,
        recommendedSell: perimeterLm * FITOUT_BENCHMARKS.skirtingLm.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "flooring.disposal_included")) {
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Flooring disposal allowance",
        recommendedCost: floorArea * FITOUT_BENCHMARKS.removalPerM2.cost,
        recommendedSell: floorArea * FITOUT_BENCHMARKS.removalPerM2.sell,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "flooring.client_supplied")) {
    result.assumptions.push("Flooring client supplied — install labour only.");
    const materialsIndex = result.lineItems.findIndex((item) =>
      item.label.includes("materials allowance")
    );
    if (materialsIndex >= 0) {
      result.lineItems.splice(materialsIndex, 1);
    }
  }

  if (getBooleanFact(facts, workArea.id, "flooring.stairs_or_landings_included")) {
    const stairCount = getNumberFact(facts, workArea.id, "flooring.stair_count") ?? 12;
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Stairs/landing flooring allowance",
        recommendedCost: stairCount * 45,
        recommendedSell: stairCount * 68,
        rateSource: "Benchmark allowance",
        sortOrder: result.lineItems.length + 1,
        organisationSettings: context.organisationSettings,
        qualityFactor,
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
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const location = getStringFact(facts, workArea.id, "painting.location");
  const surfaces = getArrayFact(facts, workArea.id, "painting.surfaces");
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

  const surfacesLower = surfaces.map((surface) => surface.toLowerCase());
  const includesWallsOrCeilings =
    surfacesLower.some((surface) => surface.includes("wall")) ||
    surfacesLower.some((surface) => surface.includes("ceiling"));
  const includesDoors =
    surfacesLower.some((surface) => surface.includes("door")) ||
    getBooleanFact(facts, workArea.id, "painting.door_painting_included") === true;
  const includesTrims =
    surfacesLower.some((surface) => surface.includes("trim")) ||
    getBooleanFact(facts, workArea.id, "painting.joinery_surround_painting_required") ===
      true;

  let totalArea = 0;
  if (location?.toLowerCase().includes("internal") || location === "Both") {
    totalArea += internalArea ?? 0;
  }
  if (location?.toLowerCase().includes("external") || location === "Both") {
    totalArea += externalArea ?? 0;
  }
  if (!totalArea && includesWallsOrCeilings) {
    totalArea = internalArea ?? externalArea ?? 0;
  }
  if (!totalArea) {
    missingInfo.push(formatMissing("Painting area"));
    totalArea = recordDefaultedNumber(assumptionMetadata, {
      key: "painting.internal_area_m2",
      label: "Painting area",
      workAreaId: workArea.id,
      assumedValue: 50,
      unit: "m²",
      reason: "No internal/external painting area provided",
    });
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

  if (includesWallsOrCeilings || !includesDoors) {
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
  } else {
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
        notes: "Doors/trims scope — area allowance applied conservatively.",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
  }

  const paintClientSupplied = getBooleanFact(
    facts,
    workArea.id,
    "painting.paint_client_supplied"
  );

  if (!paintClientSupplied) {
    const coatCount =
      coats === "3" ? 3 : coats === "1" ? 1 : coats === "2" ? 2 : 2;
    const paintWastage = resolveMaterialWastage(
      context.materialWastageSettings,
      "paint"
    );
    let paintAreaForBuildUp = 0;
    if (location?.toLowerCase().includes("internal") || location === "Both") {
      paintAreaForBuildUp += internalArea ?? 0;
    }
    if (location?.toLowerCase().includes("external") || location === "Both") {
      paintAreaForBuildUp += externalArea ?? 0;
    }
    if (!paintAreaForBuildUp) {
      paintAreaForBuildUp = totalArea;
    }
    const paintLitresResult =
      paintAreaForBuildUp > 0
        ? calculatePaintLitres({
            areaM2: paintAreaForBuildUp,
            coats: coatCount,
            wastagePercent: paintWastage,
          })
        : null;
    const paintBuildUp = paintLitresResult
      ? createPaintLitresBuildUp({
          result: paintLitresResult,
          areaM2: paintAreaForBuildUp,
          coats: coatCount,
          wastagePercent: paintWastage,
        })
      : null;

    const paintingRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "painting.material.m2",
      workAreaType: "painting",
      unit: "m2",
      fallbackCostRate: FITOUT_BENCHMARKS.paintingPerM2.cost,
      fallbackSellRate: FITOUT_BENCHMARKS.paintingPerM2.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withMaterialBuildUp(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Paint materials",
          category: "materials",
          quantity: adjustedArea,
          unit: "m²",
          costRate: paintingRates.costRate,
          sellRate: paintingRates.sellRate,
          rateSource: paintingRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        paintBuildUp
      )
    );
  } else {
    assumptions.push("Paint supplied by client — labour/coordination only.");
  }

  if (includesDoors) {
    const doorCount =
      getNumberFact(facts, workArea.id, "painting.door_count") ?? 2;
    const doorRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "painting.door.each",
      workAreaType: "painting",
      unit: "each",
      fallbackCostRate: FITOUT_BENCHMARKS.doorPaintingEach.cost,
      fallbackSellRate: FITOUT_BENCHMARKS.doorPaintingEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Door painting allowance",
        recommendedCost: doorCount * doorRates.costRate,
        recommendedSell: doorCount * doorRates.sellRate,
        rateSource: doorRates.sourceLabel,
        notes: `${doorCount} door(s)`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (includesTrims) {
    const trimLm =
      getNumberFact(facts, workArea.id, "painting.joinery_surround_length_lm") ??
      Math.max(Math.sqrt(totalArea) * 4, 10);
    const trimRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "painting.trim.lm",
      workAreaType: "painting",
      unit: "lm",
      fallbackCostRate: FITOUT_BENCHMARKS.skirtingLm.cost * 0.6,
      fallbackSellRate: FITOUT_BENCHMARKS.skirtingLm.sell * 0.6,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Trim painting allowance",
        recommendedCost: trimLm * trimRates.costRate,
        recommendedSell: trimLm * trimRates.sellRate,
        rateSource: trimRates.sourceLabel,
        notes:
          getNumberFact(facts, workArea.id, "painting.joinery_surround_length_lm") ==
          null
            ? "Conservative trim allowance — length not confirmed"
            : `${trimLm} lm trims`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (surfaces.length > 0) {
    assumptions.push(`Painting surfaces: ${surfaces.join(", ")}.`);
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions: [],
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
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

  if (getBooleanFact(facts, workArea.id, "plastering.sanding_included")) {
    const sandArea = getNumberFact(facts, workArea.id, "plastering.area_m2") ?? 20;
    result.lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Sanding/prep allowance",
        recommendedCost: sandArea * 8,
        recommendedSell: sandArea * 12,
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

  const surfaceType = getStringFact(facts, workArea.id, "plastering.surface_type");
  if (surfaceType?.toLowerCase().includes("patch")) {
    result.assumptions.push("Patch repair scope — conservative area allowance applied.");
  }

  return result;
}
