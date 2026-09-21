/**
 * RATES-PRODUCTIVITY-UI-01 — canonical Rates productivity read model.
 *
 * Single source of truth for the Labour & Productivity UI. Derived from
 * registered productivity catalogue entries (FULL_RATE_CATALOGUE). Do not
 * maintain separate manually curated key unions for cards, sections, or
 * "All productivity keys."
 *
 * Presentation only: does not change estimator formulas, benchmarks, or
 * company override values.
 */

import {
  COMPANY_DNA_WORK_AREA_LABELS,
  COMPANY_DNA_WORK_AREA_TYPES,
} from "@/lib/company-dna/catalogue";
import { isCompanyDnaV2WorkArea } from "@/lib/company-dna/v2-ui";
import { FULL_RATE_CATALOGUE } from "@/lib/rates/catalogue";
import { isProductivityRatesCatalogueEntry } from "@/lib/rates/rate-section-contract";
import type { RateCatalogueEntry, RatesPageRate } from "@/lib/rates/types";

export type ProductivityEffectiveSource =
  | "calibrated"
  | "company"
  | "benchmark"
  | "pricing_required";

export type ProductivityStatusFilter =
  | "all"
  | "customised"
  | "benchmark"
  | "pricing_required";

export type ProductivityLegacyKind =
  | "legacy"
  | "deprecated"
  | "compatibility_only"
  | "not_used_for_detailed_estimating"
  | null;

export type ProductivityRegistryItem = {
  productivityKey: string;
  label: string;
  workAreaType: string;
  workAreaLabel: string;
  description: string | null;
  benchmarkHours: number | null;
  unit: string;
  companyOverrideHours: number | null;
  effectiveValue: number | null;
  effectiveSource: ProductivityEffectiveSource;
  editable: boolean;
  legacy: boolean;
  legacyKind: ProductivityLegacyKind;
  calibrationAvailable: boolean;
  catalogueEntry: RateCatalogueEntry;
  companyRate: RatesPageRate | null;
};

export type ProductivityWorkAreaGroup = {
  workAreaType: string;
  workAreaLabel: string;
  calibrationSupported: boolean;
  items: ProductivityRegistryItem[];
  ordinaryItems: ProductivityRegistryItem[];
  legacyItems: ProductivityRegistryItem[];
  operationCount: number;
  customisedCount: number;
  benchmarkCount: number;
  pricingRequiredCount: number;
};

const WORK_AREA_DISPLAY_LABELS: Record<string, string> = {
  deck: "Deck",
  fence: "Fence",
  retaining_wall: "Retaining Wall",
  bathroom: "Bathroom",
  ceilings: "Ceilings",
  internal_walls: "Internal Walls",
  painting: "Painting",
  doors: "Doors",
  flooring: "Flooring",
  ...Object.fromEntries(
    Object.entries(COMPANY_DNA_WORK_AREA_LABELS).map(([key, label]) => [
      key,
      key === "retaining_wall" ? "Retaining Wall" : label,
    ])
  ),
};

const DNA_WORK_AREA_SET = new Set<string>(COMPANY_DNA_WORK_AREA_TYPES);

/** Preferred display order; unknown types append alphabetically by label. */
const WORK_AREA_ORDER: readonly string[] = [
  "deck",
  "retaining_wall",
  "bathroom",
  "fence",
  "ceilings",
  "internal_walls",
  "painting",
  "doors",
  "flooring",
];

