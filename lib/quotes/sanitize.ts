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
  /\bcost\s*rate\b/i,
  /\bsell\s*rate\b/i,
  /\bunit\s*cost\b/i,
  /\bunit\s*sell\b/i,
  /\banthropic\b/i,
  /\bclaude\b/i,
  /\bai\s+generated\b/i,
  /\d+(\.\d+)?\s*(m²|m2|sqm|lm|m)\s*×\s*[\d.]+\s*hrs/i,
  /=\s*[\d.]+\s*hrs\b/i,
  /×\s*\$[\d.]+\/(m²|m2|lm)\s*cost\b/i,
  /\bcarry\s*distance\b/i,
  /\bsite\s*access\s*difficult\b/i,
];

const CALCULATION_FRAGMENT =
  /[\d.]+\s*(m²|m2|sqm|lm|m)\s*×\s*[\d.]+\s*hrs\/(m²|m2|lm)\s*=\s*[\d.]+\s*hrs/gi;

/** Dollar amounts tied to estimating units or cost language — not client quote totals. */
const COST_RATE_PATTERNS: RegExp[] = [
  /\$\s*[\d,]+(?:\.\d+)?\s*\/\s*(?:m²|m2|sqm|lm|m|hr|hour)\b/gi,
  /\$\s*[\d,]+(?:\.\d+)?\s+per\s+(?:m²|m2|sqm|lm|square\s+metre|hour|hr)\b/gi,
  /\$\s*[\d,]+(?:\.\d+)?\s*(?:cost|sell)\b/gi,
  /\b(?:cost|sell)\s*rate\s*[:=]?\s*\$\s*[\d,]+(?:\.\d+)?/gi,
  /\$\s*[\d,]+(?:\.\d+)?\s*×/gi,
  /\bcost\s*[:=]\s*\$\s*[\d,]+(?:\.\d+)?/gi,
];

const SUSPICIOUS_QUOTE_PATTERNS: RegExp[] = [
  /\bbenchmark\b/i,
  /\bmargin\b/i,
  /\bgross\s*profit\b/i,
  /\bproductivity\b/i,
  /\blabour\s*hours?\b/i,
  /\binternal\b/i,
  /\bcost\s*rate\b/i,
  /\bsell\s*rate\b/i,
  /\$\s*[\d,]+(?:\.\d+)?\s*\/\s*(?:m²|m2|hr)\b/i,
  /\bper\s+hour\b/i,
  /\banthropic\b/i,
  /\bclaude\b/i,
];

/**
 * Removes dollar cost/rate patterns from client-facing quote text.
 */
export function stripCostPatterns(text: string): string {
  let result = text;
  for (const pattern of COST_RATE_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result.replace(/\s+/g, " ").replace(/^[·|,\s-]+|[·|,\s-]+$/g, "").trim();
}

export function containsSuspiciousQuoteText(text: string | null | undefined): boolean {
  if (!text?.trim()) {
    return false;
  }
  return SUSPICIOUS_QUOTE_PATTERNS.some((pattern) => pattern.test(text));
}

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
  result = stripCostPatterns(result);

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

/**
 * Sanitises client-facing quote labels.
 */
export function sanitizeClientQuoteLabel(label: string | null | undefined): string {
  if (!label?.trim()) {
    return "Item";
  }

  let result = label.trim();
  result = stripCostPatterns(result);

  const segments = result
    .split(/[·|]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !isInternalDescriptionSegment(segment));

  const cleaned = segments.join(" · ").replace(/\s+/g, " ").trim();
  return cleaned || "Item";
}

function isInternalDescriptionSegment(segment: string): boolean {
  return INTERNAL_SEGMENT_PATTERNS.some((pattern) => pattern.test(segment));
}
