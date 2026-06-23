const INTERNAL_SEGMENT_PATTERNS = [
  /\bproductivity\b/i,
  /\bhrs\/m[²2]/i,
  /\bhrs\/lm\b/i,
  /\blabour\s*hours?\b/i,
  /\brate\s*source\b/i,
  /\ballowance\s*source\b/i,
  /\bbenchmark\b/i,
  /\bgross\s*profit\b/i,
  /\bmarkup\b/i,
  /\bmargin\b/i,
  /\binternal\b/i,
  /\d+(\.\d+)?\s*(m²|m2|sqm|lm|m)\s*×\s*[\d.]+\s*hrs/i,
  /=\s*[\d.]+\s*hrs\b/i,
  /×\s*\$[\d.]+\/(m²|m2|lm)\s*cost\b/i,
  /\bcarry\s*distance\b/i,
  /\bsite\s*access\s*difficult\b/i,
];

const CALCULATION_FRAGMENT =
  /[\d.]+\s*(m²|m2|sqm|lm|m)\s*×\s*[\d.]+\s*hrs\/(m²|m2|lm)\s*=\s*[\d.]+\s*hrs/gi;

/**
 * Removes internal estimating language from client-facing quote descriptions.
 * Returns null when nothing client-safe remains.
 */
export function sanitizeClientQuoteDescription(
  description: string | null | undefined
): string | null {
  if (!description?.trim()) {
    return null;
  }

  let result = description.trim();
  result = result.replace(CALCULATION_FRAGMENT, "");
  result = result.replace(/productivity[:\s]*[\d.]+\s*hrs\/(m²|m2|lm)/gi, "");
  result = result.replace(/productivity[:\s]*[\d.]+/gi, "");

  const segments = result
    .split(/[·|]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !isInternalDescriptionSegment(segment));

  if (segments.length === 0) {
    return null;
  }

  return segments.join(" · ").replace(/\s+/g, " ").trim() || null;
}

function isInternalDescriptionSegment(segment: string): boolean {
  return INTERNAL_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment));
}
