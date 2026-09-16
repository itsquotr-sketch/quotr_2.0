/**
 * RATES-MATERIALS-UI-01 — canonical Rates materials read model.
 *
 * Derived from the specific material catalogue and company overrides.
 * Presentation only: does not change estimator formulas, benchmarks,
 * identities, or rate-precedence rules.
 */

import { FULL_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import {
  classifyMaterialPresentation,
  MATERIAL_CATEGORY_ORDER,
  MATERIALS_PAGE_ALIAS_ROWS,
  materialWorkAreaLabel,
  type MaterialCategoryId,
  type MaterialLegacyKind,
  type MaterialPresentation,
  type MaterialVariantLayout,
} from "@/lib/rates/material-presentation-map";
import { isMaterialRatesCatalogueEntry } from "@/lib/rates/rate-section-contract";
import type { RateCatalogueEntry, RatesPageRate } from "@/lib/rates/types";

/** Ensure catalogue graph is fully initialized before reading specific arrays. */
void FULL_RATE_CATALOGUE.length;

function getSpecificMaterialCatalogue(): RateCatalogueEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/rates/specific-material-catalogue") as {
    SPECIFIC_MATERIAL_RATE_CATALOGUE: RateCatalogueEntry[];
    WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[];
  };
  return mod.SPECIFIC_MATERIAL_RATE_CATALOGUE;
}

function getWasteKeys(): Set<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/rates/specific-material-catalogue") as {
    WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE: RateCatalogueEntry[];
  };
  return new Set(
    mod.WASTE_DISPOSAL_SPECIFIC_MATERIAL_CATALOGUE.map((entry) => entry.item_key)
  );
}

/** Lazy to avoid catalogue ↔ plasterboard-derived circular init under tsx. */
function getDerivedPlasterboardCost(itemKey: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/estimate/ceilings-plasterboard-derived-cost") as {
    derivedDimensionedPlasterboardCost: (
      key: string | null | undefined
    ) => {
      derivedCost: number;
      baseKey: string;
    } | null;
  };
  return mod.derivedDimensionedPlasterboardCost(itemKey);
}

export type MaterialEffectiveSource =
  | "company"
  | "direct_benchmark"
  | "derived_benchmark"
  | "pricing_required";

export type MaterialStatusFilter =
  | "all"
  | "customised"
  | "benchmark"
  | "pricing_required";

export type MaterialRegistryItem = {
  canonicalKey: string;
  label: string;
  unit: string;
  workAreaTypes: readonly string[];
  workAreaLabels: readonly string[];
  categoryId: MaterialCategoryId;
  categoryName: string;
  familyId: string;
  familyName: string;
  familyDescription: string | null;
  variantLayout: MaterialVariantLayout;
  thickness: string | null;
  sheetSize: string | null;
  section: string | null;
  gradeTreatment: string | null;
  colourType: string | null;
  quotrBenchmarkCost: number | null;
  companyOverride: number | null;
  effectiveRate: number | null;
  effectiveSource: MaterialEffectiveSource;
  benchmarkKind: "direct" | "derived" | "none";
  derivedFromKey: string | null;
  derivedHint: string | null;
  alias: boolean;
  aliasOfKey: string | null;
  legacy: boolean;
  legacyKind: MaterialLegacyKind;
  ordinary: boolean;
  editable: boolean;
  catalogueEntry: RateCatalogueEntry;
  companyRate: RatesPageRate | null;
  presentation: MaterialPresentation;
};

export type MaterialFamilyGroup = {
  familyId: string;
  familyName: string;
  familyDescription: string | null;
  variantLayout: MaterialVariantLayout;
  ordinaryItems: MaterialRegistryItem[];
  legacyItems: MaterialRegistryItem[];
  variantCount: number;
  customisedCount: number;
  benchmarkCount: number;
  pricingRequiredCount: number;
  statusSummary: string;
};

export type MaterialCategoryGroup = {
  categoryId: MaterialCategoryId;
  categoryName: string;
  families: MaterialFamilyGroup[];
  familyCount: number;
  variantCount: number;
  customisedCount: number;
  benchmarkCount: number;
  pricingRequiredCount: number;
};

const WASTE_KEYS = getWasteKeys();

