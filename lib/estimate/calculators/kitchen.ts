import { getQualityFactor, getQualityFactorNote } from "@/lib/estimate/adjustments";
import { KITCHEN_BENCHMARKS } from "@/lib/estimate/benchmark-rates";
import {
  formatMissing,
  getBooleanFact,
  getFinishLevel,
  getNumberFact,
  getStringFact,
  getTradeChangesIncluded,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createFixedLabourLineItem,
  createLabourLineItem,
} from "@/lib/estimate/line-items";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate, rateUnitsMatch } from "@/lib/estimate/rates";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { baseConfidence } from "@/lib/estimate/summary";
import {
  createAssumptionMetadata,
  recordDefaultedNumber,
} from "@/lib/estimate/assumption-metadata";
import { rateFieldsFromResolved } from "@/lib/estimate/line-item-helpers";
import type {
  CalculatorResult,
  EstimateContext,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type { OrganisationRate } from "@/components/setup/types";

/** Named kitchen allowance keys that already follow cabinetry/benchtop contract. */
export const KITCHEN_RESOLVED_ALLOWANCE_KEYS = {
  cabinetry: "kitchen.cabinetry.allowance",
  benchtop: "kitchen.benchtop.allowance",
  appliances: "kitchen.appliances.allowance",
  applianceInstall: "kitchen.appliance_install.allowance",
  splashback: "kitchen.splashback.allowance",
  rangehood: "kitchen.rangehood.allowance",
} as const;

/** Facts this calculator reads for scope, quantity, or allowance. */
export const KITCHEN_CALCULATOR_CONSUMED_FACTS = [
  "kitchen.area_m2",
  "kitchen.finish_level",
  "kitchen.cabinetry_included",
  "kitchen.cabinetry_client_supplied",
  "kitchen.cabinetry_type",
  "kitchen.benchtop_included",
  "kitchen.splashback_included",
  "kitchen.splashback_area_m2",
  "kitchen.rangehood_included",
  "kitchen.flooring_included",
  "kitchen.flooring_area_m2",
  "kitchen.flooring_type",
  "kitchen.demolition_required",
  "kitchen.appliances_included",
  "kitchen.appliances_client_supplied",
  "kitchen.plumbing_changes",
  "kitchen.plumbing_required",
  "kitchen.electrical_changes",
  "kitchen.electrical_required",
  "kitchen.renovation_type",
] as const;

function kitchenAllowanceRates(
  context: EstimateContext,
  itemKey: string,
  fallback: { cost: number; sell: number }
) {
  const unit = "allowance";
  const rates = context.rates.filter(
    (rate: OrganisationRate) => !rate.unit || rateUnitsMatch(rate.unit, unit)
  );
  return resolveRate({
    rates,
    rateType: "allowance",
    itemKey,
    workAreaType: "kitchen",
    unit,
    fallbackCostRate: fallback.cost,
    fallbackSellRate: fallback.sell,
    organisationSettings: context.organisationSettings,
  });
}

export function calculateKitchen(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions = [
    "Structural changes",
    "Consent unless confirmed",
    "Final finish selections beyond allowance",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  const assumptionMetadata = createAssumptionMetadata();
  let sortOrder = 1;

  const area = getNumberFact(facts, workArea.id, "kitchen.area_m2");
  if (!area) missingInfo.push(formatMissing("Kitchen area"));

  const finishLevel = getFinishLevel(
    facts,
    workArea.id,
    "kitchen",
    context.project.qualityLevel
  );

  if (
    !getStringFact(facts, workArea.id, "kitchen.finish_level") &&
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
      key: "kitchen.area_m2",
      label: "Kitchen area",
      workAreaId: workArea.id,
      assumedValue: 10,
      unit: "m²",
      reason: "No kitchen area provided",
    });
    assumptions.push("Using assumed kitchen area of 10 m² for rough estimate.");
  }

  const qualityFactor = getQualityFactor(
    context.project,
    context.organisationSettings
  );
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const cabinetryIncluded = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.cabinetry_included"
  );
  const cabinetryClientSupplied = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.cabinetry_client_supplied"
  );
  const benchtopIncluded = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.benchtop_included"
  );
  const splashbackIncluded = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.splashback_included"
  );
  const rangehoodIncluded = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.rangehood_included"
  );
  const flooringIncluded = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.flooring_included"
  );
  const demolitionRequired = getBooleanFact(
    facts,
    workArea.id,
    "kitchen.demolition_required"
  );

  const hasComponentScope =
    cabinetryIncluded === true ||
    benchtopIncluded === true ||
    splashbackIncluded === true ||
    rangehoodIncluded === true ||
    flooringIncluded === true ||
    demolitionRequired === true;

  if (!hasComponentScope) {
    const packageProductivity = resolveProductivity({
      productivityKey: "kitchen.labour_hours_per_m2",
      unit: "m²",
      fallbackHoursPerUnit: 16,
    });

    lineItems.push(
      withPricingOwnership(
        createLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Kitchen labour",
          quantity: effectiveArea,
          unit: "m²",
          productivityHoursPerUnit: packageProductivity.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: labourRate.sourceLabel,
          notes: `Finish level: ${finishLevel}`,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "kitchen.package_labour",
          overlapGroup: "kitchen_coordination",
        }
      )
    );
  }

  if (demolitionRequired) {
    const demo = resolveProductivity({
      productivityKey: "kitchen.demolition_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 8,
    });
    lineItems.push(
      withPricingOwnership(
        createFixedLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Demolition/strip-out",
          labourHours: demo.hoursPerUnit,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: demo.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        {
          pricingOwner: "in_house_labour",
          scopeKey: "kitchen.demolition",
          overlapGroup: "kitchen_demolition",
        }
      )
    );
  }

  if (cabinetryIncluded) {
    const cabinetry = resolveProductivity({
      productivityKey: "kitchen.cabinetry_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 20,
    });

    if (cabinetryClientSupplied) {
      assumptions.push(
        "Cabinetry client supplied — installation labour only, no supply allowance."
      );
      lineItems.push(
        withPricingOwnership(
          createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Cabinetry installation labour",
            labourHours: cabinetry.hoursPerUnit,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: cabinetry.sourceLabel,
            notes:
              getStringFact(facts, workArea.id, "kitchen.cabinetry_type") ??
              undefined,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          {
            pricingOwner: "in_house_labour",
            scopeKey: "kitchen.cabinetry_install",
            overlapGroup: "kitchen_cabinetry_install",
          }
        )
      );
    } else {
      lineItems.push(
        withPricingOwnership(
          createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Cabinetry installation labour",
            labourHours: cabinetry.hoursPerUnit,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: cabinetry.sourceLabel,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          {
            pricingOwner: "in_house_labour",
            scopeKey: "kitchen.cabinetry_install",
            overlapGroup: "kitchen_cabinetry_install",
          }
        )
      );

      const cabinetryRates = resolveRate({
        rates: context.rates,
        rateType: "allowance",
        itemKey: "kitchen.cabinetry.allowance",
        workAreaType: "kitchen",
        unit: "allowance",
        fallbackCostRate: KITCHEN_BENCHMARKS.cabinetry.cost,
        fallbackSellRate: KITCHEN_BENCHMARKS.cabinetry.sell,
        organisationSettings: context.organisationSettings,
      });

      lineItems.push(
        withPricingOwnership(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Cabinetry allowance",
            category: "materials",
            recommendedCost: cabinetryRates.costRate,
            recommendedSell: cabinetryRates.sellRate,
            rateSource: cabinetryRates.sourceLabel,
            notes:
              getStringFact(facts, workArea.id, "kitchen.cabinetry_type") ??
              undefined,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            pricingOwner: "contractor_material",
            scopeKey: "kitchen.cabinetry_supply",
            overlapGroup: "kitchen_cabinetry_supply",
          }
        )
      );
    }
  } else {
    missingInfo.push(formatMissing("Cabinetry scope"));
  }

  if (benchtopIncluded) {
    const benchtopRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "kitchen.benchtop.allowance",
      workAreaType: "kitchen",
      unit: "allowance",
      fallbackCostRate: KITCHEN_BENCHMARKS.benchtop.cost,
      fallbackSellRate: KITCHEN_BENCHMARKS.benchtop.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Benchtop supply/install allowance",
          category: "subcontractor",
          recommendedCost: benchtopRates.costRate,
          recommendedSell: benchtopRates.sellRate,
          rateSource: benchtopRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.benchtop",
          overlapGroup: "kitchen_benchtop",
        }
      )
    );
  } else {
    missingInfo.push(formatMissing("Benchtop scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.appliances_included")) {
    const applianceRates = kitchenAllowanceRates(
      context,
      KITCHEN_RESOLVED_ALLOWANCE_KEYS.appliances,
      KITCHEN_BENCHMARKS.appliances
    );
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Appliances allowance",
          recommendedCost: applianceRates.costRate,
          recommendedSell: applianceRates.sellRate,
          ...rateFieldsFromResolved(applianceRates),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "contractor_material",
          scopeKey: "kitchen.appliances",
          overlapGroup: "kitchen_appliances",
        }
      )
    );
  } else if (getBooleanFact(facts, workArea.id, "kitchen.appliances_client_supplied")) {
    assumptions.push("Appliances client supplied — installation allowance only.");
    const applianceInstallRates = kitchenAllowanceRates(
      context,
      KITCHEN_RESOLVED_ALLOWANCE_KEYS.applianceInstall,
      KITCHEN_BENCHMARKS.applianceInstall
    );
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Appliance installation allowance",
          recommendedCost: applianceInstallRates.costRate,
          recommendedSell: applianceInstallRates.sellRate,
          ...rateFieldsFromResolved(applianceInstallRates),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.appliance_install",
          overlapGroup: "kitchen_appliances",
        }
      )
    );
  }

  if (splashbackIncluded) {
    const splashArea =
      getNumberFact(facts, workArea.id, "kitchen.splashback_area_m2") ?? 3;
    const splashbackRates = kitchenAllowanceRates(
      context,
      KITCHEN_RESOLVED_ALLOWANCE_KEYS.splashback,
      KITCHEN_BENCHMARKS.splashback
    );
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Splashback allowance",
          recommendedCost: splashbackRates.costRate,
          recommendedSell: splashbackRates.sellRate,
          ...rateFieldsFromResolved(splashbackRates),
          notes: splashArea ? `Approx. ${splashArea} m²` : undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.splashback",
          overlapGroup: "kitchen_splashback",
        }
      )
    );
  }

  if (rangehoodIncluded) {
    const rangehoodRates = kitchenAllowanceRates(
      context,
      KITCHEN_RESOLVED_ALLOWANCE_KEYS.rangehood,
      KITCHEN_BENCHMARKS.rangehood
    );
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Rangehood/venting allowance",
          category: "subcontractor",
          recommendedCost: rangehoodRates.costRate,
          recommendedSell: rangehoodRates.sellRate,
          ...rateFieldsFromResolved(rangehoodRates),
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.rangehood",
          overlapGroup: "kitchen_appliances",
        }
      )
    );
  }

  if (flooringIncluded) {
    const flooringArea =
      getNumberFact(facts, workArea.id, "kitchen.flooring_area_m2") ??
      effectiveArea;
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Kitchen flooring allowance",
          recommendedCost: flooringArea * KITCHEN_BENCHMARKS.flooring.cost,
          recommendedSell: flooringArea * KITCHEN_BENCHMARKS.flooring.sell,
          rateSource: "Benchmark allowance",
          notes:
            getStringFact(facts, workArea.id, "kitchen.flooring_type") ??
            undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "contractor_material",
          scopeKey: "kitchen.flooring",
          overlapGroup: "kitchen_materials",
        }
      )
    );
  }

  const plumbingIncluded =
    getTradeChangesIncluded(facts, workArea.id, "kitchen.plumbing_changes") ??
    getBooleanFact(facts, workArea.id, "kitchen.plumbing_required");
  if (plumbingIncluded) {
    const plumbingLevel = getStringFact(facts, workArea.id, "kitchen.plumbing_changes");
    const isMajor = plumbingLevel?.toLowerCase().includes("major");
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Plumbing allowance",
          category: "subcontractor",
          recommendedCost: isMajor
            ? KITCHEN_BENCHMARKS.plumbingMajor.cost
            : plumbingLevel?.toLowerCase().includes("minor")
              ? KITCHEN_BENCHMARKS.plumbingMinor.cost
              : KITCHEN_BENCHMARKS.plumbing.cost,
          recommendedSell: isMajor
            ? KITCHEN_BENCHMARKS.plumbingMajor.sell
            : plumbingLevel?.toLowerCase().includes("minor")
              ? KITCHEN_BENCHMARKS.plumbingMinor.sell
              : KITCHEN_BENCHMARKS.plumbing.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.plumbing",
          overlapGroup: "kitchen_plumbing",
        }
      )
    );
  } else if (plumbingIncluded !== false) {
    missingInfo.push(formatMissing("Plumbing scope"));
  }

  const electricalIncluded =
    getTradeChangesIncluded(facts, workArea.id, "kitchen.electrical_changes") ??
    getBooleanFact(facts, workArea.id, "kitchen.electrical_required");
  if (electricalIncluded) {
    const electricalLevel = getStringFact(
      facts,
      workArea.id,
      "kitchen.electrical_changes"
    );
    const isMajor = electricalLevel?.toLowerCase().includes("major");
    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Electrical allowance",
          category: "subcontractor",
          recommendedCost: isMajor
            ? KITCHEN_BENCHMARKS.electricalMajor.cost
            : electricalLevel?.toLowerCase().includes("minor")
              ? KITCHEN_BENCHMARKS.electricalMinor.cost
              : KITCHEN_BENCHMARKS.electrical.cost,
          recommendedSell: isMajor
            ? KITCHEN_BENCHMARKS.electricalMajor.sell
            : electricalLevel?.toLowerCase().includes("minor")
              ? KITCHEN_BENCHMARKS.electricalMinor.sell
              : KITCHEN_BENCHMARKS.electrical.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: "kitchen.electrical",
          overlapGroup: "kitchen_electrical",
        }
      )
    );
  } else if (electricalIncluded !== false) {
    missingInfo.push(formatMissing("Electrical scope"));
  }

  const renovationType = getStringFact(facts, workArea.id, "kitchen.renovation_type");
  if (renovationType?.toLowerCase().includes("install only")) {
    assumptions.push("Install-only scope — no demolition or supply allowances unless confirmed.");
  } else if (renovationType?.toLowerCase().includes("full")) {
    assumptions.push("Full kitchen renovation — conservative trade and finish allowances applied.");
  }

  const hasComponentFinishes =
    cabinetryIncluded === true ||
    benchtopIncluded === true ||
    splashbackIncluded === true ||
    rangehoodIncluded === true ||
    flooringIncluded === true ||
    plumbingIncluded === true ||
    electricalIncluded === true ||
    cabinetryClientSupplied === true;

  if (!hasComponentFinishes) {
    let materialsCost = effectiveArea * KITCHEN_BENCHMARKS.materialsPerM2.cost;
    let materialsSell = effectiveArea * KITCHEN_BENCHMARKS.materialsPerM2.sell;
    materialsCost = Math.max(
      materialsCost,
      KITCHEN_BENCHMARKS.minimumPackage.cost
    );
    materialsSell = Math.max(
      materialsSell,
      KITCHEN_BENCHMARKS.minimumPackage.sell
    );

    lineItems.push(
      withPricingOwnership(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Kitchen materials/finishes allowance",
          category: "materials",
          recommendedCost: materialsCost,
          recommendedSell: materialsSell,
          rateSource: "Benchmark allowance",
          notes: `Rough kitchen package allowance · Finish level: ${finishLevel}`,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        {
          pricingOwner: "contractor_material",
          scopeKey: "kitchen.materials_package",
          overlapGroup: "kitchen_materials",
        }
      )
    );
  } else {
    assumptions.push(
      "Component-based kitchen pricing — broad package materials allowance not applied."
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
