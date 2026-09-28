/**
 * Variation cost-component rate selection.
 * Reuses the canonical material registry, labour catalogue and company-rate
 * rows. It does not create a second catalogue or change Rates authority.
 */

import type { OrganisationRate } from "@/components/setup/types";
import {
  FULL_RATE_CATALOGUE,
  LABOUR_RATE_CATALOGUE,
  getCatalogueEntry,
} from "@/lib/rates/catalogue";
import {
  buildMaterialRegistry,
  type MaterialRegistryItem,
} from "@/lib/rates/material-registry";
import type { RateCatalogueEntry, RatesPageRate } from "@/lib/rates/types";
import type { VariationCostCategory } from "@/lib/variations/domain";
import { variationRateQueryMatches } from "@/lib/variations/rate-query";

export type VariationCompanyRate = {
  id: string;
  item_key: string;
  rate_type: string;
  label: string;
  unit: string;
  cost_rate: number | null;
  active: boolean;
};

export type EligibleVariationRate = {
  canonicalKey: string;
  label: string;
  unit: string;
  group: string;
  detail: string | null;
  badge: "Company Rate" | "Quotr benchmark";
  derived: boolean;
  effectiveCost: number;
  source: "company_rate" | "quotr_benchmark";
  rateType: string;
};

export type ListedVariationRate = EligibleVariationRate & {
  familyName: string | null;
  thickness: string | null;
  sheetSize: string | null;
  rateId: string | null;
  searchText: string;
};

export type ResolvedVariationRate = EligibleVariationRate & {
  ok: true;
  rateId: string | null;
  benchmarkCost: number | null;
  benchmarkLabel: string;
  benchmarkUnit: string;
};

export type VariationRateFailure = {
  ok: false;
  error: "INVALID_RATE" | "WRONG_UNIT" | "PRODUCTIVITY_REJECTED" | "NO_RATE";
};

const RESULT_LIMIT = 80;

export function canonicalVariationRateUnit(unit: string): string {
  const value = unit
    .trim()
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("m²", "m2")
    .replaceAll("m³", "m3");
  if (value === "hr" || value === "hours" || value === "h" || value === "hour") return "hour";
  if (value === "linearmetre" || value === "linearmeter" || value === "linm" || value === "lm") {
    return "lm";
  }
  if (value === "m2" || value === "sqm") return "m2";
  if (value === "each" || value === "ea") return "each";
  return value;
}

export function variationRateUnitsMatch(left: string, right: string): boolean {
  return canonicalVariationRateUnit(left) === canonicalVariationRateUnit(right);
}

/** A new component starts without a measured unit. That must not hide the catalogue. */
export function variationRateUnitIsOpen(unit: string): boolean {
  const value = unit.trim().toLowerCase();
  return value.length === 0 || value === "item" || value === "unit";
}

function unitCanAdopt(catalogueUnit: string, componentUnit: string): boolean {
  return variationRateUnitIsOpen(componentUnit) || variationRateUnitsMatch(catalogueUnit, componentUnit);
}

function positiveCost(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asRegistryRates(rows: readonly VariationCompanyRate[]): RatesPageRate[] {
  return rows.map((row) => {
    const rate: OrganisationRate = {
      id: row.id,
      rate_type: row.rate_type,
      trade: null,
      work_area_type: null,
      item_key: row.item_key,
      label: row.label,
      unit: row.unit,
      cost_rate: row.cost_rate,
      sell_rate: null,
      markup_percent: null,
      active: row.active,
    };
    return rate;
  });
}

function winningCompanyRate(
  rates: readonly VariationCompanyRate[],
  itemKey: string,
  rateType: string,
  catalogueUnit: string,
  componentUnit: string
): VariationCompanyRate | null {
  const row = rates.find(
    (rate) =>
      rate.item_key === itemKey &&
      rate.rate_type === rateType &&
      rate.active &&
      positiveCost(rate.cost_rate) != null &&
      variationRateUnitsMatch(rate.unit, catalogueUnit) &&
      unitCanAdopt(rate.unit, componentUnit)
  );
  return row ?? null;
}

function candidateEntries(category: VariationCostCategory): RateCatalogueEntry[] {
  if (category === "labour") {
    return LABOUR_RATE_CATALOGUE.filter((entry) => entry.rate_type === "labour");
  }
  if (category === "subcontract") {
    return uniqueEntries(FULL_RATE_CATALOGUE.filter((entry) => entry.rate_type === "subcontractor"));
  }
  if (category === "plant") {
    return uniqueEntries(FULL_RATE_CATALOGUE.filter((entry) => entry.item_key.startsWith("plant.")));
  }
  if (category === "allowance") {
    return uniqueEntries(
      FULL_RATE_CATALOGUE.filter(
        (entry) => entry.rate_type === "allowance" && !entry.item_key.startsWith("plant.")
      )
    );
  }
  return [];
}

function uniqueEntries(entries: RateCatalogueEntry[]): RateCatalogueEntry[] {
  const seen = new Set<string>();
  const unique: RateCatalogueEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.item_key)) continue;
    seen.add(entry.item_key);
    unique.push(entry);
  }
  return unique;
}

