/**
 * BETA-2.1 — Estimate confidence presentation only.
 * Does not change persisted assumptions, confidence %, or estimator output.
 */
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import {
  estimatingAssumptionsForDisplay,
  type QuickEstimateConfidenceBand,
} from "@/lib/assistant/presentation/quick-estimate-confidence";

const GENERIC_CONFIDENCE_FALLBACK =
  "Based on the job information currently available.";

/**
 * Prefer structured defaulted-fact metadata, then the first genuine
 * estimating assumption. Never invent an assumption.
 */
export function selectEstimatingAssumptionPhrase(
  assumptions: readonly string[],
  metadata?: AssumptionMetadata | null
): string | null {
  const fact = metadata?.defaultedFacts.find((entry) => entry.label?.trim());
  if (fact) {
    return fact.label.trim().replace(/\.$/, "");
  }
  const line = estimatingAssumptionsForDisplay(assumptions)[0];
  if (!line) return null;
  return line.replace(/^Assumed\s+/i, "").replace(/\.$/, "").trim() || null;
}

export function presentEstimateConfidenceCopy(params: {
  band: QuickEstimateConfidenceBand;
  assumptionPhrase: string | null;
}): { band: QuickEstimateConfidenceBand; explanation: string } {
  if (params.band === "High") {
    return { band: params.band, explanation: "Most key job details are known." };
  }
  if (params.band === "Low") {
    return {
      band: params.band,
      explanation: "Several important job details are still based on assumptions.",
    };
  }
  if (params.assumptionPhrase) {
    return {
      band: params.band,
      explanation: `Quotr has made a few assumptions, including ${params.assumptionPhrase}.`,
    };
  }
  return { band: params.band, explanation: GENERIC_CONFIDENCE_FALLBACK };
}
