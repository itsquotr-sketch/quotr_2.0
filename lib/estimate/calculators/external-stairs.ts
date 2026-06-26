import {
  getLabourAdjustmentFactor,
  getQualityFactor,
} from "@/lib/estimate/adjustments";
import {
  EXTERNAL_STAIRS_BENCHMARKS,
  EXTERNAL_STAIRS_DEFAULT_RISER_M,
} from "@/lib/estimate/benchmark-rates";
import {
  quantityBasisFrom,
  withCommercialMetadata,
} from "@/lib/estimate/commercial-realism";
import {
  formatMissing,
  getBooleanFact,
  getBooleanFactAny,
  getNumberFact,
  getNumberFactAny,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import {
  createAllowanceLineItem,
  createFixedLabourLineItem,
  createRateLineItem,
} from "@/lib/estimate/line-items";
import type { QuantityBasis } from "@/lib/estimate/line-item-metadata";
import {
  createFlooringAreaBuildUp,
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

function accessFactor(access: string | null): number {
  if (!access) return 1;
  const lower = access.toLowerCase();
  if (lower.includes("poor") || lower.includes("difficult")) return 1.25;
  if (lower.includes("moderate")) return 1.1;
  return 1;
}

function groundFactor(condition: string | null): number {
  if (!condition) return 1;
  const lower = condition.toLowerCase();
  if (lower.includes("uneven")) return 1.25;
  if (lower.includes("slop")) return 1.15;
  return 1;
}

function widthFactor(widthM: number | null): number {
  if (!widthM || widthM <= 0.9) return 1;
  return Math.min(round2(widthM / 0.9), 1.5);
}

function resolveRiserCount(
  facts: EstimateContext["facts"],
  workAreaId: string
): { count: number | null; approximate: boolean } {
  const explicit = getNumberFactAny(facts, workAreaId, [
    "external_stairs.risers_count",
    "external_stairs.riser_count",
  ]);
  if (explicit) return { count: explicit, approximate: false };

  const derived = getNumberFact(
    facts,
    workAreaId,
    "external_stairs.approximate_riser_count"
  );
  if (derived) return { count: derived, approximate: true };

  const totalRise = getNumberFact(facts, workAreaId, "external_stairs.total_rise_m");
  if (totalRise) {
    return {
      count: Math.ceil(totalRise / EXTERNAL_STAIRS_DEFAULT_RISER_M),
      approximate: true,
    };
  }

  return { count: null, approximate: false };
}

export function calculateExternalStairs(
  context: EstimateContext,
  workArea: EstimateWorkArea
): CalculatorResult {
  const { facts } = context;
  const missingInfo: string[] = [];
  const assumptions: string[] = [];
  const exclusions: string[] = [
    "Consent and engineering are excluded unless specifically included.",
    "Ground remediation is excluded unless specifically included.",
  ];
  const lineItems: CalculatorResult["lineItems"] = [];
  let sortOrder = 1;

  const { count: riserCount, approximate: approximateRisers } = resolveRiserCount(
    facts,
    workArea.id
  );
  const totalRise =
    getNumberFact(facts, workArea.id, "external_stairs.total_rise_m") ??
    getNumberFact(facts, workArea.id, "external_stairs.approximate_total_rise_m");
  const widthM = getNumberFact(facts, workArea.id, "external_stairs.width_m");
  const material = getStringFact(facts, workArea.id, "external_stairs.material");
  const handrailRequired = getBooleanFactAny(facts, workArea.id, [
    "external_stairs.handrail_included",
    "external_stairs.handrail_required",
  ]);
  const balustradeRequired = getBooleanFact(
    facts,
    workArea.id,
    "external_stairs.balustrade_included"
  );
  const landingIncluded = getBooleanFact(
    facts,
    workArea.id,
    "external_stairs.landing_included"
  );
  const landingArea = getNumberFact(facts, workArea.id, "external_stairs.landing_area_m2");
  const landingsCount =
    getNumberFact(facts, workArea.id, "external_stairs.landings_count") ?? 0;
  const existingRemoval = getBooleanFact(
    facts,
    workArea.id,
    "external_stairs.existing_removal"
  );
  const finishRequired = getBooleanFact(
    facts,
    workArea.id,
    "external_stairs.finish_required"
  );
  const finishType = getStringFact(facts, workArea.id, "external_stairs.finish_type");
  const access = getStringFact(facts, workArea.id, "external_stairs.access");
  const groundCondition = getStringFact(
    facts,
    workArea.id,
    "external_stairs.ground_condition"
  );
  const consentStatus = getStringFact(
    facts,
    workArea.id,
    "external_stairs.consent_or_engineering_status"
  );

  if (!riserCount) missingInfo.push(formatMissing("Riser count or total rise"));
  if (!material) missingInfo.push(formatMissing("Stair material"));

  const siteFactor = round2(accessFactor(access) * groundFactor(groundCondition));
  const widthMult = widthFactor(widthM);

  if (approximateRisers && riserCount) {
    assumptions.push(
      `Approximate ${riserCount} risers derived from ${totalRise ?? "standard"} m rise at 175 mm/riser.`
    );
  }

  if (siteFactor > 1) {
    assumptions.push(
      `Site factor ${siteFactor} applied (access: ${access ?? "standard"}, ground: ${groundCondition ?? "level"}).`
    );
  }

  if (consentStatus?.toLowerCase().includes("required")) {
    assumptions.push("Consent/engineering may be required — excluded from allowance.");
    exclusions.push("Building consent and engineering are excluded unless specifically included.");
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

  if (riserCount) {
    const stairProductivity = resolveProductivity({
      productivityKey: "external_stairs.labour_hours_per_riser",
      unit: "riser",
      fallbackHoursPerUnit: 1.5,
    });

    const labourHours =
      riserCount *
      stairProductivity.hoursPerUnit *
      labourAdjustment *
      qualityFactor *
      siteFactor *
      widthMult;

    lineItems.push(
      withOwner(
        withMaterialBuildUp(
          createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "External stair labour",
            labourHours,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            notes: `${riserCount} risers${widthM ? ` · ${widthM} m wide` : ""}`,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          totalRise
            ? {
                key: "stair_risers",
                label: "Stair risers",
                quantity: riserCount,
                unit: "risers",
                display: approximateRisers
                  ? `Approx. ${riserCount} risers based on ${totalRise} m total rise`
                  : `${riserCount} risers`,
                priced: false,
              }
            : {
                key: "stair_risers",
                label: "Stair risers",
                quantity: riserCount,
                unit: "risers",
                display: `${riserCount} risers`,
                priced: false,
              }
        ),
        "in_house_labour",
        {
          scopeKey: "external_stairs.labour",
          basis: quantityBasisFrom({
            sourceFact: approximateRisers
              ? "external_stairs.approximate_riser_count"
              : "external_stairs.risers_count",
            sourceLabel: approximateRisers
              ? "Approximate riser count"
              : "Riser count",
            quantity: riserCount,
            unit: "risers",
            confidence: approximateRisers ? "derived" : "confirmed",
            formula: approximateRisers && totalRise
              ? `ceil(${totalRise} m / 0.175 m)`
              : widthM
                ? `Width: ${widthM} m`
                : undefined,
          }),
        }
      )
    );

    const materialRates = resolveRate({
      rates: context.rates,
      rateType: "material",
      itemKey: "external_stairs.material.riser",
      workAreaType: "external_stairs",
      unit: "riser",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.materialPerRiser.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.materialPerRiser.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withOwner(
        createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "External stair materials",
          category: "materials",
          quantity: round2(riserCount * widthMult),
          unit: "riser",
          costRate: materialRates.costRate,
          sellRate: materialRates.sellRate,
          rateSource: materialRates.sourceLabel,
          notes: material ?? undefined,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "contractor_material",
        {
          scopeKey: "external_stairs.materials",
          basis: quantityBasisFrom({
            sourceFact: "external_stairs.risers_count",
            sourceLabel: "Stair risers",
            quantity: round2(riserCount * widthMult),
            unit: "riser",
            confidence: approximateRisers ? "derived" : "confirmed",
            formula: widthMult > 1 ? `Width factor ×${widthMult}` : undefined,
          }),
        }
      )
    );

    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Stair footing/fixing allowance",
          recommendedCost: EXTERNAL_STAIRS_BENCHMARKS.footingAllowance.cost,
          recommendedSell: EXTERNAL_STAIRS_BENCHMARKS.footingAllowance.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "external_stairs.footings" }
      )
    );
  } else {
    assumptions.push("Using rough external stair allowance due to missing riser count.");
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "External stair rough allowance",
          recommendedCost: EXTERNAL_STAIRS_BENCHMARKS.roughAllowance.cost,
          recommendedSell: EXTERNAL_STAIRS_BENCHMARKS.roughAllowance.sell,
          rateSource: "Benchmark allowance",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "external_stairs.rough" }
      )
    );
  }

  if (landingIncluded || landingArea || landingsCount > 0) {
    const effectiveLandingArea = landingArea ?? (landingsCount > 0 ? landingsCount * 1.2 : 1.2);
    const landingRates = resolveRate({
      rates: context.rates,
      rateType: "scope",
      itemKey: "external_stairs.landing.m2",
      workAreaType: "external_stairs",
      unit: "m2",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.landingPerM2.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.landingPerM2.sell,
      organisationSettings: context.organisationSettings,
    });
    const landingBuildUp = createFlooringAreaBuildUp({
      result: calculateFlooringAreaWithWastage({
        areaM2: effectiveLandingArea,
        wastagePercent: 0,
      })!,
      wastagePercent: 0,
      materialLabel: "Landing",
    });
    lineItems.push(
      withOwner(
        withMaterialBuildUp(
          createRateLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Landing allowance",
            category: "materials",
            quantity: effectiveLandingArea,
            unit: "m²",
            costRate: landingRates.costRate,
            sellRate: landingRates.sellRate,
            rateSource: landingRates.sourceLabel,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            ...landingBuildUp,
            display: `Landing allowance: ${effectiveLandingArea} m²`,
          }
        ),
        "contractor_material",
        {
          scopeKey: "external_stairs.landing",
          basis: quantityBasisFrom({
            sourceFact: landingArea
              ? "external_stairs.landing_area_m2"
              : "external_stairs.landing_included",
            sourceLabel: "Landing area",
            quantity: effectiveLandingArea,
            unit: "m²",
            confidence: landingArea ? "confirmed" : "assumed",
          }),
        }
      )
    );
  }

  if (existingRemoval) {
    const removalRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "external_stairs.removal.each",
      workAreaType: "external_stairs",
      unit: "each",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.removalEach.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.removalEach.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Existing stair removal",
          recommendedCost: removalRates.costRate,
          recommendedSell: removalRates.sellRate,
          rateSource: removalRates.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "in_house_labour",
        { scopeKey: "external_stairs.removal" }
      )
    );
  }

  if (handrailRequired) {
    const handrailLm = riserCount ? round2(riserCount * 0.6) : 4;
    const handrailProductivity = resolveProductivity({
      productivityKey: "external_stairs.handrail_hours_allowance",
      unit: "allowance",
      fallbackHoursPerUnit: 3,
    });

    lineItems.push(
      withOwner(
        createFixedLabourLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Handrail labour allowance",
          labourHours:
            handrailProductivity.hoursPerUnit * labourAdjustment * qualityFactor,
          labourCostRate: labourRate.costRate,
          labourSellRate: labourRate.sellRate,
          rateSource: handrailProductivity.sourceLabel,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
        }),
        "in_house_labour",
        { scopeKey: "external_stairs.handrail_labour" }
      )
    );

    const handrailRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "external_stairs.handrail.lm",
      workAreaType: "external_stairs",
      unit: "lm",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.handrailPerLm.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.handrailPerLm.sell,
      organisationSettings: context.organisationSettings,
    });

    lineItems.push(
      withOwner(
        withMaterialBuildUp(
          createAllowanceLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: "Handrail allowance",
            recommendedCost: handrailLm * handrailRates.costRate,
            recommendedSell: handrailLm * handrailRates.sellRate,
            rateSource: handrailRates.sourceLabel,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
            qualityFactor,
          }),
          {
            key: "handrail",
            label: "Handrail",
            display: "Handrail included",
            priced: false,
          }
        ),
        "subcontractor_allowance",
        {
          scopeKey: "external_stairs.handrail",
          basis: quantityBasisFrom({
            sourceFact: "external_stairs.handrail_included",
            sourceLabel: "Handrail",
            quantity: handrailLm,
            unit: "lm",
            confidence: "confirmed",
          }),
        }
      )
    );
  }

  if (balustradeRequired) {
    const balLm = riserCount ? round2(riserCount * 0.8) : 5;
    const balRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "external_stairs.balustrade.lm",
      workAreaType: "external_stairs",
      unit: "lm",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.balustradePerLm.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.balustradePerLm.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Balustrade allowance",
          recommendedCost: balLm * balRates.costRate,
          recommendedSell: balLm * balRates.sellRate,
          rateSource: balRates.sourceLabel,
          notes: `${balLm} lm allowance`,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        {
          scopeKey: "external_stairs.balustrade",
          basis: quantityBasisFrom({
            sourceFact: "external_stairs.balustrade_included",
            sourceLabel: "Balustrade",
            quantity: balLm,
            unit: "lm",
            confidence: "confirmed",
          }),
        }
      )
    );
  }

  if (
    finishRequired ||
    (finishType && !finishType.toLowerCase().includes("none"))
  ) {
    const finishRates = resolveRate({
      rates: context.rates,
      rateType: "allowance",
      itemKey: "external_stairs.finish.allowance",
      workAreaType: "external_stairs",
      unit: "allowance",
      fallbackCostRate: EXTERNAL_STAIRS_BENCHMARKS.finishAllowance.cost,
      fallbackSellRate: EXTERNAL_STAIRS_BENCHMARKS.finishAllowance.sell,
      organisationSettings: context.organisationSettings,
    });
    lineItems.push(
      withOwner(
        createAllowanceLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Stair finish allowance",
          recommendedCost: finishRates.costRate,
          recommendedSell: finishRates.sellRate,
          rateSource: finishRates.sourceLabel,
          notes: finishType ?? "Finish",
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor,
        }),
        "subcontractor_allowance",
        { scopeKey: "external_stairs.finish" }
      )
    );
  }

  return {
    lineItems,
    assumptions,
    missingInfo,
    exclusions,
    confidence: baseConfidence(missingInfo.length + (riserCount ? 0 : 2)),
  };
}
