/**
 * BETA-2.1 / BETA-2.2 — Estimate confidence presentation only.
 * Does not change persisted assumptions, confidence %, or estimator output.
 */
import type { AssumptionMetadata } from "@/lib/estimate/assumption-metadata";
import type { QuickEstimateConfidenceBand } from "@/lib/assistant/presentation/quick-estimate-confidence";
import { getUserFacingEstimateAssumptions } from "@/lib/assistant/presentation/user-facing-estimate-assumptions";

const GENERIC_CONFIDENCE_FALLBACK =
  "Based on the job information currently available.";

const MAX_CONFIDENCE_PHRASE_CHARS = 90;

function phraseFromLine(line: string): string | null {
  const cleaned = line.replace(/^Assumed\s+/i, "").replace(/\.$/, "").trim();
  if (!cleaned || cleaned.length > MAX_CONFIDENCE_PHRASE_CHARS) return null;
  return cleaned;
}

/**
 * Prefer structured defaulted-fact metadata, then the first genuine
 * builder-facing estimating assumption. Never invent an assumption.
 * Never use first persisted diagnostic/boundary copy.
 */
export function selectEstimatingAssumptionPhrase(
  assumptions: readonly string[],
  metadata?: AssumptionMetadata | null
): string | null {
  const fact = metadata?.defaultedFacts.find((entry) => entry.label?.trim());
  if (fact) {
    return fact.label.trim().replace(/\.$/, "");
  }
  const visible = getUserFacingEstimateAssumptions({
    assumptions,
    assumptionMetadata: metadata,
    limit: 5,
  });
  for (const line of visible) {
    const phrase = phraseFromLine(line);
    if (phrase) return phrase;
  }
  return null;
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
