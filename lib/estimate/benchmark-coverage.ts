/**
 * EST-BENCHMARK-01A — generic Work Area benchmark coverage contract.
 *
 * Every ordinary V1 requirement must be classified. Future Work Areas fail
 * closure if a new ordinary component has neither Quotr fallback nor an
 * intentional Pricing Required flag.
 */

import { getCatalogueEntry } from "@/lib/rates/catalogue";
import { derivedDimensionedPlasterboardCost } from "@/lib/estimate/ceilings-plasterboard-derived-cost";
import { getQuotrProductivityBenchmark } from "@/lib/estimate/productivity";

export const BENCHMARK_COVERAGE_CONTRACT_VERSION = "est-benchmark-01a.0" as const;

export const BENCHMARK_COVERAGE_OUTCOMES = [
  "RESOLVES_WITH_QUOTR",
  "INTENTIONAL_PRICING_REQUIRED",
  "NEEDS_NEW_QUOTR_BENCHMARK",
] as const;

export type BenchmarkCoverageOutcome =
  (typeof BENCHMARK_COVERAGE_OUTCOMES)[number];

export const BENCHMARK_GAP_CLASSES = [
  "EXISTING_BENCHMARK_REUSED",
  "SAFE_DERIVATION",
  "NEEDS_NEW_QUOTR_BENCHMARK",
  "MUST_REMAIN_PRICING_REQUIRED",
] as const;

export type BenchmarkGapClass =
  (typeof BENCHMARK_GAP_CLASSES)[number];

export type WorkAreaBenchmarkRequirement = {
  readonly workAreaType: string;
  readonly component: string;
  readonly materialIdentity: string | null;
  readonly physicalUnit: string;
  readonly productivityOperation: string | null;
  readonly fixings: boolean;
  readonly ordinaryV1: boolean;
  readonly outcome: BenchmarkCoverageOutcome;
  readonly gapClass: BenchmarkGapClass;
  readonly derivation: string | null;
  readonly currentWithoutCompany: string;
  readonly notes: string;
};

export type WorkAreaBenchmarkCoverageResult = {
  readonly workAreaType: string;
  readonly ok: boolean;
  readonly unclassified: readonly WorkAreaBenchmarkRequirement[];
  readonly ordinaryAccidentalPr: readonly WorkAreaBenchmarkRequirement[];
  readonly resolvesDeclaredButLiveMissing: readonly WorkAreaBenchmarkRequirement[];
  readonly needsOwnerApproval: readonly WorkAreaBenchmarkRequirement[];
  readonly intentionalPr: readonly WorkAreaBenchmarkRequirement[];
  readonly resolves: readonly WorkAreaBenchmarkRequirement[];
  readonly failures: readonly string[];
};

export function liveQuotrMaterialCost(itemKey: string | null): number | null {
  if (!itemKey) return null;
  const entry = getCatalogueEntry(itemKey);
  if (entry?.defaultCostRate != null && entry.defaultCostRate > 0) {
    return entry.defaultCostRate;
  }
  const derived = derivedDimensionedPlasterboardCost(itemKey);
  return derived?.derivedCost ?? null;
}

export function liveQuotrProductivity(productivityKey: string | null): number | null {
  if (!productivityKey) return null;
  const row = getQuotrProductivityBenchmark(productivityKey);
  return row && row.hoursPerUnit > 0 ? row.hoursPerUnit : null;
}

function liveResolves(row: WorkAreaBenchmarkRequirement): boolean {
  const materialOk =
    row.materialIdentity == null ||
    liveQuotrMaterialCost(row.materialIdentity) != null;
  const productivityOk =
    row.productivityOperation == null ||
    liveQuotrProductivity(row.productivityOperation) != null;
  return materialOk && productivityOk;
}

export function verifyWorkAreaBenchmarkCoverage(
  workAreaType: string,
  requirements: readonly WorkAreaBenchmarkRequirement[]
): WorkAreaBenchmarkCoverageResult {
  const scoped = requirements.filter((row) => row.workAreaType === workAreaType);
  const unclassified: WorkAreaBenchmarkRequirement[] = [];
  const ordinaryAccidentalPr: WorkAreaBenchmarkRequirement[] = [];
  const resolvesDeclaredButLiveMissing: WorkAreaBenchmarkRequirement[] = [];
  const needsOwnerApproval: WorkAreaBenchmarkRequirement[] = [];
  const intentionalPr: WorkAreaBenchmarkRequirement[] = [];
  const resolves: WorkAreaBenchmarkRequirement[] = [];
  const failures: string[] = [];

  for (const row of scoped) {
    if (!(BENCHMARK_COVERAGE_OUTCOMES as readonly string[]).includes(row.outcome)) {
      unclassified.push(row);
      failures.push(`${row.component}: unclassified outcome`);
      continue;
    }
    if (row.outcome === "RESOLVES_WITH_QUOTR") {
      resolves.push(row);
      if (!liveResolves(row)) {
        resolvesDeclaredButLiveMissing.push(row);
        failures.push(
          `${row.component}: declared RESOLVES_WITH_QUOTR but live Quotr COST/productivity is missing`
        );
      }
      continue;
    }
    if (row.outcome === "INTENTIONAL_PRICING_REQUIRED") {
      intentionalPr.push(row);
      continue;
    }
    needsOwnerApproval.push(row);
    if (row.ordinaryV1 && row.gapClass !== "NEEDS_NEW_QUOTR_BENCHMARK") {
      ordinaryAccidentalPr.push(row);
      failures.push(
        `${row.component}: ordinary ordinary-V1 PR without NEEDS_NEW_QUOTR_BENCHMARK or INTENTIONAL flag`
      );
    }
  }

  for (const row of scoped) {
    if (
      row.ordinaryV1 &&
      row.outcome === "INTENTIONAL_PRICING_REQUIRED" &&
      row.gapClass !== "MUST_REMAIN_PRICING_REQUIRED"
    ) {
      ordinaryAccidentalPr.push(row);
      failures.push(
        `${row.component}: ordinary V1 marked INTENTIONAL_PR without MUST_REMAIN_PRICING_REQUIRED`
      );
    }
  }

  return {
    workAreaType,
    ok: failures.length === 0 && unclassified.length === 0,
    unclassified,
    ordinaryAccidentalPr,
    resolvesDeclaredButLiveMissing,
    needsOwnerApproval,
    intentionalPr,
    resolves,
    failures,
  };
}

export function listUnsupportedWorkAreaCoverage(workAreaType: string): string {
  return `${workAreaType} has no registered ordinary V1 benchmark coverage inventory.`;
}

/**
 * L5 / CLOSED (Factory WA-9 MATURE) requires every ordinary V1 requirement
 * to resolve with Quotr or be intentionally PR. Category C gaps block close.
 */
export function workAreaMayCloseAtL5(
  result: WorkAreaBenchmarkCoverageResult
): boolean {
  return (
    result.ok &&
    result.needsOwnerApproval.length === 0 &&
    result.unclassified.length === 0 &&
    result.ordinaryAccidentalPr.length === 0 &&
    result.resolvesDeclaredButLiveMissing.length === 0
  );
}
