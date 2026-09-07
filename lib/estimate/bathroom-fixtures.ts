/**
 * WA-BATHROOM-05 — fixture catalogue, supply/install ownership, PC sums,
 * and builder fixture-install labour.
 *
 * Finish level does not scale PC sums or install hours.
 * Plumber/electrician-owned installs are not duplicated as builder labour.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import {
  BATHROOM_FIXTURE_INSTALL_COMPONENTS,
  BATHROOM_FIXTURE_PC_BENCHMARKS,
  BATHROOM_FIXTURE_PC_KEYS,
  BATHROOM_FIXTURE_PRODUCTIVITY_BENCHMARKS,
  BATHROOM_FIXTURE_PRODUCTIVITY_KEYS,
  BATHROOM_FIXTURE_SUPPLY_COMPONENTS,
  BATHROOM_FINISH_LEVEL_PC_STATEMENT,
  BATHROOM_PC_NOT_MERCHANT_STATEMENT,
  type BathroomFixtureId,
} from "@/lib/estimate/bathroom-identities";
import {
  bathroomFixtureOwnershipFactKey,
  parseBathroomFixtureOwnership,
  parseBathroomSelectedFixtures,
  type BathroomFixtureOwnership,
} from "@/lib/estimate/bathroom-scope";
import { getBooleanFact, getFact, getStringFact, round2 } from "@/lib/estimate/facts";
import { buildLabourRequirement } from "@/lib/estimate/labour-requirement";
import { buildMaterialRequirement } from "@/lib/estimate/material-requirement";
import { withPricingOwnership } from "@/lib/estimate/pricing-ownership";
import { resolveProductivity } from "@/lib/estimate/productivity";
import { resolveLabourRate, resolveRate } from "@/lib/estimate/rates";
import { getRateSourceLabel } from "@/lib/estimate/rate-source-labels";
import { buildAmounts, createFixedLabourLineItem, createRateLineItem } from "@/lib/estimate/line-items";
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

export const BATHROOM_FIXTURE_LABELS: Record<BathroomFixtureId, string> = {
  toilet: "Toilet",
  vanity: "Vanity",
  basin: "Basin",
  shower: "Shower tray/base",
  shower_enclosure: "Shower enclosure",
  bath: "Bath",
  tapware: "Tapware",
  heated_towel_rail: "Heated towel rail",
  mirror: "Mirror",
  extract_fan: "Extract fan",
  accessories: "Accessories",
  other: "Other fixture",
};

export type BathroomFixtureInstallOwner =
  | "builder"
  | "plumber"
  | "electrician"
  | "specialist"
  | "none";

const INSTALL_OWNER: Record<BathroomFixtureId, BathroomFixtureInstallOwner> = {
  toilet: "plumber",
  vanity: "builder",
  basin: "plumber",
  shower: "plumber",
  shower_enclosure: "builder",
  bath: "plumber",
  tapware: "plumber",
  heated_towel_rail: "electrician",
  mirror: "builder",
  extract_fan: "electrician",
  accessories: "builder",
  other: "none",
};

function ownsSupply(ownership: BathroomFixtureOwnership): boolean {
  return ownership === "supply" || ownership === "supply_and_install";
}

function ownsInstall(ownership: BathroomFixtureOwnership): boolean {
  return ownership === "install" || ownership === "supply_and_install";
}

export function bathroomFixtureInstallOwner(
  id: BathroomFixtureId,
  enclosureOwner?: string | null
): BathroomFixtureInstallOwner {
  if (id === "shower_enclosure") {
    const raw = String(enclosureOwner ?? "").trim().toLowerCase();
    if (raw === "specialist" || raw.includes("specialist")) return "specialist";
    return "builder";
  }
  return INSTALL_OWNER[id];
}

export function resolveBathroomFixtureOwnership(params: {
  facts: EstimateContext["facts"];
  workAreaId: string;
  fixtureId: BathroomFixtureId;
}): BathroomFixtureOwnership {
  const explicit = parseBathroomFixtureOwnership(
    getFact(params.facts as never, params.workAreaId, bathroomFixtureOwnershipFactKey(params.fixtureId))
      ?.value
  );
  if (explicit) return explicit;
  const clientSupplied = getBooleanFact(
    params.facts as never,
    params.workAreaId,
    "bathroom.fixtures_client_supplied"
  );
  if (clientSupplied === true) return "install";
  return "supply_and_install";
}

function catalogueBenchmarkCost(itemKey: string): number | null {
  const entry = getCatalogueEntry(itemKey);
  return entry?.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
    ? entry.defaultCostRate
    : null;
}

function resolvePcRate(params: {
  itemKey: string;
  unit: string;
  context: EstimateContext;
  fallback: number;
}): {
  priced: boolean;
  costRate: number | null;
  sellRate: number | null;
  sourceType: "user_rate" | "benchmark" | "missing";
  sourceLabel: string;
} {
  const company = params.context.rates.find(
    (rate) => rate.active && rate.item_key === params.itemKey && rate.cost_rate != null
  );
  if (company?.cost_rate != null) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: "allowance",
      itemKey: params.itemKey,
      unit: params.unit,
      fallbackCostRate: company.cost_rate,
      fallbackSellRate: company.sell_rate ?? undefined,
      organisationSettings: params.context.organisationSettings,
    });
    return {
      priced: true,
      costRate: resolved.costRate,
      sellRate: resolved.sellRate,
      sourceType: "user_rate",
      sourceLabel: resolved.sourceLabel,
    };
  }
  const benchmark = catalogueBenchmarkCost(params.itemKey) ?? params.fallback;
  if (
    benchmark != null &&
    params.context.organisationSettings?.allow_benchmark_rates !== false
  ) {
    const resolved = resolveRate({
      rates: params.context.rates,
      rateType: "allowance",
      itemKey: params.itemKey,
      unit: params.unit,
      fallbackCostRate: benchmark,
      organisationSettings: params.context.organisationSettings,
    });
    return {
      priced: true,
      costRate: resolved.costRate,
      sellRate: resolved.sellRate,
      sourceType: "benchmark",
      sourceLabel: "PC allowance",
    };
  }
  return {
    priced: false,
    costRate: null,
    sellRate: null,
    sourceType: "missing",
    sourceLabel: getRateSourceLabel("missing"),
  };
}

export function buildBathroomFixtureEnvelope(params: {
  context: EstimateContext;
  workArea: EstimateWorkArea;
  sortOrderStart: number;
}): {
  requirements: EstimateRequirement[];
  lineItems: EstimateLineItemInput[];
  assumptions: string[];
  missingInfo: string[];
  selected: BathroomFixtureId[];
  nextSortOrder: number;
} {
  const { context, workArea } = params;
  const facts = context.facts;
  const selected = parseBathroomSelectedFixtures({
    facts,
    workAreaId: workArea.id,
  });
  const requirements: EstimateRequirement[] = [];
  const lineItems: EstimateLineItemInput[] = [];
  const assumptions: string[] = [BATHROOM_FINISH_LEVEL_PC_STATEMENT];
  const missingInfo: string[] = [];
  let sortOrder = params.sortOrderStart;

  const labourRate = resolveLabourRate({
    rates: context.rates,
    organisationSettings: context.organisationSettings,
  });
  const provenance: RequirementProvenance = {
    calculatorSource: "bathroom-fixtures",
    factKeys: [
      "bathroom.fixtures_included",
      "bathroom.fixtures_client_supplied",
      "bathroom.includes_vanity",
      "bathroom.includes_shower",
      "bathroom.includes_toilet",
      "bathroom.job_scope",
      ...selected.map((id) => bathroomFixtureOwnershipFactKey(id)),
    ],
    constraintKeys: [],
  };

  if (selected.length > 0) {
    assumptions.push(BATHROOM_PC_NOT_MERCHANT_STATEMENT);
  }

  for (const id of selected) {
    const ownership = resolveBathroomFixtureOwnership({
      facts,
      workAreaId: workArea.id,
      fixtureId: id,
    });
    const label = BATHROOM_FIXTURE_LABELS[id];
    const pcKey = BATHROOM_FIXTURE_PC_KEYS[id];
    const pcBenchmark = BATHROOM_FIXTURE_PC_BENCHMARKS[id];
    const supplyComponent = BATHROOM_FIXTURE_SUPPLY_COMPONENTS[id];
    const installOwner = bathroomFixtureInstallOwner(
      id,
      getStringFact(
        facts as never,
        workArea.id,
        "bathroom.fixture.shower_enclosure.install_owner"
      )
    );

    if (ownsSupply(ownership) && pcBenchmark != null) {
      const unit = id === "accessories" || id === "tapware" ? "allowance" : "each";
      const rate = resolvePcRate({
        itemKey: pcKey,
        unit,
        context,
        fallback: pcBenchmark,
      });
      const reqAssumptions: RequirementAssumption[] = [
        {
          key: "bathroom.pc",
          text: BATHROOM_PC_NOT_MERCHANT_STATEMENT,
          source: "benchmark",
        },
      ];
      requirements.push(
        buildMaterialRequirement({
          workAreaId: workArea.id,
          workAreaType: "bathroom",
          componentKey: supplyComponent,
          variantKey: ownership,
          description: `${label} supply PC allowance`,
          confidence: "medium",
          assumptions: reqAssumptions,
          provenance,
          priced: rate.priced,
          materialKey: pcKey,
          category: "allowance",
          specification: "PC allowance — product not specified",
          baseQuantity: 1,
          baseUnit: unit,
          wasteFactor: 0,
          purchaseQuantity: 1,
          purchaseUnit: unit,
          rateSource: rate.sourceType === "user_rate" ? "company" : rate.priced ? "benchmark" : "missing",
          unitCost: rate.costRate,
          totalCost:
            rate.priced && rate.costRate != null ? round2(rate.costRate) : null,
        })
      );
      if (rate.priced && rate.costRate != null && rate.sellRate != null) {
        lineItems.push(
          withPricingOwnership(
            {
              ...createRateLineItem({
                workAreaId: workArea.id,
                workAreaName: workArea.name,
                label: `${label} supply PC allowance`,
                category: "materials",
                quantity: 1,
                unit,
                costRate: rate.costRate,
                sellRate: rate.sellRate,
                rateSource: rate.sourceLabel,
                rateSourceType: rate.sourceType,
                itemKey: pcKey,
                componentKey: supplyComponent,
                notes: `${BATHROOM_PC_NOT_MERCHANT_STATEMENT} Ownership: supply.`,
                sortOrder: sortOrder++,
                organisationSettings: context.organisationSettings,
                qualityFactor: 1,
              }),
              identitySummary: `Supply: PC allowance $${rate.costRate}`,
            },
            {
              pricingOwner: "contractor_material",
              scopeKey: supplyComponent,
              overlapGroup: "bathroom_fixtures",
            }
          )
        );
      } else {
        lineItems.push(
          withPricingOwnership(
            {
              workAreaId: workArea.id,
              workAreaName: workArea.name,
              label: `${label} supply PC allowance`,
              category: "materials",
              quantity: 1,
              unit,
              itemKey: pcKey,
              componentKey: supplyComponent,
              identitySummary: "Pricing required — fixture PC",
              notes: "Pricing required — no approved fixture PC.",
              rateSource: getRateSourceLabel("missing"),
              rateSourceType: "missing",
              sortOrder: sortOrder++,
              ...buildAmounts(0, 0, null),
            },
            {
              pricingOwner: "contractor_material",
              scopeKey: supplyComponent,
              overlapGroup: "bathroom_fixtures",
            }
          )
        );
        missingInfo.push(`${label} PC allowance needs a rate.`);
      }
    }

    if (!ownsInstall(ownership)) {
      continue;
    }

    if (installOwner === "plumber") {
      assumptions.push(`${label} install is included in plumbing scope.`);
      continue;
    }
    if (installOwner === "electrician") {
      assumptions.push(`${label} install is included in electrical scope.`);
      continue;
    }
    if (installOwner === "specialist") {
      missingInfo.push(
        `${label} specialist installation is selected — add a subcontract price or switch to builder install.`
      );
      continue;
    }
    if (installOwner !== "builder") {
      continue;
    }

    const hoursKey =
      id === "vanity" || id === "mirror" || id === "accessories" || id === "shower_enclosure"
        ? BATHROOM_FIXTURE_PRODUCTIVITY_KEYS[id]
        : null;
    const hoursFallback =
      id === "vanity" || id === "mirror" || id === "accessories" || id === "shower_enclosure"
        ? BATHROOM_FIXTURE_PRODUCTIVITY_BENCHMARKS[id]
        : null;
    if (
      id !== "vanity" &&
      id !== "mirror" &&
      id !== "accessories" &&
      id !== "shower_enclosure"
    ) {
      continue;
    }
    if (hoursKey == null || hoursFallback == null) continue;

    const installComponent = BATHROOM_FIXTURE_INSTALL_COMPONENTS[id];
    const productivity = resolveProductivity({
      productivityKey: hoursKey,
      unit: "each",
      fallbackHoursPerUnit: hoursFallback,
      rates: context.rates,
    });
    const hours = round2(productivity.hoursPerUnit);
    requirements.push(
      buildLabourRequirement({
        workAreaId: workArea.id,
        workAreaType: "bathroom",
        componentKey: installComponent,
        description: `${label} builder installation`,
        confidence: "high",
        assumptions: [],
        provenance,
        priced: true,
        trade: "carpenter",
        baseHours: hours,
        productivityBasis: {
          key: hoursKey,
          hoursPerUnit: productivity.hoursPerUnit,
          unit: "each",
          quantity: 1,
        },
        adjustmentRef: { factors: [] },
        adjustedHours: hours,
        rateKey: labourRate.itemKey ?? "labour.carpenter.hour",
        hourlyCost: labourRate.costRate,
        totalCost: round2(hours * labourRate.costRate),
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
            label: `${label} installation`,
            labourHours: hours,
            labourCostRate: labourRate.costRate,
            labourSellRate: labourRate.sellRate,
            rateSource: labourRate.sourceLabel,
            itemKey: "labour.carpenter.hour",
            notes: `Install: Builder, ${hours} hours. Finish level does not change hours.`,
            sortOrder: sortOrder++,
            organisationSettings: context.organisationSettings,
          }),
          componentKey: installComponent,
          identitySummary: `Install: Builder, ${hours} hours`,
        },
        {
          pricingOwner: "in_house_labour",
          scopeKey: installComponent,
          overlapGroup: "bathroom_fixtures",
        }
      )
    );
  }

  return {
    requirements,
    lineItems,
    assumptions,
    missingInfo,
    selected,
    nextSortOrder: sortOrder,
  };
}
