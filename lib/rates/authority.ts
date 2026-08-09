/**
 * Rate authority & provenance vocabulary (Stage 3.1C.3-R2C).
 *
 * Presentation labels only — does not change commercial formulas.
 * No DB provenance column exists; org rows with cost_rate are treated as
 * EXPLICIT_COMPANY. Benchmarks live in code until explicitly adopted.
 */

export const RATE_AUTHORITY = {
  EXPLICIT_COMPANY: "EXPLICIT_COMPANY",
  PROJECT_OVERRIDE: "PROJECT_OVERRIDE",
  BENCHMARK: "BENCHMARK",
  FALLBACK: "FALLBACK",
  LEGACY_SCOPE_RATE: "LEGACY_SCOPE_RATE",
  FUTURE_CALIBRATION: "FUTURE_CALIBRATION",
  MISSING: "MISSING",
} as const;

export type RateAuthority =
  (typeof RATE_AUTHORITY)[keyof typeof RATE_AUTHORITY];

/** Contractor-facing labels — never expose enum names. */
export const RATE_AUTHORITY_LABELS: Record<RateAuthority, string> = {
  EXPLICIT_COMPANY: "Your company rate",
  PROJECT_OVERRIDE: "Project override",
  BENCHMARK: "Quotr benchmark",
  FALLBACK: "Default assumption",
  LEGACY_SCOPE_RATE: "Overall benchmark rate",
  FUTURE_CALIBRATION: "Calibration evidence",
  MISSING: "Pricing required",
};

/**
 * Authority for a persisted org rate row vs catalogue defaults.
 * Catalogue defaultCostRate alone is NEVER "Your company rate".
 */
export function resolveCompanyRateAuthority(input: {
  hasActiveCostRate: boolean;
  isLegacyScopePackage?: boolean;
}): RateAuthority {
  if (input.hasActiveCostRate) {
    return input.isLegacyScopePackage
      ? RATE_AUTHORITY.LEGACY_SCOPE_RATE
      : RATE_AUTHORITY.EXPLICIT_COMPANY;
  }
  return RATE_AUTHORITY.MISSING;
}

export function companyRateAuthorityLabel(input: {
  hasActiveCostRate: boolean;
  isLegacyScopePackage?: boolean;
  hasCatalogueBenchmark?: boolean;
}): string {
  if (input.hasActiveCostRate) {
    return RATE_AUTHORITY_LABELS[
      resolveCompanyRateAuthority({
        hasActiveCostRate: true,
        isLegacyScopePackage: input.isLegacyScopePackage,
      })
    ];
  }
  if (input.hasCatalogueBenchmark) {
    return RATE_AUTHORITY_LABELS.BENCHMARK;
  }
  return RATE_AUTHORITY_LABELS.MISSING;
}

/** Future DNA / calibration — documentation contract only. */
export const FUTURE_RATE_AUTHORITY_STACK = [
  "PROJECT_EXPLICIT_OVERRIDE",
  "COMPANY_EXPLICIT_RATE",
  "COMPANY_DNA_OR_CALIBRATION_RECOMMENDATION (future — never silent)",
  "QUOTR_BENCHMARK",
  "MISSING",
] as const;