export function isMaterialsPageCatalogueEntry(entry: RateCatalogueEntry): boolean {
  if (!isMaterialRatesCatalogueEntry(entry)) return false;
  if (entry.item_key.startsWith("plant.")) return false;
  if (entry.workAreaLabel?.toLowerCase().includes("plant")) return false;
  if (WASTE_KEYS.has(entry.item_key)) return false;
  return true;
}

export function listMaterialsPageCatalogueEntries(): RateCatalogueEntry[] {
  const seen = new Set<string>();
  const entries: RateCatalogueEntry[] = [];
  for (const entry of getSpecificMaterialCatalogue()) {
    if (!isMaterialsPageCatalogueEntry(entry)) continue;
    if (seen.has(entry.item_key)) continue;
    seen.add(entry.item_key);
    entries.push(entry);
  }
  return entries;
}

export function editableMaterialCatalogueKeys(): string[] {
  return listMaterialsPageCatalogueEntries().map((entry) => entry.item_key);
}

function findCompanyMaterialRate(
  rates: RatesPageRate[],
  itemKey: string,
  rateType: string
): RatesPageRate | null {
  const row = rates.find(
    (rate) =>
      rate.item_key === itemKey &&
      rate.rate_type === rateType &&
      rate.active &&
      rate.cost_rate != null
  );
  return row ?? null;
}

function aliasCatalogueEntry(aliasKey: string): RateCatalogueEntry | null {
  const spec = MATERIALS_PAGE_ALIAS_ROWS.find((row) => row.aliasKey === aliasKey);
  if (!spec) return null;
  const canonical = listMaterialsPageCatalogueEntries().find(
    (entry) => entry.item_key === spec.canonicalKey
  );
  if (!canonical) return null;
  return {
    ...canonical,
    item_key: spec.aliasKey,
    label: spec.label,
    unit: spec.unit,
    description: spec.explanation,
    calculatorSupport: "leftover",
    recommended: false,
  };
}

function resolveBenchmark(entry: RateCatalogueEntry): {
  cost: number | null;
  kind: "direct" | "derived" | "none";
  derivedFromKey: string | null;
  hint: string | null;
} {
  if (entry.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)) {
    return {
      cost: Number(entry.defaultCostRate),
      kind: "direct",
      derivedFromKey: null,
      hint: null,
    };
  }
  const derived = getDerivedPlasterboardCost(entry.item_key);
  if (derived) {
    return {
      cost: derived.derivedCost,
      kind: "derived",
      derivedFromKey: derived.baseKey,
      hint: "Derived from the approved same-family sheet rate by area.",
    };
  }
  return { cost: null, kind: "none", derivedFromKey: null, hint: null };
}

function resolveEffectiveSource(
  companyRate: RatesPageRate | null,
  kind: "direct" | "derived" | "none"
): MaterialEffectiveSource {
  if (companyRate?.cost_rate != null) return "company";
  if (kind === "direct") return "direct_benchmark";
  if (kind === "derived") return "derived_benchmark";
  return "pricing_required";
}

export function buildMaterialRegistryItem(params: {
  entry: RateCatalogueEntry;
  rates: RatesPageRate[];
  editable: boolean;
  alias?: boolean;
  aliasOfKey?: string | null;
}): MaterialRegistryItem {
  const presentation = classifyMaterialPresentation(params.entry);
  const ordinary = params.alias ? false : presentation.ordinary;
  const legacyKind: MaterialLegacyKind = params.alias
    ? "alias"
    : presentation.legacyKind;
  const companyRate = findCompanyMaterialRate(
    params.rates,
    params.entry.item_key,
    params.entry.rate_type
  );
  const benchmark = resolveBenchmark(params.entry);
  const companyOverride =
    companyRate?.cost_rate != null ? Number(companyRate.cost_rate) : null;
  const effectiveSource = resolveEffectiveSource(companyRate, benchmark.kind);
  const effectiveRate =
    companyOverride != null ? companyOverride : benchmark.cost;

  return {
    canonicalKey: params.entry.item_key,
    label: params.entry.label,
    unit: params.entry.unit,
    workAreaTypes: presentation.usedInWorkAreaTypes,
    workAreaLabels: presentation.usedInWorkAreaTypes.map(materialWorkAreaLabel),
    categoryId: presentation.categoryId,
    categoryName: presentation.categoryName,
    familyId: presentation.familyId,
    familyName: presentation.familyName,
    familyDescription: presentation.familyDescription,
    variantLayout: presentation.variantLayout,
    thickness: presentation.thickness,
    sheetSize: presentation.sheetSize,
    section: presentation.section,
    gradeTreatment: presentation.gradeTreatment,
    colourType: presentation.colourType,
    quotrBenchmarkCost: benchmark.cost,
    companyOverride,
    effectiveRate,
    effectiveSource,
    benchmarkKind: benchmark.kind,
    derivedFromKey: benchmark.derivedFromKey,
    derivedHint: benchmark.hint,
    alias: Boolean(params.alias),
    aliasOfKey: params.aliasOfKey ?? presentation.aliasOfKey,
    legacy: !ordinary,
    legacyKind,
    ordinary,
    editable: params.editable,
    catalogueEntry: params.entry,
    companyRate,
    presentation,
  };
}

