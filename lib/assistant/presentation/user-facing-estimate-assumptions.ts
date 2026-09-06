/**
 * BETA-2.2 — Presentation-only filter for Estimate Ready / Builder Review.
 *
 * Persisted estimate.assumptions, calculator output, and goldens are unchanged.
 * This helper decides which assumption strings a builder should see.
 *
 * Structured authority first (assumptionMetadata.defaultedFacts).
 * Legacy string exclusions are compatibility-only, not assumption authority.
 */
import type {
  AssumptionMetadata,
  DefaultedFactEntry,
} from "@/lib/estimate/assumption-metadata";
import { GENERAL_ESTIMATE_ASSUMPTIONS } from "@/lib/estimate/summary";
import {
  builderFacingFactLabel,
  looksLikeInternalFactKey,
} from "@/lib/assistant/presentation/fact-key-labels";

/** Estimate Ready initial disclosure cap (3–5). */
export const USER_FACING_ESTIMATE_ASSUMPTION_LIMIT = 5;

/**
 * Presentation categories mixed into persisted estimate.assumptions:
 * A physical — builder-relevant estimating assumption
 * B boundary — commercial / quote-boundary copy
 * C package_diagnostic — calculator / package / commercial-authority notes
 * D system_diagnostic — mode identifiers and other internal debug copy
 */
export type EstimateAssumptionPresentationCategory =
  | "physical"
  | "boundary"
  | "package_diagnostic"
  | "system_diagnostic";

const BOUNDARY_COPY_PATTERNS = [
  /internal working estimate/i,
  /not a client quote/i,
  /review it before creating final pricing/i,
];

/**
 * Legacy compatibility: known internal diagnostic patterns in persisted strings
 * that lack structured classification. Not assumption authority.
 */
const PACKAGE_DIAGNOSTIC_PATTERNS = [
  /commercial authority/i,
  /money authority/i,
  /monetary authority/i,
  /calculator fallback/i,
  /package remains money/i,
  /package lm lines remain/i,
  /physical model is detailed/i,
  /physical takeoff is independent/i,
  /lumped .+\bcommercial/i,
  /substructure package remains/i,
  /component-level money/i,
  /detailed component (?:money|prices|authority)/i,
  /uses the standard .+ package/i,
  /cannot be reconstructed safely/i,
  /independent of commercial/i,
];

const SYSTEM_DIAGNOSTIC_PATTERNS = [
  /\bPACKAGE_FALLBACK\b/,
  /\bDETAILED_AUTHORITATIVE\b/,
  /\bDETAILED_COMPONENT_AUTHORITY\b/,
  /\bLEGACY_PACKAGE_AUTHORITY\b/,
  /\bLEGACY_AUTHORITATIVE\b/,
  /\bDETAILED_PHYSICAL_MODEL\b/,
  /\bINSUFFICIENT_PHYSICAL_MODEL\b/,
  /\bTEST_ONLY_NOT_A_QUOTR_BENCHMARK\b/,
];

/** SCREAMING_SNAKE mode/debug identifiers (PACKAGE_FALLBACK, etc.). */
const INTERNAL_MODE_IDENTIFIER = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/;

export function isBoundaryAssumptionCopy(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (GENERAL_ESTIMATE_ASSUMPTIONS.includes(trimmed)) return true;
  return BOUNDARY_COPY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function classifyEstimateAssumptionLine(
  line: string
): EstimateAssumptionPresentationCategory {
  const trimmed = line.trim();
  if (!trimmed || isBoundaryAssumptionCopy(trimmed)) return "boundary";
  if (SYSTEM_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "system_diagnostic";
  }
  if (INTERNAL_MODE_IDENTIFIER.test(trimmed)) return "system_diagnostic";
  if (looksLikeInternalFactKey(trimmed)) return "system_diagnostic";
  if (PACKAGE_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "package_diagnostic";
  }
  return "physical";
}

export function isInternalEstimatorDiagnostic(line: string): boolean {
  const category = classifyEstimateAssumptionLine(line);
  return category === "package_diagnostic" || category === "system_diagnostic";
}

export function isUserFacingEstimateAssumption(line: string): boolean {
  return classifyEstimateAssumptionLine(line) === "physical";
}

export function formatDefaultedFactForBuilder(fact: DefaultedFactEntry): string {
  const label =
    builderFacingFactLabel(fact.key) ??
    (fact.label && !looksLikeInternalFactKey(fact.label) ? fact.label : null);
  if (!label) {
    return "An estimating assumption is being used.";
  }
  const unitSuffix = fact.unit ?? "";
  return `Assumed ${label.toLowerCase()}: ${fact.assumedValue}${unitSuffix}`.trim();
}

function assumptionFingerprint(line: string): string {
  return line
    .toLowerCase()
    .replace(/^assumed\s+/i, "")
    .replace(/\s*—\s*confirm before pricing\.?$/i, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function stringCoveredByFact(line: string, fact: DefaultedFactEntry): boolean {
  const label = fact.label.trim().toLowerCase();
  if (!label || !line.toLowerCase().includes(label)) return false;
  return line.includes(String(fact.assumedValue));
}

function isHighImpactPhysical(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    /^assumed\b/.test(lower) ||
    /unless confirmed/.test(lower) ||
    /demolition|existing .+ removal/.test(lower) ||
    /site access|normal site access/.test(lower) ||
    /waste factor|procurement\/waste/.test(lower) ||
    /board section assumed/.test(lower) ||
    /deck height|step width|tread depth/.test(lower)
  );
}

function impactRank(line: string): number {
  const lower = line.toLowerCase();
  if (isHighImpactPhysical(line)) return 0;
  if (/assume|standard|default|preliminary|unless/.test(lower)) return 1;
  // Long calculator method notes stay available in Builder Review.
  if (line.length > 140) return 4;
  return 2;
}

export function getUserFacingEstimateAssumptions(params: {
  readonly assumptions: readonly string[];
  readonly assumptionMetadata?: AssumptionMetadata | null;
  readonly limit?: number | null;
}): string[] {
  const facts = params.assumptionMetadata?.defaultedFacts ?? [];
  const fromFacts = facts
    .filter((fact) => fact.label?.trim())
    .map(formatDefaultedFactForBuilder)
    .filter((line) => isUserFacingEstimateAssumption(line));

  const fromStrings = params.assumptions
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isUserFacingEstimateAssumption)
    .filter(
      (line) =>
        !facts.some((fact) => stringCoveredByFact(line, fact)) &&
        !fromFacts.some(
          (factLine) =>
            assumptionFingerprint(factLine) === assumptionFingerprint(line)
        )
    );

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const line of [...fromFacts, ...fromStrings]) {
    const key = assumptionFingerprint(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(line);
  }

  const structuredKeys = new Set(fromFacts.map(assumptionFingerprint));
  const ranked = merged.sort((a, b) => {
    const aStructured = structuredKeys.has(assumptionFingerprint(a)) ? 0 : 1;
    const bStructured = structuredKeys.has(assumptionFingerprint(b)) ? 0 : 1;
    return (
      aStructured - bStructured ||
      impactRank(a) - impactRank(b) ||
      a.localeCompare(b)
    );
  });

  if (params.limit == null) return ranked;
  return ranked.slice(0, params.limit);
}
