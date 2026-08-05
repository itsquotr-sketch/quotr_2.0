import type { ConfidenceBand } from "./types";

/** Inclusive ranges for band consistency checks. */
export const CONFIDENCE_BAND_RANGES: Readonly<
  Record<ConfidenceBand, { readonly min: number; readonly max: number }>
> = Object.freeze({
  HIGH: Object.freeze({ min: 0.75, max: 1 }),
  MEDIUM: Object.freeze({ min: 0.4, max: 0.749999 }),
  LOW: Object.freeze({ min: 0, max: 0.399999 }),
});

export function bandForConfidence(confidence: number): ConfidenceBand {
  if (confidence >= 0.75) return "HIGH";
  if (confidence >= 0.4) return "MEDIUM";
  return "LOW";
}

export function isConfidenceInBand(
  confidence: number,
  band: ConfidenceBand
): boolean {
  const range = CONFIDENCE_BAND_RANGES[band];
  return confidence >= range.min && confidence <= range.max;
}