function familyStatusSummary(family: {
  customisedCount: number;
  benchmarkCount: number;
  pricingRequiredCount: number;
}): string {
  const parts: string[] = [];
  if (family.customisedCount > 0) {
    parts.push(`${family.customisedCount} customised`);
  }
  if (family.benchmarkCount > 0) {
    parts.push(`${family.benchmarkCount} Quotr`);
  }
  if (family.pricingRequiredCount > 0) {
    parts.push(`${family.pricingRequiredCount} pricing required`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No rates yet";
}

function countSources(items: MaterialRegistryItem[]): {
  customisedCount: number;
  benchmarkCount: number;
  pricingRequiredCount: number;
} {
  return {
    customisedCount: items.filter((item) => item.effectiveSource === "company")
      .length,
    benchmarkCount: items.filter(
      (item) =>
        item.effectiveSource === "direct_benchmark" ||
        item.effectiveSource === "derived_benchmark"
    ).length,
    pricingRequiredCount: items.filter(
      (item) => item.effectiveSource === "pricing_required"
    ).length,
  };
}

export function buildMaterialRegistry(params: {
  rates?: RatesPageRate[];
  editable?: boolean;
}): {
  items: MaterialRegistryItem[];
  categories: MaterialCategoryGroup[];
} {
  const rates = params.rates ?? [];
  const editable = params.editable ?? true;

  const items = listMaterialsPageCatalogueEntries().map((entry) =>
    buildMaterialRegistryItem({ entry, rates, editable })
  );

  for (const alias of MATERIALS_PAGE_ALIAS_ROWS) {
    if (items.some((item) => item.canonicalKey === alias.aliasKey)) continue;
    const entry = aliasCatalogueEntry(alias.aliasKey);
    if (!entry) continue;
    items.push(
      buildMaterialRegistryItem({
        entry,
        rates,
        editable,
        alias: true,
        aliasOfKey: alias.canonicalKey,
      })
    );
  }

  const byCategory = new Map<MaterialCategoryId, MaterialRegistryItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.categoryId) ?? [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }

  const categories: MaterialCategoryGroup[] = MATERIAL_CATEGORY_ORDER.filter(
    (id) => byCategory.has(id)
  ).map((categoryId) => {
    const categoryItems = byCategory.get(categoryId) ?? [];
    const familyIds = [...new Set(categoryItems.map((item) => item.familyId))];
    const families: MaterialFamilyGroup[] = familyIds.map((familyId) => {
      const familyItems = categoryItems.filter((item) => item.familyId === familyId);
      const ordinaryItems = familyItems.filter((item) => item.ordinary);
      const legacyItems = familyItems.filter((item) => !item.ordinary);
      const counts = countSources(ordinaryItems);
      const first = familyItems[0]!;
      return {
        familyId,
        familyName: first.familyName,
        familyDescription: first.familyDescription,
        variantLayout: first.variantLayout,
        ordinaryItems,
        legacyItems,
        variantCount: ordinaryItems.length,
        ...counts,
        statusSummary: familyStatusSummary(counts),
      };
    });

    const ordinaryAll = families.flatMap((family) => family.ordinaryItems);
    const counts = countSources(ordinaryAll);
    return {
      categoryId,
      categoryName: categoryItems[0]?.categoryName ?? categoryId,
      families,
      familyCount: families.filter(
        (family) => family.ordinaryItems.length > 0 || family.legacyItems.length > 0
      ).length,
      variantCount: ordinaryAll.length,
      ...counts,
    };
  });

  return { items, categories };
}

export function materialStatusMatches(
  item: MaterialRegistryItem,
  filter: MaterialStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "customised") return item.effectiveSource === "company";
  if (filter === "benchmark") {
    return (
      item.effectiveSource === "direct_benchmark" ||
      item.effectiveSource === "derived_benchmark"
    );
  }
  return item.effectiveSource === "pricing_required";
}

