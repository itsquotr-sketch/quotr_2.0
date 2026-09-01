import { sanitizeClientQuoteDescription } from "@/lib/quotes/sanitize";

/**
 * STRUCTURAL client line-description authority.
 *
 * Intentional client copy (Pricing client_description / notes_client) may
 * render. Estimator diagnostic notes, calculation-detail formatter output,
 * metadata and physical-driver build-ups must never become client content
 * merely because a regex did not match a phrase.
 *
 * Phrase sanitisation remains a last guard after this classifier.
 */

const CALCULATION_DETAIL_LABELS =
  /(?:^|\n)\s*(?:required quantity|purchased quantity|installed quantity|calculated labour|labour rate|rate source|gross margin|unit cost|productivity)\s*:/i;

const DIAGNOSTIC_MARKERS: RegExp[] = [
  /physical driver\s*:/i,
  CALCULATION_DETAIL_LABELS,
  /\brequired quantity\b/i,
  /\bpurchased quantity\b/i,
  /\bcalculated labour\b/i,
  /\bperson-hours?\s*\//i,
  /\b__quotr_meta__\b/i,
  /\brate source\b/i,
  /\bgross margin\b/i,
  /\blabour rate\b/i,
  /\bunit cost\b/i,
  /\bhrs\/(?:lm|m²|m2|m|ea|bag|post|section)\b/i,
  /\bwaste\s+\d+(?:\.\d+)?\s*%/i,
  /^waste\s*:/im,
  /\bno project condition adjustment\b/i,
  /\baccess\/carry\b/i,
];

export function isEstimatorDiagnosticDescription(
  text: string | null | undefined
): boolean {
  const value = text?.trim();
  if (!value) return false;
  return DIAGNOSTIC_MARKERS.some((pattern) => pattern.test(value));
}

/**
 * Render/snapshot helper: keep intentional client copy, otherwise label only.
 */
export function clientSafeQuoteLineDescription(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) return null;
  if (isEstimatorDiagnosticDescription(description)) return null;
  return sanitizeClientQuoteDescription(description);
}
