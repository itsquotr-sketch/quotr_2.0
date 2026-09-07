/**
 * WA-BATHROOM-06 — modular demolition labour and derived disposal allowance.
 *
 * Base hours are physical. Floor area is not a specialist-trade authority.
 * Generic 8-hour demolition minimum is not used on the mature path.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_DEMOLITION_COMPONENTS,
  BATHROOM_DEMOLITION_NESTED_STATEMENT,
  BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS,
  BATHROOM_FLOORING_REMOVAL_NESTED_STATEMENT,
  BATHROOM_HAZMAT_PRICING_REQUIRED,
  BATHROOM_LINING_REMOVAL_NESTED_STATEMENT,
  BATHROOM_QUOTR_ALLOWANCE_LABEL,
  BATHROOM_WASTE_ALLOWANCE_KEY,
  BATHROOM_WASTE_ALLOWANCE_STATEMENT,
  BATHROOM_WASTE_COMPONENT,
  BATHROOM_WASTE_LEVEL_BENCHMARKS,
  BATHROOM_WASTE_LEVEL_KEYS,
} from "@/lib/estimate/bathroom-identities";
import type { BathroomGeometryResolution } from "@/lib/estimate/bathroom-geometry";
import { presentBathroomAreaM2, presentBathroomHours } from "@/lib/estimate/bathroom-linings";
import {
  bathroomDemolitionImpliedByScope,
  parseBathroomDemolitionComponents,
  parseBathroomWasteLevel,
  resolveBathroomJobScope,
  type BathroomDemolitionComponentId,
  type BathroomWasteLevel,
} from "@/lib/estimate/bathroom-scope";
import {
  getBooleanFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { createFixedLabourLineItem, createRateLineItem, buildAmounts } from "@/lib/estimate/line-items";
import { buildWasteRequirement } from "@/lib/estimate/waste-requirement";
import { resolveLegacyHazmat } from "@/lib/project-conditions/legacy-adapter";
import type {
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type {
  EstimateRequirement,
  RequirementAssumption,
} from "@/lib/estimate/requirements";

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
    ? entry.defaultCostRate
    : null;
}

export function bathroomDemolitionSelected(params: {
  facts: EstimateContext["facts"];
  workAreaId: string;
}): boolean {
  const scope = resolveBathroomJobScope({
    jobScope: getStringFact(params.facts as never, params.workAreaId, "bathroom.job_scope"),
    renovationType: getStringFact(
      params.facts as never,
      params.workAreaId,
      "bathroom.renovation_type"
    ),
  });
  const explicit = getBooleanFact(
    params.facts as never,
    params.workAreaId,
    "bathroom.demolition_required"
  );
  if (explicit === false) return false;
  if (explicit === true) return true;
  return bathroomDemolitionImpliedByScope(scope);
}

export function inferBathroomWasteLevel(
  components: readonly BathroomDemolitionComponentId[]
): BathroomWasteLevel {
  let score = 0;
  for (const id of components) {
    if (id === "floor_finish") score += 1;
    else if (id === "wall_lining" || id === "ceiling") score += 2;
    else if (id === "shower" || id === "bath") score += 2;
    else score += 1;
  }
  if (score <= 2) return "minor";
  if (score <= 5) return "standard";
  return "major";
}

function hazmatBlocksOrdinaryDemo(value: string | null): boolean {
  if (value == null) return false;
  const lower = value.trim().toLowerCase();
  if (
    lower === "no" ||
    lower === "none" ||
    lower === "false" ||
    lower === "not suspected" ||
    lower === "clear"
  ) {
    return false;
  }
  return true;
}

function siblingType(context: EstimateContext, type: string): boolean {
  return context.confirmedWorkAreas.some((row) => row.type === type);
}

export function buildBathroomDemolitionEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  geometry: BathroomGeometryResolution;
  accessFactor: number;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
} {
  const { context, workArea, geometry } = params;
  const facts = context.facts;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  if (!bathroomDemolitionSelected({ facts, workAreaId: workArea.id })) {
    return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
  }

  const components = parseBathroomDemolitionComponents({
    facts: facts as never,
    workAreaId: workArea.id,
  });
  if (components.length === 0) {
    missingInfo.push("What is being stripped out of the bathroom?");
    return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
  }

  assumptions.push(BATHROOM_DEMOLITION_NESTED_STATEMENT);
  if (siblingType(context, "demolition")) {
    assumptions.push(
      "A standalone Demolition Work Area is present. Bathroom still owns this room's strip-out — do not price the same selected bathroom demolition twice."
    );
  }
  if (components.includes("floor_finish")) {
    assumptions.push(BATHROOM_FLOORING_REMOVAL_NESTED_STATEMENT);
  }
  if (components.includes("wall_lining") || components.includes("ceiling")) {
    assumptions.push(BATHROOM_LINING_REMOVAL_NESTED_STATEMENT);
  }

  const hazmat = resolveLegacyHazmat({
    constraints: context.constraints,
    facts: facts as never,
    workAreaId: workArea.id,
  });
  const specialist = hazmatBlocksOrdinaryDemo(hazmat);
  if (specialist) {
    missingInfo.push(BATHROOM_HAZMAT_PRICING_REQUIRED);
  }

  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const provenance = {
    calculatorSource: "bathroom-demolition",
    factKeys: [
      "bathroom.demolition_required",
      "bathroom.demolition.components",
      "bathroom.job_scope",
      "bathroom.length_m",
      "bathroom.width_m",
      "bathroom.wall_height_m",
    ],
    constraintKeys: ["hazardous_materials_risk", "site_access", "material_carry_distance"],
  };

  const emitAreaLabour = (opts: {
    id: Extract<BathroomDemolitionComponentId, "floor_finish" | "wall_lining" | "ceiling">;
    label: string;
    area: number | null;
    missing: string;
  }) => {
    if (opts.area == null || opts.area <= 0) {
      missingInfo.push(opts.missing);
      return;
    }
    const hoursKey = BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS[opts.id];
    const productivity = resolveProductivity({
      productivityKey: hoursKey,
      unit: "m2",
      fallbackHoursPerUnit: BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS[opts.id],
      rates: context.rates,
    });
    const baseHours = round2(opts.area * productivity.hoursPerUnit);
    const adjustedHours = round2(baseHours * params.accessFactor);
    const componentKey = BATHROOM_DEMOLITION_COMPONENTS[opts.id];
    const identity = `${presentBathroomAreaM2(opts.area)} · ${presentBathroomHours(adjustedHours)}`;
    const reqAssumptions: RequirementAssumption[] = [];
    if (specialist) {
      requirements.push(
        buildLabourRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey,
          description: opts.label,
          confidence: "low",
          assumptions: reqAssumptions,
          provenance,
          priced: false,
          trade: "labourer",
          baseHours,
          productivityBasis: {
            key: hoursKey,
            hoursPerUnit: productivity.hoursPerUnit,
            unit: "m2",
            quantity: opts.area,
          },
          adjustmentRef: { factors: [] },
          adjustedHours,
          rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
          hourlyCost: null,
          totalCost: null,
          rateProvenance: "missing",
        })
      );
      lineItems.push(
        withPricingOwnership(
          {
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: opts.label,
            category: "labour",
            quantity: adjustedHours,
            unit: "hour",
            itemKey: hoursKey,
            componentKey,
            identitySummary: identity,
            notes: BATHROOM_HAZMAT_PRICING_REQUIRED,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            sortOrder: sortOrder++,
            ...buildAmounts(0, 0, null),
          },
          {
            pricingOwner: "in_house_labour",
            scopeKey: componentKey,
            overlapGroup: "bathroom_demolition",
          }
        )
      );
      return;
    }
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey,
        description: opts.label,
        confidence: "high",
        assumptions: reqAssumptions,
        provenance,
        priced: true,
        trade: "labourer",
        baseHours,
        productivityBasis: {
          key: hoursKey,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "m2",
          quantity: opts.area,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(adjustedHours * labourRate.costRate),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: opts.label,
            labourHours: adjustedHours,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            itemKey: "labour.carpenter.hour",
            notes: identity,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey,
          identitySummary: identity,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: componentKey,
          overlapGroup: "bathroom_demolition",
        }
      )
    );
  };

  const emitEachLabour = (opts: {
    id: Exclude<BathroomDemolitionComponentId, "floor_finish" | "wall_lining" | "ceiling">;
    label: string;
    count?: number;
  }) => {
    const count = opts.count ?? 1;
    const hoursKey = BATHROOM_DEMOLITION_PRODUCTIVITY_KEYS[opts.id];
    const productivity = resolveProductivity({
      productivityKey: hoursKey,
      unit: "each",
      fallbackHoursPerUnit: BATHROOM_DEMOLITION_PRODUCTIVITY_BENCHMARKS[opts.id],
      rates: context.rates,
    });
    const baseHours = round2(count * productivity.hoursPerUnit);
    const adjustedHours = round2(baseHours * params.accessFactor);
    const componentKey = BATHROOM_DEMOLITION_COMPONENTS[opts.id];
    const identity = `${count} × ${presentBathroomHours(adjustedHours)}`;
    if (specialist) {
      requirements.push(
        buildLabourRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey,
          description: opts.label,
          confidence: "low",
          assumptions: [],
          provenance,
          priced: false,
          trade: "labourer",
          baseHours,
          productivityBasis: {
            key: hoursKey,
            hoursPerUnit: productivity.hoursPerUnit,
            unit: "each",
            quantity: count,
          },
          adjustmentRef: { factors: [] },
          adjustedHours,
          rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
          hourlyCost: null,
          totalCost: null,
          rateProvenance: "missing",
        })
      );
      lineItems.push(
        withPricingOwnership(
          {
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: opts.label,
            category: "labour",
            quantity: adjustedHours,
            unit: "hour",
            itemKey: hoursKey,
            componentKey,
            identitySummary: identity,
            notes: BATHROOM_HAZMAT_PRICING_REQUIRED,
            rateSource: getRateSourceLabel("missing"),
            rateSourceType: "missing",
            sortOrder: sortOrder++,
            ...buildAmounts(0, 0, null),
          },
          {
            pricingOwner: "in_house_labour",
            scopeKey: componentKey,
            overlapGroup: "bathroom_demolition",
          }
        )
      );
      return;
    }
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey,
        description: opts.label,
        confidence: "high",
        assumptions: [],
        provenance,
        priced: true,
        trade: "labourer",
        baseHours,
        productivityBasis: {
          key: hoursKey,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "each",
          quantity: count,
        },
        adjustmentRef: { factors: [] },
        adjustedHours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(adjustedHours * labourRate.costRate),
        rateProvenance:
          labourRate.sourceType === "user_rate" ? "company" : "hardcoded_legacy",
      })
    );
    lineItems.push(
      withPricingOwnership(
        {
          ...createFixedLabourLineItem({
            workAreaId: workArea.id,
            workAreaName: workArea.name,
            label: opts.label,
            labourHours: adjustedHours,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            itemKey: "labour.carpenter.hour",
            notes: identity,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey,
          identitySummary: identity,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: componentKey,
          overlapGroup: "bathroom_demolition",
        }
      )
    );
  };

  if (components.includes("floor_finish")) {
    emitAreaLabour({
      id: "floor_finish",
      label: "Floor finish removal",
      area: geometry.floorAreaM2,
      missing: "Bathroom floor area is required for floor finish removal.",
    });
  }
  if (components.includes("wall_lining")) {
    emitAreaLabour({
      id: "wall_lining",
      label: "Wall lining removal",
      area: geometry.grossWallAreaM2,
      missing: "Bathroom wall area is required for wall lining removal.",
    });
  }
  if (components.includes("ceiling")) {
    emitAreaLabour({
      id: "ceiling",
      label: "Ceiling lining removal",
      area: geometry.ceilingAreaM2,
      missing: "Bathroom ceiling area is required for ceiling lining removal.",
    });
  }
  if (components.includes("vanity")) {
    emitEachLabour({ id: "vanity", label: "Vanity removal" });
  }
  if (components.includes("toilet")) {
    emitEachLabour({ id: "toilet", label: "Toilet removal" });
  }
  if (components.includes("shower")) {
    emitEachLabour({ id: "shower", label: "Shower / enclosure removal" });
  }
  if (components.includes("bath")) {
    emitEachLabour({ id: "bath", label: "Bath removal" });
  }
  if (components.includes("fixture")) {
    emitEachLabour({ id: "fixture", label: "Fixture removal" });
  }

  const overrideLevel = parseBathroomWasteLevel(
    getStringFact(facts as never, workArea.id, "bathroom.waste.level")
  );
  const wasteLevel = overrideLevel ?? inferBathroomWasteLevel(components);
  const wasteKey = BATHROOM_WASTE_LEVEL_KEYS[wasteLevel];
  const companyLump = context.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === BATHROOM_WASTE_ALLOWANCE_KEY &&
      rate.cost_rate != null
  );
  const fallback =
    catalogueBenchmarkCost(wasteKey) ?? BATHROOM_WASTE_LEVEL_BENCHMARKS[wasteLevel];
  assumptions.push(BATHROOM_WASTE_ALLOWANCE_STATEMENT);

  if (specialist) {
    requirements.push(
      buildWasteRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: BATHROOM_WASTE_COMPONENT,
        description: "Bathroom disposal",
        confidence: "low",
        assumptions: [
          {
            key: "bathroom.waste.hazmat",
            text: BATHROOM_HAZMAT_PRICING_REQUIRED,
            source: "calculator_default",
          },
        ],
        provenance,
        priced: false,
        wasteKey: BATHROOM_WASTE_ALLOWANCE_KEY,
        quantity: 1,
        unit: "allowance",
        totalCost: null,
      })
    );
    lineItems.push(
      withPricingOwnership(
        {
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Bathroom disposal",
          category: "allowance",
          quantity: 1,
          unit: "allowance",
          itemKey: BATHROOM_WASTE_ALLOWANCE_KEY,
          componentKey: BATHROOM_WASTE_COMPONENT,
          identitySummary: BATHROOM_HAZMAT_PRICING_REQUIRED,
          notes: BATHROOM_HAZMAT_PRICING_REQUIRED,
          rateSource: getRateSourceLabel("missing"),
          rateSourceType: "missing",
          sortOrder: sortOrder++,
          ...buildAmounts(0, 0, null),
        },
        {
          pricingOwner: "subcontractor_allowance",
          scopeKey: BATHROOM_WASTE_COMPONENT,
          overlapGroup: "bathroom_waste",
        }
      )
    );
    return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
  }

  const amount = companyLump?.cost_rate ?? fallback;
  const resolved = resolveRate({
    rates: context.rates,
    rateType: "allowance",
    itemKey: companyLump ? BATHROOM_WASTE_ALLOWANCE_KEY : wasteKey,
    unit: "allowance",
    fallbackCostRate: amount,
    fallbackSellRate: companyLump?.sell_rate ?? undefined,
    organisationSettings: context.organisationSettings,
  });
  const levelLabel = wasteLevel[0]!.toUpperCase() + wasteLevel.slice(1);
  const identity = companyLump
    ? `Company disposal allowance $${round2(resolved.costRate)}`
    : `${levelLabel} disposal allowance $${round2(resolved.costRate)}`;
  requirements.push(
    buildWasteRequirement({
      workAreaId: workArea.id,
      workAreaType: "bathroom",
      componentKey: BATHROOM_WASTE_COMPONENT,
      variantKey: wasteLevel,
      description: "Bathroom disposal",
      confidence: "medium",
      assumptions: [
        {
          key: "bathroom.waste",
          text: BATHROOM_WASTE_ALLOWANCE_STATEMENT,
          source: "benchmark",
        },
      ],
      provenance,
      priced: true,
      wasteKey: companyLump ? BATHROOM_WASTE_ALLOWANCE_KEY : wasteKey,
      quantity: 1,
      unit: "allowance",
      totalCost: round2(resolved.costRate),
    })
  );
  lineItems.push(
    withPricingOwnership(
      {
        ...createRateLineItem({
          workAreaId: workArea.id,
          workAreaName: workArea.name,
          label: "Bathroom disposal",
          category: "allowance",
          quantity: 1,
          unit: "allowance",
          costRate: resolved.costRate,
          sellRate: resolved.sellRate,
          rateSource: companyLump ? resolved.sourceLabel : BATHROOM_QUOTR_ALLOWANCE_LABEL,
          rateSourceType: companyLump ? "user_rate" : "benchmark",
          itemKey: BATHROOM_WASTE_ALLOWANCE_KEY,
          componentKey: BATHROOM_WASTE_COMPONENT,
          notes: identity,
          sortOrder: sortOrder++,
          organisationSettings: context.organisationSettings,
          qualityFactor: 1,
        }),
        identitySummary: identity,
      },
      {
        pricingOwner: "subcontractor_allowance",
        scopeKey: BATHROOM_WASTE_COMPONENT,
        overlapGroup: "bathroom_waste",
      }
    )
  );

  return { requirements, lineItems, assumptions, missingInfo, nextSortOrder: sortOrder };
}