export function materialSearchMatches(
  item: MaterialRegistryItem,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.familyName,
    item.label,
    item.canonicalKey,
    item.categoryName,
    item.unit,
    item.thickness ?? "",
    item.sheetSize ?? "",
    item.section ?? "",
    item.gradeTreatment ?? "",
    item.colourType ?? "",
    item.familyDescription ?? "",
    ...item.workAreaLabels,
    ...item.workAreaTypes,
    item.catalogueEntry.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function materialWorkAreaMatches(
  item: MaterialRegistryItem,
  workArea: string
): boolean {
  if (!workArea || workArea === "all") return true;
  return item.workAreaTypes.includes(workArea);
}

export function filterMaterialCategories(params: {
  categories: MaterialCategoryGroup[];
  query: string;
  status: MaterialStatusFilter;
  categoryId: string;
  workArea: string;
}): MaterialCategoryGroup[] {
  return params.categories
    .filter(
      (category) =>
        params.categoryId === "all" || category.categoryId === params.categoryId
    )
    .map((category) => {
      const families = category.families
        .map((family) => {
          const match = (item: MaterialRegistryItem) =>
            materialSearchMatches(item, params.query) &&
            materialStatusMatches(item, params.status) &&
            materialWorkAreaMatches(item, params.workArea);
          const ordinaryItems = family.ordinaryItems.filter(match);
          const legacyItems = family.legacyItems.filter(match);
          if (ordinaryItems.length === 0 && legacyItems.length === 0) {
            return null;
          }
          const counts = countSources(ordinaryItems);
          return {
            ...family,
            ordinaryItems,
            legacyItems,
            variantCount: ordinaryItems.length,
            ...counts,
            statusSummary: familyStatusSummary(counts),
          };
        })
        .filter((family): family is MaterialFamilyGroup => family != null);
      if (families.length === 0) return null;
      const ordinaryAll = families.flatMap((family) => family.ordinaryItems);
      const counts = countSources(ordinaryAll);
      return {
        ...category,
        families,
        familyCount: families.length,
        variantCount: ordinaryAll.length,
        ...counts,
      };
    })
    .filter((category): category is MaterialCategoryGroup => category != null);
}

export function materialEffectiveSourceLabel(
  source: MaterialEffectiveSource,
  benchmarkKind: "direct" | "derived" | "none"
): string {
  switch (source) {
    case "company":
      return "Your company rate";
    case "direct_benchmark":
      return "Direct benchmark";
    case "derived_benchmark":
      return "Derived Quotr benchmark";
    case "pricing_required":
      return "Pricing required";
    default:
      return benchmarkKind === "derived"
        ? "Derived Quotr benchmark"
        : "Quotr benchmark";
  }
}

export function materialLegacyLabel(kind: MaterialLegacyKind): string | null {
  switch (kind) {
    case "alias":
      return "Alias for earlier estimates";
    case "legacy_identity":
      return "Legacy identity";
    case "leftover":
      return "Legacy — earlier estimates";
    default:
      return null;
  }
}

export function listMaterialWorkAreaFilterOptions(
  items: MaterialRegistryItem[]
): { value: string; label: string }[] {
  const types = new Set<string>();
  for (const item of items) {
    for (const type of item.workAreaTypes) types.add(type);
  }
  return [...types]
    .sort((a, b) =>
      materialWorkAreaLabel(a).localeCompare(materialWorkAreaLabel(b))
    )
    .map((value) => ({ value, label: materialWorkAreaLabel(value) }));
}