function groupFor(entry: RateCatalogueEntry, category: VariationCostCategory): string {
  if (category === "labour") return "Labour";
  if (category === "subcontract") return entry.workAreaLabel ?? "Subcontract";
  if (category === "plant") return entry.workAreaLabel ?? "Plant / equipment";
  if (category === "allowance") return entry.workAreaLabel ?? "Allowance";
  return entry.workAreaLabel ?? "Rates";
}

function resolveEntry(
  entry: RateCatalogueEntry,
  componentUnit: string,
  companyRates: readonly VariationCompanyRate[],
  group: string
): ResolvedVariationRate | VariationRateFailure {
  if (entry.rate_type === "productivity") {
    return { ok: false, error: "PRODUCTIVITY_REJECTED" };
  }
  if (!unitCanAdopt(entry.unit, componentUnit)) {
    return { ok: false, error: "WRONG_UNIT" };
  }
  const benchmarkCost = positiveCost(entry.defaultCostRate);
  const company = winningCompanyRate(
    companyRates,
    entry.item_key,
    entry.rate_type,
    entry.unit,
    componentUnit
  );
  const companyCost = company ? positiveCost(company.cost_rate) : null;
  if (company && companyCost != null) {
    return {
      ok: true,
      canonicalKey: entry.item_key,
      label: company.label,
      unit: entry.unit,
      group,
      detail: null,
      derived: false,
      badge: "Company Rate",
      effectiveCost: companyCost,
      source: "company_rate",
      rateType: entry.rate_type,
      rateId: company.id,
      benchmarkCost,
      benchmarkLabel: entry.label,
      benchmarkUnit: entry.unit,
    };
  }
  if (benchmarkCost == null) return { ok: false, error: "NO_RATE" };
  return {
    ok: true,
    canonicalKey: entry.item_key,
    label: entry.label,
    unit: entry.unit,
      group,
      detail: null,
      derived: false,
      badge: "Quotr benchmark",
    effectiveCost: benchmarkCost,
    source: "quotr_benchmark",
    rateType: entry.rate_type,
    rateId: null,
    benchmarkCost,
    benchmarkLabel: entry.label,
    benchmarkUnit: entry.unit,
  };
}

