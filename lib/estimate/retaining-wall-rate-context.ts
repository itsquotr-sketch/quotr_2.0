/**
 * RETAINING-WALL-MATURITY-1E — rate variance context.
 * Informative only. Never overrides Project / Company / Quotr hierarchy.
 */
import { timber1DMaterialStarter } from "@/lib/estimate/retaining-wall-timber-1d";
import { sleeper2AMaterialStarter } from "@/lib/estimate/retaining-wall-sleeper-2a";
import { masonry2BMaterialStarter } from "@/lib/estimate/retaining-wall-masonry-2b";
import { RW_MINI_EXCAVATOR_DAY_COST_EX_GST, RW_MINI_EXCAVATOR_DAY_KEY } from "@/lib/estimate/retaining-wall-construction-method";

/** Show comparison only when the applied rate differs by more than 25%. */
export const RW_RATE_VARIANCE_THRESHOLD = 0.25;

export type RateContextResult = {
  readonly comparable: true;
  readonly appliedRate: number;
  readonly benchmarkRate: number;
  readonly unit: string;
  readonly percentAboveBenchmark: number;
  readonly copy: string;
};

function nearRelative(applied: number, benchmark: number): boolean {
  if (benchmark <= 0 || applied <= 0) return true;
  return Math.abs(applied - benchmark) / benchmark < RW_RATE_VARIANCE_THRESHOLD;
}

function quotrBenchmarkForKey(
  itemKey: string | null | undefined,
  unit: string | null | undefined
): { cost: number; unit: string } | null {
  if (!itemKey || !unit) return null;
  if (itemKey === RW_MINI_EXCAVATOR_DAY_KEY && unit === "day") {
    return { cost: RW_MINI_EXCAVATOR_DAY_COST_EX_GST, unit: "day" };
  }
  const starter =
    timber1DMaterialStarter(itemKey) ??
    sleeper2AMaterialStarter(itemKey, unit) ??
    masonry2BMaterialStarter(itemKey, unit);
  if (!starter) return null;
  if (starter.unit !== unit) return null;
  return { cost: starter.costPerUnit, unit: starter.unit };
}

/**
 * Comparable identity + unit only. Never EA vs $/lm, never generic vs stock SKU.
 */
export function timberRateVarianceContext(params: {
  itemKey: string | null | undefined;
  unit: string | null | undefined;
  appliedCostRate: number | null | undefined;
  rateLabel: string;
}): RateContextResult | null {
  const applied = params.appliedCostRate;
  if (applied == null || applied <= 0) return null;
  const source = params.rateLabel.toLowerCase();
  if (source.includes("benchmark") || source.includes("quotr")) return null;
  if (!source.includes("company") && !source.includes("work area") && !source.includes("project")) {
    return null;
  }
  const benchmark = quotrBenchmarkForKey(params.itemKey, params.unit);
  if (!benchmark) return null;
  if (nearRelative(applied, benchmark.cost)) return null;
  const percentAbove = (applied - benchmark.cost) / benchmark.cost;
  const direction =
    percentAbove > 0
      ? `${Math.round(percentAbove * 100)}% above Quotr benchmark`
      : `${Math.round(Math.abs(percentAbove) * 100)}% below Quotr benchmark`;
  const copy = `Quotr benchmark: $${benchmark.cost.toFixed(2)}/${benchmark.unit} · ${direction}`;
  return {
    comparable: true,
    appliedRate: applied,
    benchmarkRate: benchmark.cost,
    unit: benchmark.unit,
    percentAboveBenchmark: percentAbove,
    copy,
  };
}