export function productivityWorkAreaLabel(workAreaType: string): string {
  if (WORK_AREA_DISPLAY_LABELS[workAreaType]) {
    return WORK_AREA_DISPLAY_LABELS[workAreaType];
  }
  return workAreaType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isProductivityCalibrationSupported(
  workAreaType: string
): boolean {
  return DNA_WORK_AREA_SET.has(workAreaType) || isCompanyDnaV2WorkArea(workAreaType);
}

export function isLegacyProductivityCatalogueEntry(
  entry: RateCatalogueEntry
): boolean {
  // Prefer catalogue support flag. Label-only fallback avoids treating
  // active keys whose descriptions merely mention legacy alternatives.
  if (entry.calculatorSupport === "leftover") return true;
  const label = entry.label.toLowerCase();
  return (
    /\blegacy\b/.test(label) ||
    /\bdeprecated\b/.test(label) ||
    /\bleftover\b/.test(label) ||
    /\bcompatibility[- ]only\b/.test(label)
  );
}

export function productivityLegacyKind(
  entry: RateCatalogueEntry
): ProductivityLegacyKind {
  if (!isLegacyProductivityCatalogueEntry(entry)) return null;
  const blob = `${entry.label} ${entry.description ?? ""}`.toLowerCase();
  if (/\bdeprecated\b/.test(blob)) return "deprecated";
  if (/\bcompatibility[- ]only\b/.test(blob)) return "compatibility_only";
  if (
    /\bnot used for detailed\b/.test(blob) ||
    /\bnot consumed for detailed\b/.test(blob) ||
    /\bleftover\b/.test(entry.label.toLowerCase()) ||
    entry.calculatorSupport === "leftover"
  ) {
    return "not_used_for_detailed_estimating";
  }
  return "legacy";
}

export function listRegisteredProductivityCatalogueEntries(): RateCatalogueEntry[] {
  const seen = new Set<string>();
  const entries: RateCatalogueEntry[] = [];
  for (const entry of FULL_RATE_CATALOGUE) {
    if (!isProductivityRatesCatalogueEntry(entry)) continue;
    if (seen.has(entry.item_key)) continue;
    seen.add(entry.item_key);
    entries.push(entry);
  }
  return entries;
}

export function editableProductivityCatalogueKeys(): string[] {
  return listRegisteredProductivityCatalogueEntries().map(
    (entry) => entry.item_key
  );
}

function findCompanyProductivityRate(
  rates: RatesPageRate[],
  itemKey: string
): RatesPageRate | null {
  const row = rates.find(
    (rate) =>
      rate.item_key === itemKey &&
      rate.rate_type === "productivity" &&
      rate.active &&
      rate.cost_rate != null
  );
  return row ?? null;
}

function resolveEffectiveSource(
  companyRate: RatesPageRate | null,
  benchmarkHours: number | null
): ProductivityEffectiveSource {
  if (companyRate?.cost_rate != null) {
    if (companyRate.source === "calibrated_productivity") return "calibrated";
    return "company";
  }
  if (benchmarkHours != null) return "benchmark";
  return "pricing_required";
}

export function buildProductivityRegistryItem(params: {
  entry: RateCatalogueEntry;
  rates: RatesPageRate[];
  editable: boolean;
}): ProductivityRegistryItem {
  const { entry, rates, editable } = params;
  const workAreaType = entry.work_area_type?.trim() || "general";
  const companyRate = findCompanyProductivityRate(rates, entry.item_key);
  const companyOverrideHours =
    companyRate?.cost_rate != null ? Number(companyRate.cost_rate) : null;
  const benchmarkHours =
    entry.defaultCostRate != null && Number.isFinite(entry.defaultCostRate)
      ? Number(entry.defaultCostRate)
      : null;
  const effectiveSource = resolveEffectiveSource(companyRate, benchmarkHours);
  const effectiveValue =
    companyOverrideHours != null ? companyOverrideHours : benchmarkHours;

  return {
    productivityKey: entry.item_key,
    label: entry.label,
    workAreaType,
    workAreaLabel: productivityWorkAreaLabel(workAreaType),
    description: entry.description?.trim() ? entry.description : null,
    benchmarkHours,
    unit: entry.unit,
    companyOverrideHours,
    effectiveValue,
    effectiveSource,
    editable,
    legacy: isLegacyProductivityCatalogueEntry(entry),
    legacyKind: productivityLegacyKind(entry),
    calibrationAvailable: isProductivityCalibrationSupported(workAreaType),
    catalogueEntry: entry,
    companyRate,
  };
}

function workAreaSortIndex(workAreaType: string, preferred: string[]): number {
  const preferredIndex = preferred.indexOf(workAreaType);
  if (preferredIndex >= 0) return preferredIndex;
  const known = WORK_AREA_ORDER.indexOf(workAreaType);
  if (known >= 0) return preferred.length + known;
  return preferred.length + WORK_AREA_ORDER.length + 100;
}

export function buildProductivityRegistry(params: {
  rates?: RatesPageRate[];
  editable?: boolean;
  preferredWorkAreaTypes?: string[];
}): {
  items: ProductivityRegistryItem[];
  groups: ProductivityWorkAreaGroup[];
} {
  const rates = params.rates ?? [];
  const editable = params.editable ?? true;
  const preferred = (params.preferredWorkAreaTypes ?? []).filter(Boolean);

  const items = listRegisteredProductivityCatalogueEntries().map((entry) =>
    buildProductivityRegistryItem({ entry, rates, editable })
  );

  const byArea = new Map<string, ProductivityRegistryItem[]>();
  for (const item of items) {
    const list = byArea.get(item.workAreaType) ?? [];
    list.push(item);
    byArea.set(item.workAreaType, list);
  }

  const groups: ProductivityWorkAreaGroup[] = [...byArea.entries()]
    .map(([workAreaType, areaItems]) => {
      const ordinaryItems = areaItems.filter((item) => !item.legacy);
      const legacyItems = areaItems.filter((item) => item.legacy);
      const visibleForCounts = ordinaryItems;
      return {
        workAreaType,
        workAreaLabel: productivityWorkAreaLabel(workAreaType),
        calibrationSupported: isProductivityCalibrationSupported(workAreaType),
        items: areaItems,
        ordinaryItems,
        legacyItems,
        operationCount: visibleForCounts.length,
        customisedCount: visibleForCounts.filter(
          (item) =>
            item.effectiveSource === "company" ||
            item.effectiveSource === "calibrated"
        ).length,
        benchmarkCount: visibleForCounts.filter(
          (item) => item.effectiveSource === "benchmark"
        ).length,
        pricingRequiredCount: visibleForCounts.filter(
          (item) => item.effectiveSource === "pricing_required"
        ).length,
      };
    })
    .sort((a, b) => {
      const ai = workAreaSortIndex(a.workAreaType, preferred);
      const bi = workAreaSortIndex(b.workAreaType, preferred);
      if (ai !== bi) return ai - bi;
      return a.workAreaLabel.localeCompare(b.workAreaLabel);
    });

  return { items, groups };
}

export function productivityStatusMatches(
  item: ProductivityRegistryItem,
  filter: ProductivityStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "customised") {
    return (
      item.effectiveSource === "company" ||
      item.effectiveSource === "calibrated"
    );
  }
  if (filter === "benchmark") return item.effectiveSource === "benchmark";
  return item.effectiveSource === "pricing_required";
}

