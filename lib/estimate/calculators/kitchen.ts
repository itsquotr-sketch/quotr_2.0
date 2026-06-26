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
  // Quality factor applies once to material/allowance lines only (not labour).
  // Benchmark allowances are calibrated at standard spec; premium/budget scales cabinetry/finishes.
  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });

  const packageProductivity = resolveProductivity({
    productivityKey: "kitchen.labour_hours_per_m2",
    unit: "m²",
    fallbackHoursPerUnit: 16,
  });

  lineItems.push(
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
    })
  );

  if (getBooleanFact(facts, workArea.id, "kitchen.demolition_required")) {
    const demo = resolveProductivity({
      productivityKey: "kitchen.demolition_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 8,
    });
    lineItems.push(
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
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.cabinetry_included")) {
    const clientSupplied = getBooleanFact(
      facts,
      workArea.id,
      "kitchen.cabinetry_client_supplied"
    );
    const cabinetry = resolveProductivity({
      productivityKey: "kitchen.cabinetry_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 20,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: clientSupplied
          ? "Cabinetry installation labour"
          : "Cabinetry labour allowance",
        labourHours: cabinetry.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: cabinetry.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );

    if (clientSupplied) {
      assumptions.push(
        "Cabinetry client supplied — install and coordination only."
      );
      lineItems.push(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Cabinetry installation allowance",
          recommendedCost: KITCHEN_BENCHMARKS.cabinetryInstallOnly.cost,
          recommendedSell: KITCHEN_BENCHMARKS.cabinetryInstallOnly.sell,
          rateSource: "Benchmark allowance",
          notes: getStringFact(facts, workArea.id, "kitchen.cabinetry_type") ?? undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    } else {
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
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Cabinetry allowance",
          recommendedCost: cabinetryRates.costRate,
          recommendedSell: cabinetryRates.sellRate,
          rateSource: cabinetryRates.sourceLabel,
          notes: getStringFact(facts, workArea.id, "kitchen.cabinetry_type") ?? undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        })
      );
    }
  } else {
    missingInfo.push(formatMissing("Cabinetry scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.benchtop_included")) {
    const benchtop = resolveProductivity({
      productivityKey: "kitchen.benchtop_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 6,
    });
    lineItems.push(
      createFixedLabourLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Benchtop labour allowance",
        labourHours: benchtop.hoursPerUnit,
        labourCostRate: labourRate.costRate,
        labourSellRate: labourRate.sellRate,
        rateSource: benchtop.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
      })
    );
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
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Benchtop allowance",
        recommendedCost: benchtopRates.costRate,
        recommendedSell: benchtopRates.sellRate,
        rateSource: benchtopRates.sourceLabel,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else {
    missingInfo.push(formatMissing("Benchtop scope"));
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.appliances_included")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Appliances allowance",
        recommendedCost: KITCHEN_BENCHMARKS.appliances.cost,
        recommendedSell: KITCHEN_BENCHMARKS.appliances.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  } else if (getBooleanFact(facts, workArea.id, "kitchen.appliances_client_supplied")) {
    assumptions.push("Appliances client supplied — installation allowance only.");
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Appliance installation allowance",
        recommendedCost: KITCHEN_BENCHMARKS.applianceInstall.cost,
        recommendedSell: KITCHEN_BENCHMARKS.applianceInstall.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.splashback_included")) {
    const splashArea =
      getNumberFact(facts, workArea.id, "kitchen.splashback_area_m2") ?? 3;
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Splashback allowance",
        recommendedCost: KITCHEN_BENCHMARKS.splashback.cost,
        recommendedSell: KITCHEN_BENCHMARKS.splashback.sell,
        rateSource: "Benchmark allowance",
        notes: splashArea ? `Approx. ${splashArea} m²` : undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.rangehood_included")) {
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Rangehood/venting allowance",
        category: "subcontractor",
        recommendedCost: KITCHEN_BENCHMARKS.rangehood.cost,
        recommendedSell: KITCHEN_BENCHMARKS.rangehood.sell,
        rateSource: "Benchmark allowance",
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  if (getBooleanFact(facts, workArea.id, "kitchen.flooring_included")) {
    const flooringArea =
      getNumberFact(facts, workArea.id, "kitchen.flooring_area_m2") ??
      effectiveArea;
    lineItems.push(
      createAllowanceLineItem({
        workAreaId: workArea.id,
        workAreaName: workArea.name,
        label: "Kitchen flooring allowance",
        recommendedCost: flooringArea * KITCHEN_BENCHMARKS.flooring.cost,
        recommendedSell: flooringArea * KITCHEN_BENCHMARKS.flooring.sell,
        rateSource: "Benchmark allowance",
        notes: getStringFact(facts, workArea.id, "kitchen.flooring_type") ?? undefined,
        sortOrder: sortOrder++,
        organisationSettings: context.organisationSettings,
        qualityFactor,
      })
    );
  }

  const plumbingIncluded =
    getTradeChangesIncluded(facts, workArea.id, "kitchen.plumbing_changes") ??
    getBooleanFact(facts, workArea.id, "kitchen.plumbing_required");
  if (plumbingIncluded) {
    const plumbingLevel = getStringFact(facts, workArea.id, "kitchen.plumbing_changes");
    const isMajor = plumbingLevel?.toLowerCase().includes("major");
    lineItems.push(
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
      })
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
      })
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
    })
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
