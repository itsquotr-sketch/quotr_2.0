import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import { DEMOLITION_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  quantityBasisFrom,
  withCommercialMetadata,
} from "@/lib/estimate/commercial-realism";
import {
  formatMissing,
  getArrayFact,
  getBooleanFact,
  getBooleanFactAny,
  getNumberFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import type { QuantityBasis } from "@/lib/estimate/line-item-metadata";
import {
  createFlooringAreaBuildUp,
  createLinealMetresBuildUp,
  withMaterialBuildUp,
} from "@/lib/estimate/material-buildup-meta";
import { calculateFlooringAreaWithWastage } from "@/lib/estimate/material-buildups";
import {
  withPricingOwnership,
  type PricingOwner,
} from "@/lib/estimate/pricing-ownership";
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
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";

function withOwner(
  item: EstimateLineItemInput,
  owner: PricingOwner,
  opts?: { basis?: QuantityBasis; scopeKey?: string }
): EstimateLineItemInput {
  const withBasis = opts?.basis
    ? withCommercialMetadata(item, { quantityBasis: opts.basis })
    : item;
  return withPricingOwnership(withBasis, {
    pricingOwner: owner,
    scopeKey: opts?.scopeKey,
  });
}

function scopeIncludes(scopeItems: string[], ...keywords: string[]): boolean {
  const joined = scopeItems.map((item) => item.toLowerCase()).join(" ");
  return keywords.some((keyword) => joined.includes(keyword.toLowerCase()));
}

function accessFactor(access: string | null): number {
  if (!access) return 1;
  const lower = access.toLowerCase();
  if (lower.includes("very poor")) return 1.4;
  if (lower.includes("poor") || lower.includes("difficult")) return 1.25;
  if (lower.includes("moderate")) return 1.1;
  return 1;
}

function floorLevelFactor(level: string | null): number {
  if (!level) return 1;
  const lower = level.toLowerCase();
  if (lower.includes("upper")) return 1.15;
  if (lower.includes("basement")) return 1.1;
  return 1;
}

function hazardousRiskLevel(facts: EstimateContext["facts"], workAreaId: string): string | null {
  return (
    getStringFact(facts, workAreaId, "demolition.hazardous_materials_risk") ??
    getStringFact(facts, workAreaId, "demolition.hazardous_materials_suspected")
  );
}

export function calculateDemolition(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [
    "Structural demolition and consent works are excluded unless specifically included.",
    "Hazardous material testing/removal is excluded unless specifically stated.",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const scopeItems = getArrayFact(facts, workArea.id, "demolition.scope_items");
  const area = getNumberFact(facts, workArea.id, "demolition.area_m2");
  const wallLength = getNumberFact(facts, workArea.id, "demolition.wall_length_m");
  const floorArea = getNumberFact(facts, workArea.id, "demolition.floor_area_m2");
  const ceilingArea = getNumberFact(facts, workArea.id, "demolition.ceiling_area_m2");
  const cartingDistance = getNumberFact(facts, workArea.id, "demolition.carting_distance_m");
  const access = getStringFact(facts, workArea.id, "demolition.access");
  const floorLevel = getStringFact(facts, workArea.id, "demolition.floor_level");
  const servicesIsolated = getStringFact(facts, workArea.id, "demolition.services_isolated");

  if (scopeItems.length === 0) {
    missingInfo.push(formatMissing("Demolition scope items"));
  }

  const effectiveArea =
    area ??
    (floorArea && ceilingArea
      ? floorArea + ceilingArea
      : floorArea ?? ceilingArea ?? null);

  if (!effectiveArea && scopeItems.length > 0) {
    assumptions.push("Using allowance-based strip-out — specific areas not confirmed.");
  }

  let baseArea = effectiveArea;
  if (!baseArea) {
    baseArea = recordDefaultedNumber(assumptionMetadata, {
      key: "demolition.area_m2",
      label: "Demolition area",
      workAreaId: workArea.id,
      assumedValue: 25,
      unit: "m²",
      reason: "No demolition area or floor/ceiling areas provided",
    });
    assumptions.push("Using assumed demolition area of 25 m² where quantities are unknown.");
  }

  const accessMult = accessFactor(access);
  const floorMult = floorLevelFactor(floorLevel);
  const siteFactor = round2(accessMult * floorMult);

  if (siteFactor > 1) {
    assumptions.push(
      `Access/floor level factor ${siteFactor} applied (access: ${access ?? "standard"}, level: ${floorLevel ?? "ground"}).`
    );
  }

  if (servicesIsolated?.toLowerCase().includes("by others")) {
    assumptions.push("Services isolation by others — contractor demolition only.");
    exclusions.push("Services isolation and disconnection are excluded (by others).");
  } else if (servicesIsolated?.toLowerCase() === "no") {
    missingInfo.push(formatMissing("Services isolation"));
  }

  const hazardous = hazardousRiskLevel(facts, workArea.id);
  if (hazardous && !hazardous.toLowerCase().includes("none")) {
    assumptions.push(`Hazardous materials risk noted: ${hazardous}. No hazardous removal priced.`);
    exclusions.push(
      "Hazardous material testing/removal is excluded unless specifically stated."
    );
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourAdjustment = getLabourAdjustmentFactor(context.constraints);
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const demoProductivity = resolveProductivity({
    productivityKey: "demolition.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 0.35,
  });

  const labourQuantity = round2(baseArea * siteFactor);
  lineItems.push(
    withOwner(
      createLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Demolition/strip-out labour",
        quantity: labourQuantity,
        unit: "m²",
        productivityHoursPerUnit: demoProductivity.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        adjustmentFactor: labourAdjustment,
        qualityFactor,
        rateSource: labourRate.sourceLabel,
        notes: scopeItems.length > 0 ? scopeItems.join(", ") : undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      }),
      "in_house_labour",
      {
        scopeKey: "demolition.general",
        basis: quantityBasisFrom({
          sourceFact: effectiveArea ? "demolition.area_m2" : "demolition.scope_items",
          sourceLabel: effectiveArea ? "Demolition area" : "Strip-out scope",
          quantity: labourQuantity,
          unit: "m²",
          confidence: effectiveArea ? "confirmed" : "assumed",
          formula:
            siteFactor > 1
              ? `Area × access/floor factor ${siteFactor}`
              : undefined,
        }),
      }
    )
  );

  if (scopeItems.length > 0) {
    assumptions.push(`Demolition scope: ${scopeItems.join(", ")}.`);
  }

  if (wallLength || scopeIncludes(scopeItems, "wall", "internal wall", "linings")) {
    const wallLm = wallLength ?? (scopeIncludes(scopeItems, "wall") ? 10 : 0);
    if (wallLm > 0) {
      const wallRates = resolveRate({
        rates: context.rates,
        rateType: "scope",
        itemKey: "demolition.wall.lm",
        workAreaType: "demolition",
        unit: "lm",
        fallbackCostRate: DEMOLITION_BENCHMARKS.wallPerLm.cost,
        fallbackSellRate: DEMOLITION_BENCHMARKS.wallPerLm.sell,
        organisationSettings: context.organisationSettings,
      });
      const wallBuildUp = createLinealMetresBuildUp({
        result: { baseLm: wallLm, totalLm: wallLm },
        wastagePercent: 0,
        label: "wall removal",
      });
      const wallQty = round2(wallLm * siteFactor);
      lineItems.push(
        withOwner(
          withMaterialBuildUp(
            createRateLineItem({
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: "Wall demolition allowance",
              category: "labour",
              quantity: wallQty,
              unit: "lm",
              costRate: wallRates.costRate,
              sellRate: wallRates.sellRate,
              rateSource: wallRates.sourceLabel,
              sortOrder: sortOrder++,
              organisationSettings: context.organisationSettings,
              qualityFactor,
            }),
            {
              ...wallBuildUp,
              display: `Approx. ${wallLm} lm wall removal`,
            }
          ),
          "in_house_labour",
          {
            scopeKey: "demolition.wall",
            basis: quantityBasisFrom({
              sourceFact: wallLength
                ? "demolition.wall_length_m"
                : "demolition.scope_items",
              sourceLabel: "Wall removal length",
              quantity: wallQty,
              unit: "lm",
              confidence: wallLength ? "confirmed" : "assumed",
            }),
          }
        )
      );
    }
  }

  const effectiveFloorArea =
    floorArea ??
    (scopeIncludes(scopeItems, "floor", "carpet", "vinyl", "tile") ? baseArea : null);
  if (effectiveFloorArea) {
    const floorRates = resolveRate({
      rates: context.rates,
      rateType: "scope",
      itemKey: "demolition.flooring.m2",
      workAreaType: "demolition",
      unit: "m2",
      fallbackCostRate: DEMOLITION_BENCHMARKS.flooringPerM2.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.flooringPerM2.sell,
      organisationSettings: context.organisationSettings,
    });
    const floorBuildUp = createFlooringAreaBuildUp({
      result: calculateFlooringAreaWithWastage({
        areaM2: effectiveFloorArea,
        wastagePercent: 0,
      })!,
      wastagePercent: 0,
      materialLabel: "Flooring removal",
    });
    const floorQty = round2(effectiveFloorArea * siteFactor);
    lineItems.push(
      withOwner(
        withMaterialBuildUp(
          createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Flooring removal allowance",
            category: "labour",
            quantity: floorQty,
            unit: "m²",
            costRate: floorRates.costRate,
            sellRate: floorRates.sellRate,
            rateSource: floorRates.sourceLabel,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            ...floorBuildUp,
            display: `Approx. ${effectiveFloorArea} m² flooring removal`,
          }
        ),
        "in_house_labour",
        {
          scopeKey: "demolition.flooring",
          basis: quantityBasisFrom({
            sourceFact: "demolition.floor_area_m2",
            sourceLabel: "Flooring removal area",
            quantity: floorQty,
            unit: "m²",
            confidence: floorArea ? "confirmed" : "assumed",
          }),
        }
      )
    );
  }

  if (ceilingArea || scopeIncludes(scopeItems, "ceiling")) {
    const ceilArea = ceilingArea ?? (scopeIncludes(scopeItems, "ceiling") ? baseArea * 0.5 : 0);
    if (ceilArea > 0) {
      const ceilingRates = resolveRate({
        rates: context.rates,
        rateType: "scope",
        itemKey: "demolition.ceiling.m2",
        workAreaType: "demolition",
        unit: "m2",
        fallbackCostRate: DEMOLITION_BENCHMARKS.ceilingPerM2.cost,
        fallbackSellRate: DEMOLITION_BENCHMARKS.ceilingPerM2.sell,
        organisationSettings: context.organisationSettings,
      });
      lineItems.push(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Ceiling removal allowance",
          category: "labour",
          quantity: round2(ceilArea * siteFactor),
          unit: "m²",
          costRate: ceilingRates.costRate,
          sellRate: ceilingRates.sellRate,
          rateSource: ceilingRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  }

  if (scopeIncludes(scopeItems, "kitchen")) {
    const kitchenRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.kitchen.each",
      workAreaType: "demolition",
      unit: "each",
      fallbackCostRate: DEMOLITION_BENCHMARKS.kitchenEach.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.kitchenEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Kitchen removal allowance",
          recommendedCost: kitchenRates.costRate,
          recommendedSell: kitchenRates.sellRate,
          rateSource: kitchenRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "demolition.kitchen" }
      )
    );
  }

  if (scopeIncludes(scopeItems, "bathroom")) {
    const bathroomRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.bathroom.each",
      workAreaType: "demolition",
      unit: "each",
      fallbackCostRate: DEMOLITION_BENCHMARKS.bathroomEach.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.bathroomEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Bathroom strip-out allowance",
          recommendedCost: bathroomRates.costRate,
          recommendedSell: bathroomRates.sellRate,
          rateSource: bathroomRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "demolition.bathroom" }
      )
    );
  }

  if (
    scopeIncludes(scopeItems, "fixture", "joinery", "vanity", "tapware", "cabinet")
  ) {
    const fixtureRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.fixture.removal",
      workAreaType: "demolition",
      unit: "each",
      fallbackCostRate: DEMOLITION_BENCHMARKS.fixtureJoineryEach.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.fixtureJoineryEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Fixture/joinery removal allowance",
          recommendedCost: fixtureRates.costRate,
          recommendedSell: fixtureRates.sellRate,
          rateSource: fixtureRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "demolition.fixtures" }
      )
    );
  }

  const disposalIncluded =
    getBooleanFactAny(facts, workArea.id, [
      "demolition.disposal_included",
      "demolition.waste_removal_required",
    ]) ?? scopeIncludes(scopeItems, "disposal");

  if (disposalIncluded) {
    const wasteRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.disposal.allowance",
      workAreaType: "demolition",
      unit: "allowance",
      fallbackCostRate: DEMOLITION_BENCHMARKS.disposalAllowance.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.disposalAllowance.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Waste removal/disposal allowance",
          category: "allowance",
          recommendedCost: wasteRates.costRate,
          recommendedSell: wasteRates.sellRate,
          rateSource: wasteRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "demolition.disposal" }
      )
    );

    const wastePerM2Rates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "demolition.waste.m2",
      workAreaType: "demolition",
      unit: "m2",
      fallbackCostRate: DEMOLITION_BENCHMARKS.wastePerM2.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.wastePerM2.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withOwner(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Disposal by area allowance",
          category: "allowance",
          quantity: baseArea,
          unit: "m²",
          costRate: wastePerM2Rates.costRate,
          sellRate: wastePerM2Rates.sellRate,
          rateSource: wastePerM2Rates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        {
          scopeKey: "demolition.disposal_area",
          basis: quantityBasisFrom({
            sourceFact: "demolition.area_m2",
            sourceLabel: "Disposal area",
            quantity: baseArea,
            unit: "m²",
            confidence: effectiveArea ? "confirmed" : "assumed",
          }),
        }
      )
    );
  }

  if (getBooleanFact(facts, workArea.id, "demolition.skip_bin_included")) {
    const skipRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.skip_bin.each",
      workAreaType: "demolition",
      unit: "each",
      fallbackCostRate: DEMOLITION_BENCHMARKS.skipBinEach.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.skipBinEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Skip bin allowance",
          recommendedCost: skipRates.costRate,
          recommendedSell: skipRates.sellRate,
          rateSource: skipRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "demolition.skip_bin" }
      )
    );
  }

  if (cartingDistance && cartingDistance > 20) {
    const cartingRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "demolition.carting.allowance",
      workAreaType: "demolition",
      unit: "allowance",
      fallbackCostRate: DEMOLITION_BENCHMARKS.cartingAllowance.cost,
      fallbackSellRate: DEMOLITION_BENCHMARKS.cartingAllowance.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        withMaterialBuildUp(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Carting/access allowance",
            recommendedCost: cartingRates.costRate,
            recommendedSell: cartingRates.sellRate,
            rateSource: cartingRates.sourceLabel,
            notes: `${cartingDistance} m carting distance`,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            key: "carting_distance",
            label: "Carting distance",
            quantity: cartingDistance,
            unit: "m",
            display: `Carting distance allowance: ${cartingDistance} m`,
            priced: false,
          }
        ),
        "subcontractor_allowance",
        {
          scopeKey: "demolition.carting",
          basis: quantityBasisFrom({
            sourceFact: "demolition.carting_distance_m",
            sourceLabel: "Carting distance",
            quantity: cartingDistance,
            unit: "m",
            confidence: "confirmed",
          }),
        }
      )
    );
  } else if (
    access &&
    (access.toLowerCase().includes("poor") || access.toLowerCase().includes("moderate"))
  ) {
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Access/carting allowance",
          recommendedCost: DEMOLITION_BENCHMARKS.cartingAllowance.cost,
          recommendedSell: DEMOLITION_BENCHMARKS.cartingAllowance.sell,
          rateSource: "Benchmark allowance",
          notes: access,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        {
          scopeKey: "demolition.access",
          basis: quantityBasisFrom({
            sourceFact: "demolition.access",
            sourceLabel: "Site access",
            quantity: accessMult,
            unit: "factor",
            confidence: "confirmed",
            formula: `Access factor: ${access}`,
          }),
        }
      )
    );
  }

  if (getBooleanFact(facts, workArea.id, "demolition.salvage_required")) {
    assumptions.push("Salvage of materials required — additional labour may apply.");
  }

  if (getBooleanFact(facts, workArea.id, "demolition.noise_hours_restriction")) {
    assumptions.push("Noise/working hours restrictions may affect programme.");
  }

  lineItems.push(
    withOwner(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Demolition minimum allowance",
        recommendedCost: DEMOLITION_BENCHMARKS.minimum.cost,
        recommendedSell: DEMOLITION_BENCHMARKS.minimum.sell,
        rateSource: "Benchmark allowance",
        notes: "Minimum strip-out allowance applied",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      }),
      "subcontractor_allowance",
      { scopeKey: "demolition.minimum" }
    )
  );

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length),
    assumptionMetadata,
  };
}