export function productivitySearchMatches(
  item: ProductivityRegistryItem,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.workAreaLabel.toLowerCase().includes(q) ||
    item.workAreaType.toLowerCase().includes(q) ||
    item.label.toLowerCase().includes(q) ||
    item.productivityKey.toLowerCase().includes(q) ||
    item.unit.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

export function filterProductivityGroups(params: {
  groups: ProductivityWorkAreaGroup[];
  query: string;
  status: ProductivityStatusFilter;
  includeLegacyInFilter?: boolean;
}): ProductivityWorkAreaGroup[] {
  const includeLegacy = params.includeLegacyInFilter ?? true;
  return params.groups
    .map((group) => {
      const matchItem = (item: ProductivityRegistryItem) =>
        productivitySearchMatches(item, params.query) &&
        productivityStatusMatches(item, params.status);

      const ordinaryItems = group.ordinaryItems.filter(matchItem);
      const legacyItems = includeLegacy
        ? group.legacyItems.filter(matchItem)
        : group.legacyItems;
      if (ordinaryItems.length === 0 && legacyItems.length === 0) {
        return null;
      }
      return {
        ...group,
        ordinaryItems,
        legacyItems,
        items: [...ordinaryItems, ...legacyItems],
        operationCount: ordinaryItems.length,
        customisedCount: ordinaryItems.filter(
          (item) =>
            item.effectiveSource === "company" ||
            item.effectiveSource === "calibrated"
        ).length,
        benchmarkCount: ordinaryItems.filter(
          (item) => item.effectiveSource === "benchmark"
        ).length,
        pricingRequiredCount: ordinaryItems.filter(
          (item) => item.effectiveSource === "pricing_required"
        ).length,
      };
    })
    .filter((group): group is ProductivityWorkAreaGroup => group != null);
}

export function productivityEffectiveSourceLabel(
  source: ProductivityEffectiveSource
): string {
  switch (source) {
    case "calibrated":
      return "Your calibration";
    case "company":
      return "Your company rate";
    case "benchmark":
      return "Quotr benchmark";
    case "pricing_required":
      return "Pricing required";
  }
}

export function productivityLegacyLabel(
  kind: ProductivityLegacyKind
): string | null {
  switch (kind) {
    case "legacy":
      return "Legacy";
    case "deprecated":
      return "Deprecated";
    case "compatibility_only":
      return "Compatibility-only";
    case "not_used_for_detailed_estimating":
      return "Not used for detailed estimating";
    default:
      return null;
  }
}
