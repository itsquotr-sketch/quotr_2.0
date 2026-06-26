import { getQualityFactor, getQualityFactorNote, getWorkAreaAccessFactor } from "@/lib/estimate/adjustments";
import { BATHROOM_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  applyAllowanceMinimum,
  applyAllowanceMinimumToLineItem,
  applyLabourMinimums,
  createFixedLabourWithMinimums,
  resolveBathroomTotalTilingArea,
  resolveBathroomWallLiningArea,
  resolveBathroomWaterproofingArea,
  withCommercialMetadata,
} from "@/lib/estimate/commercial-realism";
import {
  formatMissing,
  getArrayFact,
  getBooleanFact,
  getBooleanFactAny,
  getFinishLevel,
  getNumberFact,
  getStringFact,
  getTradeChangesIncluded,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createFixedLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import { rateFieldsFromResolved } from "@/lib/estimate/line-item-helpers";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { calculateFlooringAreaWithWastage, calculateSheetCount } from "@/lib/estimate/material-buildups";
import {
  createFlooringAreaBuildUp,
  createSheetCountBuildUp,
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

function carpentryPrepHours(areaM2: number, renovationType: string | null): number {
  const base = renovationType?.toLowerCase().includes("full") ? 16 : 10;
  return round2(Math.min(32, base + areaM2 * 0.5));
}

function isFullOrStandardRenovation(renovationType: string | null): boolean {
  const lower = renovationType?.toLowerCase() ?? "";
  return lower.includes("full") || lower.includes("standard");
}

function smallBathroomFactor(areaM2: number): number {
  return areaM2 < 6 ? 1.1 : 1;
}

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
    "Hazardous material testing/removal unless specifically stated",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
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

  let effectiveArea = area;
  if (!effectiveArea) {
    effectiveArea = recordDefaultedNumber(assumptionMetadata, {
      key: "bathroom.area_m2",
      label: "Bathroom area",
      workAreaId: workArea.id,
      assumedValue: 5,
      unit: "m²",
      reason: "No bathroom area provided",
    });
    assumptions.push("Using assumed bathroom area of 5 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const renovationType = getStringFact(facts, workArea.id, "bathroom.renovation_type");
  const demolitionRequired = getBooleanFact(
    facts,
    workArea.id,
    "bathroom.demolition_required"
  );
  const accessValue = getStringFact(facts, workArea.id, "bathroom.access");
  const accessFactor = getWorkAreaAccessFactor(accessValue);
  const accessLabel = accessValue ?? undefined;
  const smallJobFactor = smallBathroomFactor(effectiveArea);

  if (demolitionRequired) {
    const demo = resolveProductivity({
      productivityKey: "bathroom.demolition_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 10,
    });
    const demoMinimums = applyLabourMinimums({
      calculatedHours: demo.hoursPerUnit,
      minCrewSize: 2,
      minDurationHours: 4,
      minTotalHours: 8,
      accessFactor,
      smallJobFactor,
      accessLabel,
    });
    lineItems.push(
      withPricingOwnership(
        createFixedLabourWithMinimums({
          item: createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Demolition/strip-out",
            labourHours: demoMinimums.finalHours,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: demo.sourceLabel,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          labourMinimum: demoMinimums.metadata,
          organisationSettings: context.organisationSettings,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "bathroom.demolition",
          overlapGroup: "bathroom_demolition",
        }
      )
    );
  }

  const carpentryHours = carpentryPrepHours(effectiveArea, renovationType);
  const carpentryMinTotal = renovationType?.toLowerCase().includes("full") ? 16 : 8;
  const carpentryMinimums = applyLabourMinimums({
    calculatedHours: carpentryHours,
    minCrewSize: 2,
    minDurationHours: renovationType?.toLowerCase().includes("full") ? 8 : 4,
    minTotalHours: carpentryMinTotal,
    accessFactor,
    smallJobFactor,
    accessLabel,
  });
  lineItems.push(
    withPricingOwnership(
      createFixedLabourWithMinimums({
        item: createFixedLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Bathroom carpentry/prep labour",
          labourHours: carpentryMinimums.finalHours,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: labourRate.sourceLabel,
          notes: "Framing, substrate prep, linings prep — excludes specialist trades.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        labourMinimum: carpentryMinimums.metadata,
        organisationSettings: context.organisationSettings,
      }),
      {
        pricingOwner: "in_house_labour",
        scopeKey: "bathroom.carpentry_prep",
        overlapGroup: "bathroom_carpentry",
      }
    )
  );

  const tilingIncludedEarly = getBooleanFact(
    facts,
    workArea.id,
    "bathroom.tiling_included"
  );
  const waterproofingIncluded = getBooleanFactAny(facts, workArea.id, [
    "bathroom.waterproofing_included",
    "bathroom.waterproofing_required",
  ]);

  const tilingResolved = resolveBathroomTotalTilingArea(
    facts,
    workArea.id,
    effectiveArea,
    tilingIncludedEarly
  );

  if (waterproofingIncluded) {
    const waterproofingAreaResult = resolveBathroomWaterproofingArea(
      facts,
      workArea.id,
      effectiveArea,
      tilingIncludedEarly !== false ? tilingResolved.basis : null
    );

    const waterproofingArea = waterproofingAreaResult.area;
    const areaBasedCost =
      waterproofingArea && waterproofingArea > 0
        ? waterproofingArea * BATHROOM_BENCHMARKS.waterproofingPerM2.cost
        : 0;
    const areaBasedSell =
      waterproofingArea && waterproofingArea > 0
        ? waterproofingArea * BATHROOM_BENCHMARKS.waterproofingPerM2.sell
        : 0;

    const waterproofingApplied = applyAllowanceMinimum({
      calculatedCost:
        areaBasedCost || BATHROOM_BENCHMARKS.waterproofingMinimum.cost,
      calculatedSell:
        areaBasedSell || BATHROOM_BENCHMARKS.waterproofingMinimum.sell,
      minimumCost: BATHROOM_BENCHMARKS.waterproofingMinimum.cost,
      minimumSell: BATHROOM_BENCHMARKS.waterproofingMinimum.sell,
      reason: "Minimum waterproofing trade allowance",
      scopeKey: "bathroom.waterproofing",
    });

    const waterproofingBuildUp =
      waterproofingArea && waterproofingArea > 0
        ? createFlooringAreaBuildUp({
            result: calculateFlooringAreaWithWastage({
              areaM2: waterproofingArea,
              wastagePercent: 0,
            })!,
            wastagePercent: 0,
            materialLabel: "Waterproofing",
          })
        : null;

    let waterproofingItem = withMaterialBuildUp(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Waterproofing allowance",
        category: "subcontractor",
        recommendedCost: waterproofingApplied.cost,
        recommendedSell: waterproofingApplied.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      }),
      waterproofingBuildUp
        ? {
            ...waterproofingBuildUp,
            display: `Approx. ${waterproofingArea} m² waterproofing area`,
          }
        : null
    );

    if (waterproofingApplied.metadata) {
      waterproofingItem = withCommercialMetadata(waterproofingItem, {
        allowanceMinimum: waterproofingApplied.metadata,
        quantityBasis: waterproofingAreaResult.basis ?? undefined,
      });
    } else if (waterproofingAreaResult.basis) {
      waterproofingItem = withCommercialMetadata(waterproofingItem, {
        quantityBasis: waterproofingAreaResult.basis,
      });
    }

    lineItems.push(
      withPricingOwnership(waterproofingItem, {
        pricingOwner: "subcontractor_allowance",
        scopeKey: "bathroom.waterproofing",
        overlapGroup: "bathroom_waterproofing",
      })
    );
  }

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

  const tilingIncluded = getBooleanFact(facts, workArea.id, "bathroom.tiling_included");

  if (tilingIncluded !== false) {
    const totalTilingArea = tilingResolved.area;
    const tilingWastage = resolveMaterialWastage(
      context.materialWastageSettings,
      "flooring"
    );
    const tileBuildUpResult =
      totalTilingArea > 0
        ? calculateFlooringAreaWithWastage({
            areaM2: totalTilingArea,
            wastagePercent: tilingWastage,
          })
        : null;
    const tileBuildUp = tileBuildUpResult
      ? createFlooringAreaBuildUp({
          result: tileBuildUpResult,
          wastagePercent: tilingWastage,
          materialLabel: "Tiling",
        })
      : null;

    let tilingItem = withMaterialBuildUp(
      createRateLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Tiling allowance",
        category: "subcontractor",
        quantity: totalTilingArea,
        unit: "m²",
        costRate: tilingRates.costRate,
        sellRate: tilingRates.sellRate,
        rateSource: tilingRates.sourceLabel,
        notes: tileExtent
          ? `${tileExtent} tiling allowance based on approx. ${totalTilingArea} m² total tiling area`
          : `Tiling allowance based on approx. ${totalTilingArea} m² total tiling area`,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      }),
      tileBuildUp
        ? {
            ...tileBuildUp,
            display: `Tiling allowance based on approx. ${totalTilingArea} m² total tiling area`,
          }
        : null
    );

    tilingItem = withCommercialMetadata(tilingItem, {
      quantityBasis: tilingResolved.basis,
    });

    tilingItem = applyAllowanceMinimumToLineItem(
      tilingItem,
      {
        minimumCost: BATHROOM_BENCHMARKS.tilingMinimum.cost * qualityFactor,
        minimumSell: BATHROOM_BENCHMARKS.tilingMinimum.sell * qualityFactor,
        reason: "Minimum tiling trade allowance",
        scopeKey: "bathroom.tiling",
      },
      context.organisationSettings
    );

    lineItems.push(
      withPricingOwnership(tilingItem, {
        pricingOwner: "subcontractor_allowance",
        scopeKey: "bathroom.tiling",
        overlapGroup: "bathroom_tiling",
      })
    );
  }

  const clientSuppliedFixtures = getBooleanFact(
    facts,
    workArea.id,
    "bathroom.fixtures_client_supplied"
  );

  let fixturesCost = 0;
  let fixturesSell = 0;

  if (clientSuppliedFixtures) {
    assumptions.push("Bathroom fixtures client supplied — install labour only.");
    const fixtureInstall = resolveProductivity({
      productivityKey: "bathroom.fixture_install_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 8,
    });
    lineItems.push(
      withPricingOwnership(
        createFixedLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fixture installation labour",
          labourHours: fixtureInstall.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: fixtureInstall.sourceLabel,
          notes: "Client-supplied vanity/tapware — supply excluded.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "bathroom.fixture_install",
          overlapGroup: "bathroom_fixtures",
        }
      )
    );
  } else {
    const includedFixtures = getArrayFact(
      facts,
      workArea.id,
      "bathroom.fixtures_included"
    );
    const fixtureMap: Record<string, { cost: number; sell: number }> = {
      Vanity: BATHROOM_BENCHMARKS.vanity,
      Shower: BATHROOM_BENCHMARKS.shower,
      Toilet: BATHROOM_BENCHMARKS.toilet,
    };

    if (includedFixtures.length > 0) {
      for (const fixture of includedFixtures) {
        const rates = fixtureMap[fixture];
        if (rates) {
          fixturesCost += rates.cost;
          fixturesSell += rates.sell;
        }
      }
    } else {
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
    }
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
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fixtures allowance",
          category: "materials",
          recommendedCost: fixturesRates.costRate,
          recommendedSell: fixturesRates.sellRate,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
          ...rateFieldsFromResolved(fixturesRates),
        }),
        {
          pricingOwner: "contractor_material",
          scopeKey: "bathroom.fixtures",
          overlapGroup: "bathroom_fixtures",
        }
      )
    );
  }

  if (getBooleanFact(facts, workArea.id, "bathroom.underfloor_heating_included")) {
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Underfloor heating allowance",
          category: "subcontractor",
          recommendedCost: BATHROOM_BENCHMARKS.underfloorHeating.cost,
          recommendedSell: BATHROOM_BENCHMARKS.underfloorHeating.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "bathroom.underfloor_heating",
          overlapGroup: "bathroom_heating",
        }
      )
    );
  }

  const plumbingChanges =
    getTradeChangesIncluded(facts, workArea.id, "bathroom.plumbing_changes") ??
    getBooleanFact(facts, workArea.id, "bathroom.plumbing_allowance");
  if (plumbingChanges) {
    const plumbingLevel = getStringFact(facts, workArea.id, "bathroom.plumbing_changes");
    const isMajor = plumbingLevel?.toLowerCase().includes("major");
    const plumbingCost = isMajor
      ? BATHROOM_BENCHMARKS.plumbingMajor.cost
      : BATHROOM_BENCHMARKS.plumbingMinor.cost;
    const plumbingSell = isMajor
      ? BATHROOM_BENCHMARKS.plumbingMajor.sell
      : BATHROOM_BENCHMARKS.plumbingMinor.sell;
    const plumbingApplied = applyAllowanceMinimum({
      calculatedCost: plumbingCost,
      calculatedSell: plumbingSell,
      minimumCost: BATHROOM_BENCHMARKS.plumbingMinor.cost,
      minimumSell: BATHROOM_BENCHMARKS.plumbingMinor.sell,
      reason: "Minimum plumbing trade allowance",
      scopeKey: "bathroom.plumbing",
    });
    let plumbingItem = createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Plumbing allowance",
      category: "subcontractor",
      recommendedCost: plumbingApplied.cost,
      recommendedSell: plumbingApplied.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    });
    if (plumbingApplied.metadata) {
      plumbingItem = withCommercialMetadata(plumbingItem, {
        allowanceMinimum: plumbingApplied.metadata,
      });
    }
    lineItems.push(
      withPricingOwnership(plumbingItem, {
        pricingOwner: "subcontractor_allowance",
        scopeKey: "bathroom.plumbing",
        overlapGroup: "bathroom_plumbing",
      })
    );
  } else if (plumbingChanges === false) {
    assumptions.push("Plumbing by others — excluded from estimate.");
  }

  const electricalChanges =
    getTradeChangesIncluded(facts, workArea.id, "bathroom.electrical_changes") ??
    getBooleanFact(facts, workArea.id, "bathroom.electrical_allowance");
  if (electricalChanges) {
    const electricalLevel = getStringFact(
      facts,
      workArea.id,
      "bathroom.electrical_changes"
    );
    const isMajor = electricalLevel?.toLowerCase().includes("major");
    const electricalCost = isMajor
      ? BATHROOM_BENCHMARKS.electricalMajor.cost
      : BATHROOM_BENCHMARKS.electricalMinor.cost;
    const electricalSell = isMajor
      ? BATHROOM_BENCHMARKS.electricalMajor.sell
      : BATHROOM_BENCHMARKS.electricalMinor.sell;
    const electricalApplied = applyAllowanceMinimum({
      calculatedCost: electricalCost,
      calculatedSell: electricalSell,
      minimumCost: BATHROOM_BENCHMARKS.electricalMinor.cost,
      minimumSell: BATHROOM_BENCHMARKS.electricalMinor.sell,
      reason: "Minimum electrical trade allowance",
      scopeKey: "bathroom.electrical",
    });
    let electricalItem = createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Electrical allowance",
      category: "subcontractor",
      recommendedCost: electricalApplied.cost,
      recommendedSell: electricalApplied.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    });
    if (electricalApplied.metadata) {
      electricalItem = withCommercialMetadata(electricalItem, {
        allowanceMinimum: electricalApplied.metadata,
      });
    }
    lineItems.push(
      withPricingOwnership(electricalItem, {
        pricingOwner: "subcontractor_allowance",
        scopeKey: "bathroom.electrical",
        overlapGroup: "bathroom_electrical",
      })
    );
  } else if (electricalChanges === false) {
    assumptions.push("Electrical by others — excluded from estimate.");
  }

  if (getBooleanFact(facts, workArea.id, "bathroom.ventilation_included")) {
    const ventilationApplied = applyAllowanceMinimum({
      calculatedCost: BATHROOM_BENCHMARKS.extractorFan.cost,
      calculatedSell: BATHROOM_BENCHMARKS.extractorFan.sell,
      minimumCost: BATHROOM_BENCHMARKS.extractorFan.cost,
      minimumSell: BATHROOM_BENCHMARKS.extractorFan.sell,
      reason: "Minimum ventilation trade allowance",
      scopeKey: "bathroom.ventilation",
    });
    let ventilationItem = createAllowanceLineItem({
      workAreaId: workArea.id,
      workAreaName: workArea.name,
      label: "Extractor fan/ventilation allowance",
      category: "subcontractor",
      recommendedCost: ventilationApplied.cost,
      recommendedSell: ventilationApplied.sell,
      rateSource: "Benchmark allowance",
      sortOrder: sortOrder++,
      organisationSettings: context.organisationSettings,
      qualityFactor,
    });
    if (ventilationApplied.metadata) {
      ventilationItem = withCommercialMetadata(ventilationItem, {
        allowanceMinimum: ventilationApplied.metadata,
      });
    }
    lineItems.push(
      withPricingOwnership(ventilationItem, {
        pricingOwner: "subcontractor_allowance",
        scopeKey: "bathroom.ventilation",
        overlapGroup: "bathroom_ventilation",
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "bathroom.wall_lining_included")) {
    const wallLiningResolved = resolveBathroomWallLiningArea(
      facts,
      workArea.id,
      effectiveArea
    );
    const wallLiningArea = wallLiningResolved.area;

    const wetAreaLiningRequired =
      waterproofingIncluded === true ||
      getStringFact(facts, workArea.id, "bathroom.shower_type")
        ?.toLowerCase()
        .includes("tiled") === true;

    const liningMaterialLabel = wetAreaLiningRequired
      ? "Aqualine"
      : sheetMaterialLabel("Plasterboard");

    let wallLiningBuildUp = null;
    if (wallLiningArea && wallLiningArea > 0 && wetAreaLiningRequired) {
      const wastagePercent = resolveMaterialWastage(
        context.materialWastageSettings,
        "sheet_material"
      );
      const sheetResult = calculateSheetCount({
        areaM2: wallLiningArea,
        wastagePercent,
      });
      if (sheetResult) {
        wallLiningBuildUp = createSheetCountBuildUp({
          result: sheetResult,
          areaM2: wallLiningArea,
          wastagePercent,
          materialLabel: liningMaterialLabel,
        });
      }
    }

    lineItems.push(
      withPricingOwnership(
        withCommercialMetadata(
          withMaterialBuildUp(
            createAllowanceLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Wall lining (GIB/Aqualine) allowance",
              category: "materials",
              recommendedCost:
                wallLiningArea * BATHROOM_BENCHMARKS.wallLiningPerM2.cost,
              recommendedSell:
                wallLiningArea * BATHROOM_BENCHMARKS.wallLiningPerM2.sell,
              rateSource: "Benchmark allowance",
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor,
            }),
            wallLiningBuildUp
          ),
          { quantityBasis: wallLiningResolved.basis }
        ),
        {
          pricingOwner: "contractor_material",
          scopeKey: "bathroom.wall_lining",
          overlapGroup: "bathroom_wall_lining",
        }
      )
    );

    const liningInstall = resolveProductivity({
      productivityKey: "bathroom.wall_lining_install_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 6,
    });
    const liningMinimums = applyLabourMinimums({
      calculatedHours: liningInstall.hoursPerUnit,
      minCrewSize: 2,
      minDurationHours: 4,
      minTotalHours: 8,
      accessFactor,
      smallJobFactor,
      accessLabel,
    });
    lineItems.push(
      withPricingOwnership(
        withCommercialMetadata(
          createFixedLabourWithMinimums({
            item: createFixedLabourLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Wall lining install labour",
              labourHours: liningMinimums.finalHours,
              labourCostRate: labourRate.costRate,
              labourSellRate: labourRate.sellRate,
              rateSource: liningInstall.sourceLabel,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
            }),
            labourMinimum: liningMinimums.metadata,
            organisationSettings: context.organisationSettings,
          }),
          { quantityBasis: wallLiningResolved.basis }
        ),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "bathroom.wall_lining_install",
          overlapGroup: "bathroom_wall_lining_install",
        }
      )
    );
  }

  if (getBooleanFact(facts, workArea.id, "bathroom.floor_prep_included")) {
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Floor levelling/substrate prep allowance",
          category: "subcontractor",
          recommendedCost: BATHROOM_BENCHMARKS.floorPrepMinor.cost,
          recommendedSell: BATHROOM_BENCHMARKS.floorPrepMinor.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "bathroom.floor_prep",
          overlapGroup: "bathroom_floor_prep",
        }
      )
    );
  }

  if (renovationType?.toLowerCase().includes("full")) {
    assumptions.push("Full strip-out and rebuild — component trade allowances applied.");
  } else if (renovationType?.toLowerCase().includes("minor")) {
    assumptions.push("Minor refresh scope — limited strip-out and trade changes assumed.");
  }

  const hasComponentFinishes =
    waterproofingIncluded === true ||
    tilingIncluded !== false ||
    fixturesCost > 0 ||
    clientSuppliedFixtures === true;

  if (!hasComponentFinishes) {
    let materialsCost = effectiveArea * BATHROOM_BENCHMARKS.materialsPerM2.cost;
    let materialsSell = effectiveArea * BATHROOM_BENCHMARKS.materialsPerM2.sell;
    materialsCost = Math.max(
      materialsCost,
      BATHROOM_BENCHMARKS.minimumPackage.cost
    );
    materialsSell = Math.max(
      materialsSell,
      BATHROOM_BENCHMARKS.minimumPackage.sell
    );

    lineItems.push(
      withPricingOwnership(
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
        }),
        {
          pricingOwner: "contractor_material",
          scopeKey: "bathroom.materials_package",
          overlapGroup: "bathroom_materials",
        }
      )
    );
  } else {
    assumptions.push(
      "Component-based bathroom pricing — broad package labour/materials not applied."
    );
  }

  const subcontractorAllowanceCount = lineItems.filter(
    (item) => item.pricingOwner === "subcontractor_allowance"
  ).length;
  const needsCoordination =
    isFullOrStandardRenovation(renovationType) &&
    (subcontractorAllowanceCount >= 3 ||
      (demolitionRequired && renovationType?.toLowerCase().includes("full")));

  if (needsCoordination) {
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Project coordination and site allowance",
          category: "allowance",
          recommendedCost: BATHROOM_BENCHMARKS.coordinationAllowance.cost,
          recommendedSell: BATHROOM_BENCHMARKS.coordinationAllowance.sell,
          rateSource: "Benchmark allowance",
          notes: "Sequencing, site visits and trade coordination for multi-trade bathroom renovation.",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "bathroom.coordination",
          overlapGroup: "bathroom_coordination",
        }
      )
    );
    assumptions.push(
      "Project coordination allowance included for multi-trade bathroom renovation."
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