function materialDetail(item: MaterialRegistryItem): string | null {
  const parts = [item.thickness, item.sheetSize, item.section, item.gradeTreatment, item.colourType].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function materialSearchText(item: MaterialRegistryItem): string {
  return [
    item.label,
    item.familyName,
    item.thickness,
    item.sheetSize,
    item.section,
    item.gradeTreatment,
    item.colourType,
    item.categoryName,
    item.unit,
    ...item.workAreaLabels,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function resolveMaterialItem(
  item: MaterialRegistryItem,
  componentUnit: string,
  companyRates: readonly VariationCompanyRate[]
): ResolvedVariationRate | VariationRateFailure {
  if (!unitCanAdopt(item.unit, componentUnit)) {
    return { ok: false, error: "WRONG_UNIT" };
  }
  const benchmarkCost = positiveCost(item.quotrBenchmarkCost);
  const company = winningCompanyRate(
    companyRates,
    item.canonicalKey,
    item.catalogueEntry.rate_type,
    item.unit,
    componentUnit
  );
  const companyCost = company ? positiveCost(company.cost_rate) : null;
  if (company && companyCost != null) {
    return {
      ok: true,
      canonicalKey: item.canonicalKey,
      label: company.label,
      unit: item.unit,
      group: item.workAreaLabels[0] ?? item.categoryName,
      detail: materialDetail(item),
      derived: item.benchmarkKind === "derived",
      badge: "Company Rate",
      effectiveCost: companyCost,
      source: "company_rate",
      rateType: item.catalogueEntry.rate_type,
      rateId: company.id,
      benchmarkCost,
      benchmarkLabel: item.label,
      benchmarkUnit: item.unit,
    };
  }
  if (benchmarkCost == null) return { ok: false, error: "NO_RATE" };
  return {
    ok: true,
    canonicalKey: item.canonicalKey,
    label: item.label,
    unit: item.unit,
    group: item.workAreaLabels[0] ?? item.categoryName,
    detail: materialDetail(item),
    derived: item.benchmarkKind === "derived",
    badge: "Quotr benchmark",
    effectiveCost: benchmarkCost,
    source: "quotr_benchmark",
    rateType: item.catalogueEntry.rate_type,
    rateId: null,
    benchmarkCost,
    benchmarkLabel: item.label,
    benchmarkUnit: item.unit,
  };
}

export function resolveVariationComponentRate(params: {
  category: VariationCostCategory;
  componentUnit: string;
  canonicalKey: string;
  companyRates: readonly VariationCompanyRate[];
}): ResolvedVariationRate | VariationRateFailure {
  const catalogue = getCatalogueEntry(params.canonicalKey);
  if (catalogue?.rate_type === "productivity") {
    return { ok: false, error: "PRODUCTIVITY_REJECTED" };
  }
  if (params.category === "material") {
    const registry = buildMaterialRegistry({
      rates: asRegistryRates(params.companyRates),
      editable: false,
    });
    const item = registry.items.find((row) => row.canonicalKey === params.canonicalKey);
    if (!item) return { ok: false, error: "INVALID_RATE" };
    return resolveMaterialItem(item, params.componentUnit, params.companyRates);
  }
  if (params.category === "other") return { ok: false, error: "NO_RATE" };
  const entry = candidateEntries(params.category).find((row) => row.item_key === params.canonicalKey);
  if (!entry) return { ok: false, error: "INVALID_RATE" };
  return resolveEntry(entry, params.componentUnit, params.companyRates, groupFor(entry, params.category));
}

const CATEGORY_CATALOGUE_LIMIT = 5000;

export function listEligibleVariationRates(params: {
  category: VariationCostCategory;
  componentUnit: string;
  companyRates: readonly VariationCompanyRate[];
  query?: string;
  limit?: number;
}): { rates: ListedVariationRate[]; truncated: boolean } {
  const resolved: ListedVariationRate[] = [];
  const seen = new Set<string>();
  const push = (rate: ListedVariationRate) => {
    if (seen.has(rate.canonicalKey)) return;
    seen.add(rate.canonicalKey);
    resolved.push(rate);
  };
  if (params.category === "material") {
    const registry = buildMaterialRegistry({
      rates: asRegistryRates(params.companyRates),
      editable: false,
    });
    for (const item of registry.items) {
      if (item.alias) continue;
      const result = resolveMaterialItem(item, params.componentUnit, params.companyRates);
      if (!result.ok) continue;
      const searchText = `${materialSearchText(item)} ${result.group}`;
      if (!variationRateQueryMatches(searchText, params.query)) continue;
      push({
        ...result,
        familyName: item.familyName,
        thickness: item.thickness,
        sheetSize: item.sheetSize,
        searchText,
      });
    }
  } else if (params.category !== "other") {
    for (const entry of candidateEntries(params.category)) {
      const result = resolveEntry(
        entry,
        params.componentUnit,
        params.companyRates,
        groupFor(entry, params.category)
      );
      if (!result.ok) continue;
      const searchText = [result.label, result.group, entry.description, entry.unit, entry.trade].filter(Boolean).join(" ");
      if (!variationRateQueryMatches(searchText, params.query)) continue;
      push({
        ...result,
        familyName: null,
        thickness: null,
        sheetSize: null,
        searchText,
      });
    }
  }
  resolved.sort(
    (left, right) =>
      left.group.localeCompare(right.group) || left.label.localeCompare(right.label) || left.canonicalKey.localeCompare(right.canonicalKey)
  );
  const limit = params.limit ?? RESULT_LIMIT;
  return {
    rates: resolved.slice(0, limit),
    truncated: resolved.length > limit,
  };
}

export { CATEGORY_CATALOGUE_LIMIT };
