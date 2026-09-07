/**
 * WA-BATHROOM-05 — plumbing and electrical hybrid allowances.
 *
 * Base intensity is mobilisation/rough-in. Component modifiers are additive
 * fixture/service-specific amounts. Floor area is not an authority.
 * Future RFQ quotedCost can supersede allowanceCost on the same requirement.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_ELECTRICAL_ALLOWANCE_KEY,
  BATHROOM_ELECTRICAL_BASE_BENCHMARKS,
  BATHROOM_ELECTRICAL_BASE_STATEMENT,
  BATHROOM_ELECTRICAL_COMPONENT,
  BATHROOM_ELECTRICAL_LEVEL_KEYS,
  BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS,
  BATHROOM_ELECTRICAL_MODIFIER_KEYS,
  BATHROOM_ELECTRICAL_SCOPE_TEXT_FACT_KEY,
  BATHROOM_PLUMBING_ALLOWANCE_KEY,
  BATHROOM_PLUMBING_BASE_BENCHMARKS,
  BATHROOM_PLUMBING_BASE_STATEMENT,
  BATHROOM_PLUMBING_COMPONENT,
  BATHROOM_PLUMBING_LEVEL_KEYS,
  BATHROOM_PLUMBING_MODIFIER_BENCHMARKS,
  BATHROOM_PLUMBING_MODIFIER_KEYS,
  BATHROOM_PLUMBING_SCOPE_TEXT_FACT_KEY,
} from "@/lib/estimate/bathroom-identities";
import {
  parseBathroomTradeLevel,
  resolveBathroomTradeLevel,
  type BathroomFixtureId,
} from "@/lib/estimate/bathroom-scope";
import {
  getBooleanFact,
  getNumberFact,
  getStringFact,
  round2,
} from "@/lib/estimate/facts";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { buildSubcontractRequirement } from "@/lib/estimate/subcontract-requirement";
import { resolveRate } from "@/lib/estimate/rates";
import { createRateLineItem } from "@/lib/estimate/line-items";
import type {
  EstimateContext,
  EstimateLineItemInput,
  EstimateWorkArea,
} from "@/lib/estimate/types";
import type {
  EstimateRequirement,
  RequirementAssumption,
  RequirementProvenance,
} from "@/lib/estimate/requirements";

type ModifierRow = {
  label: string;
  amount: number;
  sourceLabel: string;
};

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
    ? entry.defaultCostRate
    : null;
}

function resolveAllowancePart(params: {
  itemKey: string;
  fallback: number;
  context: EstimateContext;
}): { amount: number; sourceLabel: string; company: boolean } {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate != null) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: "allowance",
      itemKey: params.itemKey,
      unit: "allowance",
      fallbackCostRate: company.cost_rate,
      fallbackSellRate: company.sell_rate ?? undefined,
      organisationSettings: params.context.organisationSettings,
    });
    return {
      amount: round2(resolved.costRate),
      sourceLabel: resolved.sourceLabel,
      company: true,
    };
  }
  const benchmark = catalogueBenchmarkCost(params.itemKey) ?? params.fallback;
  const resolved = resolveRate({
    rates: params.context.rates,
    rateType: "allowance",
    itemKey: params.itemKey,
    unit: "allowance",
    fallbackCostRate: benchmark,
    organisationSettings: params.context.organisationSettings,
  });
  return {
    amount: round2(resolved.costRate),
    sourceLabel: resolved.sourceLabel,
    company: false,
  };
}

function companyLump(params: {
  itemKey: string;
  context: EstimateContext;
}): { amount: number; sell: number; sourceLabel: string } | null {
  const company = params.context.rates.find(
    (rate) =>
      rate.active &&
      rate.item_key === params.itemKey &&
      rate.cost_rate != null
  );
  if (company?.cost_rate == null) return null;
  const resolved = resolveRate({
    rates: params.context.rates,
    rateType: "allowance",
    itemKey: params.itemKey,
    unit: "allowance",
    fallbackCostRate: company.cost_rate,
    fallbackSellRate: company.sell_rate ?? undefined,
    organisationSettings: params.context.organisationSettings,
  });
  return {
    amount: round2(resolved.costRate),
    sell: round2(resolved.sellRate),
    sourceLabel: resolved.sourceLabel,
  };
}

function selectedHas(
  selected: readonly BathroomFixtureId[],
  ids: readonly BathroomFixtureId[]
): boolean {
  return ids.some((id) => selected.includes(id));
}

function emitTradeLine(params: {
  workArea: EstimateWorkArea;
  context: EstimateContext;
  componentKey: string;
  itemKey: string;
  trade: "plumbing" | "electrical";
  label: string;
  identity: string;
  notes: string;
  amount: number;
  sourceLabel: string;
  company: boolean;
  scopeText: string | null;
  factKeys: string[];
  sortOrder: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  nextSortOrder: number;
} {
  const sellResolved = resolveRate({
    rates: params.context.rates,
    rateType: "allowance",
    itemKey: params.itemKey,
    unit: "allowance",
    fallbackCostRate: params.amount,
    organisationSettings: params.context.organisationSettings,
  });
  const reqAssumptions: RequirementAssumption[] = [
    {
      key: `${params.componentKey}.base`,
      text:
        params.trade === "plumbing"
          ? BATHROOM_PLUMBING_BASE_STATEMENT
          : BATHROOM_ELECTRICAL_BASE_STATEMENT,
      source: "benchmark",
    },
  ];
  if (params.scopeText) {
    reqAssumptions.push({
      key: `${params.componentKey}.scope_text`,
      text: params.scopeText,
      source: "user_confirmed",
    });
  }
  const provenance: RequirementProvenance = {
    calculatorSource: "bathroom-trades",
    factKeys: params.factKeys,
    constraintKeys: [],
  };
  const requirement = buildSubcontractRequirement({
    workAreaId: params.workArea.id,
    workAreaType: "bathroom",
    componentKey: params.componentKey,
    description: params.label,
    confidence: "medium",
    assumptions: reqAssumptions,
    provenance,
    priced: true,
    trade: params.trade,
    allowanceCost: params.amount,
    quotedCost: null,
    totalCost: params.amount,
  });
  const sourceType = params.company ? "user_rate" : "benchmark";
  const line = withPricingOwnership(
    {
      ...createRateLineItem({
        workAreaId: params.workArea.id,
        workAreaName: params.workArea.name,
        label: params.label,
        category: "subcontractor",
        quantity: 1,
        unit: "allowance",
        costRate: params.amount,
        sellRate: sellResolved.sellRate,
        rateSource: params.sourceLabel,
        rateSourceType: sourceType,
        itemKey: params.itemKey,
        componentKey: params.componentKey,
        notes: params.notes,
        sortOrder: params.sortOrder,
        organisationSettings: params.context.organisationSettings,
        qualityFactor: 1,
      }),
      identitySummary: params.identity,
    },
    {
      pricingOwner: "subcontractor_allowance",
      scopeKey: params.componentKey,
      overlapGroup:
        params.trade === "plumbing" ? "bathroom_plumbing" : "bathroom_electrical",
    }
  );
  return {
    requirements: [requirement],
    lineItems: [line],
    nextSortOrder: params.sortOrder + 1,
  };
}

export function buildBathroomTradeEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  selectedFixtures: readonly BathroomFixtureId[];
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  nextSortOrder: number;
} {
  const { context, workArea, selectedFixtures } = params;
  const facts = context.facts;
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  const plumbingLevel = resolveBathroomTradeLevel({
    canonical: getStringFact(facts as never, workArea.id, "bathroom.plumbing.level"),
    legacy:
      getStringFact(facts as never, workArea.id, "bathroom.plumbing_changes") ??
      getBooleanFact(facts as never, workArea.id, "bathroom.plumbing_allowance"),
  });
  const electricalLevel = resolveBathroomTradeLevel({
    canonical: getStringFact(facts as never, workArea.id, "bathroom.electrical.level"),
    legacy:
      getStringFact(facts as never, workArea.id, "bathroom.electrical_changes") ??
      getBooleanFact(facts as never, workArea.id, "bathroom.electrical_allowance"),
  });

  if (plumbingLevel && plumbingLevel !== "none") {
    assumptions.push(BATHROOM_PLUMBING_BASE_STATEMENT);
    const lump = companyLump({
      itemKey: BATHROOM_PLUMBING_ALLOWANCE_KEY,
      context,
    });
    const modifiers: ModifierRow[] = [];
    const addModifier = (
      label: string,
      itemKey: string,
      fallback: number,
      count = 1
    ) => {
      const part = resolveAllowancePart({ itemKey, fallback, context });
      modifiers.push({
        label: count > 1 ? `${label} × ${count}` : label,
        amount: round2(part.amount * count),
        sourceLabel: part.sourceLabel,
      });
    };

    if (selectedHas(selectedFixtures, ["toilet"])) {
      addModifier(
        "Toilet",
        BATHROOM_PLUMBING_MODIFIER_KEYS.toilet,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.toilet
      );
    }
    if (selectedHas(selectedFixtures, ["vanity", "basin"])) {
      addModifier(
        "Vanity/basin",
        BATHROOM_PLUMBING_MODIFIER_KEYS.vanity_basin,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.vanity_basin
      );
    }
    if (selectedHas(selectedFixtures, ["shower", "shower_enclosure"])) {
      addModifier(
        "Shower",
        BATHROOM_PLUMBING_MODIFIER_KEYS.shower,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.shower
      );
    }
    if (selectedHas(selectedFixtures, ["bath"])) {
      addModifier(
        "Bath",
        BATHROOM_PLUMBING_MODIFIER_KEYS.bath,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.bath
      );
    }
    if (getBooleanFact(facts as never, workArea.id, "bathroom.plumbing.floor_waste_included")) {
      addModifier(
        "Floor waste",
        BATHROOM_PLUMBING_MODIFIER_KEYS.floor_waste,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.floor_waste
      );
    }
    const relocationCount =
      getNumberFact(facts as never, workArea.id, "bathroom.plumbing.relocation_count") ?? 0;
    if (relocationCount > 0) {
      addModifier(
        "Fixture relocation",
        BATHROOM_PLUMBING_MODIFIER_KEYS.relocation,
        BATHROOM_PLUMBING_MODIFIER_BENCHMARKS.relocation,
        relocationCount
      );
    }

    const levelKey = BATHROOM_PLUMBING_LEVEL_KEYS[plumbingLevel];
    const basePart = resolveAllowancePart({
      itemKey: levelKey,
      fallback: BATHROOM_PLUMBING_BASE_BENCHMARKS[plumbingLevel],
      context,
    });
    const hybridTotal = round2(
      basePart.amount + modifiers.reduce((sum, row) => sum + row.amount, 0)
    );
    const total = lump?.amount ?? hybridTotal;
    const company = Boolean(lump) || basePart.company || modifiers.some((row) =>
      /company/i.test(row.sourceLabel)
    );
    const scopeText =
      getStringFact(facts as never, workArea.id, BATHROOM_PLUMBING_SCOPE_TEXT_FACT_KEY)?.trim() ||
      null;
    const breakdown = [
      `${plumbingLevel[0]!.toUpperCase()}${plumbingLevel.slice(1)}`,
      lump
        ? `Company plumbing lump $${lump.amount}`
        : `Base $${basePart.amount}`,
      ...modifiers.map((row) => `${row.label} +$${row.amount}`),
      `Total $${total}`,
    ];
    if (scopeText) breakdown.push(`Scope: ${scopeText}`);
    const emitted = emitTradeLine({
      workArea,
      context,
      componentKey: BATHROOM_PLUMBING_COMPONENT,
      itemKey: BATHROOM_PLUMBING_ALLOWANCE_KEY,
      trade: "plumbing",
      label: `Plumbing — ${plumbingLevel}`,
      identity: breakdown.join(" · "),
      notes: lump
        ? `Company plumbing allowance replaces the hybrid total. ${BATHROOM_PLUMBING_BASE_STATEMENT}`
        : `${BATHROOM_PLUMBING_BASE_STATEMENT}${scopeText ? ` Scope: ${scopeText}` : ""}`,
      amount: total,
      sourceLabel: lump?.sourceLabel ?? (company ? "Your company rate" : "Quotr benchmark"),
      company,
      scopeText,
      factKeys: [
        "bathroom.plumbing.level",
        "bathroom.plumbing_changes",
        "bathroom.fixtures_included",
        "bathroom.plumbing.floor_waste_included",
        "bathroom.plumbing.relocation_count",
        BATHROOM_PLUMBING_SCOPE_TEXT_FACT_KEY,
      ],
      sortOrder,
    });
    requirements.push(...emitted.requirements);
    lineItems.push(...emitted.lineItems);
    sortOrder = emitted.nextSortOrder;
  } else if (plumbingLevel === "none") {
    assumptions.push("Plumbing excluded — none selected.");
  } else if (parseBathroomTradeLevel(getStringFact(facts as never, workArea.id, "bathroom.plumbing.level")) == null) {
    const legacyFalse =
      getStringFact(facts as never, workArea.id, "bathroom.plumbing_changes") ??
      getBooleanFact(facts as never, workArea.id, "bathroom.plumbing_allowance");
    if (legacyFalse === false || String(legacyFalse).toLowerCase() === "none") {
      assumptions.push("Plumbing by others — excluded from estimate.");
    }
  }

  if (electricalLevel && electricalLevel !== "none") {
    assumptions.push(BATHROOM_ELECTRICAL_BASE_STATEMENT);
    const lump = companyLump({
      itemKey: BATHROOM_ELECTRICAL_ALLOWANCE_KEY,
      context,
    });
    const modifiers: ModifierRow[] = [];
    const addModifier = (
      label: string,
      itemKey: string,
      fallback: number,
      count = 1
    ) => {
      const part = resolveAllowancePart({ itemKey, fallback, context });
      modifiers.push({
        label: count > 1 ? `${label} × ${count}` : label,
        amount: round2(part.amount * count),
        sourceLabel: part.sourceLabel,
      });
    };

    const lightCount =
      getNumberFact(facts as never, workArea.id, "bathroom.electrical.light_count") ?? 0;
    if (lightCount > 0) {
      addModifier(
        "Lights",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.light,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.light,
        lightCount
      );
    }
    const fanSelected =
      selectedHas(selectedFixtures, ["extract_fan"]) ||
      getBooleanFact(facts as never, workArea.id, "bathroom.ventilation_included") === true;
    if (fanSelected) {
      addModifier(
        "Extract fan",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.extract_fan,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.extract_fan
      );
    }
    if (selectedHas(selectedFixtures, ["heated_towel_rail"])) {
      addModifier(
        "Heated towel rail",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.heated_towel_rail,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.heated_towel_rail
      );
    }
    const gpoCount =
      getNumberFact(facts as never, workArea.id, "bathroom.electrical.gpo_count") ?? 0;
    if (gpoCount > 0) {
      addModifier(
        "GPO",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.gpo,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.gpo,
        gpoCount
      );
    }
    if (getBooleanFact(facts as never, workArea.id, "bathroom.electrical.mirror_power_included")) {
      addModifier(
        "Mirror/vanity power",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.mirror_power,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.mirror_power
      );
    }
    if (getBooleanFact(facts as never, workArea.id, "bathroom.underfloor_heating_included")) {
      addModifier(
        "Underfloor heating connection",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.ufh,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.ufh
      );
    }
    if (getBooleanFact(facts as never, workArea.id, "bathroom.electrical.new_circuit_included")) {
      addModifier(
        "New circuit",
        BATHROOM_ELECTRICAL_MODIFIER_KEYS.new_circuit,
        BATHROOM_ELECTRICAL_MODIFIER_BENCHMARKS.new_circuit
      );
    }

    const levelKey = BATHROOM_ELECTRICAL_LEVEL_KEYS[electricalLevel];
    const basePart = resolveAllowancePart({
      itemKey: levelKey,
      fallback: BATHROOM_ELECTRICAL_BASE_BENCHMARKS[electricalLevel],
      context,
    });
    const hybridTotal = round2(
      basePart.amount + modifiers.reduce((sum, row) => sum + row.amount, 0)
    );
    const total = lump?.amount ?? hybridTotal;
    const company = Boolean(lump) || basePart.company;
    const scopeText =
      getStringFact(facts as never, workArea.id, BATHROOM_ELECTRICAL_SCOPE_TEXT_FACT_KEY)?.trim() ||
      null;
    const breakdown = [
      `${electricalLevel[0]!.toUpperCase()}${electricalLevel.slice(1)}`,
      lump
        ? `Company electrical lump $${lump.amount}`
        : `Base $${basePart.amount}`,
      ...modifiers.map((row) => `${row.label} +$${row.amount}`),
      `Total $${total}`,
    ];
    if (scopeText) breakdown.push(`Scope: ${scopeText}`);
    const emitted = emitTradeLine({
      workArea,
      context,
      componentKey: BATHROOM_ELECTRICAL_COMPONENT,
      itemKey: BATHROOM_ELECTRICAL_ALLOWANCE_KEY,
      trade: "electrical",
      label: `Electrical — ${electricalLevel}`,
      identity: breakdown.join(" · "),
      notes: lump
        ? `Company electrical allowance replaces the hybrid total. ${BATHROOM_ELECTRICAL_BASE_STATEMENT}`
        : `${BATHROOM_ELECTRICAL_BASE_STATEMENT}${scopeText ? ` Scope: ${scopeText}` : ""}`,
      amount: total,
      sourceLabel: lump?.sourceLabel ?? (company ? "Your company rate" : "Quotr benchmark"),
      company,
      scopeText,
      factKeys: [
        "bathroom.electrical.level",
        "bathroom.electrical_changes",
        "bathroom.fixtures_included",
        "bathroom.electrical.light_count",
        "bathroom.electrical.gpo_count",
        "bathroom.electrical.mirror_power_included",
        "bathroom.electrical.new_circuit_included",
        "bathroom.ventilation_included",
        "bathroom.underfloor_heating_included",
        BATHROOM_ELECTRICAL_SCOPE_TEXT_FACT_KEY,
      ],
      sortOrder,
    });
    requirements.push(...emitted.requirements);
    lineItems.push(...emitted.lineItems);
    sortOrder = emitted.nextSortOrder;
  } else if (electricalLevel === "none") {
    assumptions.push("Electrical excluded — none selected.");
  }

  return {
    requirements,
    lineItems,
    assumptions,
    missingInfo,
    nextSortOrder: sortOrder,
  };
}
