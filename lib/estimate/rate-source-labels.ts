/** Contractor-friendly rate source labels for estimate line items and summaries. */

export type RateSourceType =
  | "user_rate"
  | "work_area_rate"
  | "derived_from_margin"
  | "benchmark"
  | "productivity"
  | "fallback"
  | "missing"
  | "default";

export const RATE_SOURCE_FRIENDLY_LABELS: Record<RateSourceType, string> = {
  user_rate: "Your rate",
  work_area_rate: "Your work area rate",
  derived_from_margin: "Derived from margin",
  benchmark: "Benchmark allowance",
  productivity: "Benchmark productivity",
  fallback: "Fallback allowance",
  missing: "Missing rate",
  default: "Default allowance",
};

export function getRateSourceLabel(type: RateSourceType): string {
  return RATE_SOURCE_FRIENDLY_LABELS[type];
}

/** Map legacy / internal strings to a stable source type. */
export function classifyRateSource(raw: string): RateSourceType {
  const source = raw.trim().toLowerCase();

  if (!source) return "default";

  if (
    source.includes("your rate") ||
    source.includes("user rate") ||
    source === "org_rate"
  ) {
    return "user_rate";
  }

  if (
    source.includes("work area rate") ||
    source.includes("your work area")
  ) {
    return "work_area_rate";
  }

  if (source.includes("derived from margin")) {
    return "derived_from_margin";
  }

  if (source.includes("benchmark productivity") || source === "productivity") {
    return "productivity";
  }

  if (source.includes("missing rate") || source === "rate missing") {
    return "missing";
  }

  if (source.includes("fallback")) {
    return "fallback";
  }

  if (source.includes("default allowance") || source === "default") {
    return "default";
  }

  if (source.includes("benchmark")) {
    return "benchmark";
  }

  return "benchmark";
}

export function normalizeRateSourceLabel(raw: string): string {
  return getRateSourceLabel(classifyRateSource(raw));
}

export function isUserRateSource(type: RateSourceType): boolean {
  return type === "user_rate" || type === "work_area_rate";
}

export function isBenchmarkLikeSource(type: RateSourceType): boolean {
  return (
    type === "benchmark" ||
    type === "productivity" ||
    type === "fallback" ||
    type === "default"
  );
}
