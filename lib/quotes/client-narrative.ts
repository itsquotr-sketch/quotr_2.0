import { sanitizeClientQuoteDescription } from "@/lib/quotes/sanitize";

/**
 * Last-guard client-facing narrative filter.
 *
 * Primary client safety is STRUCTURAL: Quote renders builder-owned client
 * fields (client_description, work-area quote_description, quote assumptions /
 * exclusions / terms / notes_to_client) that were never seeded from Estimate
 * narrative. See lib/quotes/client-fields.ts.
 *
 * These helpers never change commercial arithmetic. They must not be treated
 * as the primary client-data boundary.
 */

const KNOWN_INTERNAL_ESTIMATE_ASSUMPTIONS = [
  "This is an internal working estimate, not a client quote.",
  "Pricing includes overhead and margin allowance.",
];

const CLIENT_SAFE_GENERAL_ASSUMPTIONS = new Set([
  "final selections may affect price.",
]);

const INTERNAL_NARRATIVE_PATTERNS: RegExp[] = [
  /\binternal working estimate\b/i,
  /\bnot a client quote\b/i,
  /\boverhead and margin\b/i,
  /\bDETAILED_AUTHORITY\b/i,
  /\brate[- ]resolution\b/i,
  /\brequirement[- ]engine\b/i,
  /\brequirement\s*id\b/i,
  /\bproductivity\b/i,
  /\bgross\s+margin\b/i,
  /\bgross\s+profit\b/i,
  /\bmarkup\b/i,
  /\bcost[- ]first\b/i,
  /\bbenchmark\b/i,
  /\bhrs\/(?:lm|m²|m2|m)\b/i,
  /\bperson-hours?\b/i,
  /\blabour hours?\b/i,
  /\bsell authority\b/i,
  /\blegacy_paired_rate\b/i,
  /\bderived_from_gross_margin\b/i,
  /\bexplicit_sell_override\b/i,
  /\b__quotr_meta__\b/i,
  /\bpricing required\b/i,
  /\bcarry distance\b/i,
  /physical driver\s*:/i,
  /\brequired quantity\b/i,
  /\bpurchased quantity\b/i,
];

function normalizeNarrative(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function isInternalClientNarrative(
  text: string | null | undefined
): boolean {
  const normalized = normalizeNarrative(text ?? "");
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (CLIENT_SAFE_GENERAL_ASSUMPTIONS.has(lower)) {
    return false;
  }

  for (const assumption of KNOWN_INTERNAL_ESTIMATE_ASSUMPTIONS) {
    if (assumption.toLowerCase() === lower) {
      return true;
    }
  }

  return INTERNAL_NARRATIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function filterClientFacingNarrative(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const trimmed = normalizeNarrative(item);
    if (!trimmed || isInternalClientNarrative(trimmed)) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function partitionClientNarrative(items: string[]): {
  client: string[];
  internal: string[];
} {
  const client: string[] = [];
  const internal: string[] = [];

  for (const item of items) {
    const trimmed = normalizeNarrative(item);
    if (!trimmed) {
      continue;
    }
    if (isInternalClientNarrative(trimmed)) {
      internal.push(trimmed);
    } else {
      client.push(trimmed);
    }
  }

  return { client, internal };
}

/**
 * Sanitises a free-text block (scope, terms, notes, section description)
 * without inventing replacement copy.
 */
export function sanitizeClientNarrativeBlock(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) {
    return null;
  }

  const lines = text
    .split(/\n+/)
    .map((line) => {
      const sentences = line
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => normalizeNarrative(sentence))
        .filter((sentence) => sentence.length > 0 && !isInternalClientNarrative(sentence));
      return sentences.join(" ").trim();
    })
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const joined = lines.join("\n");
  return sanitizeClientQuoteDescription(joined) ?? joined;
}

/**
 * Display-only sanitiser that keeps builder paragraph breaks and blank lines.
 * Does not rewrite scope copy. Used by QuoteTemplate, not snapshot writes.
 */
export function sanitizeClientNarrativeDisplay(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) {
    return null;
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n").map((line) => {
    if (!line.trim()) {
      return "";
    }
    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(
        (sentence) =>
          sentence.length > 0 && !isInternalClientNarrative(sentence)
      );
    if (sentences.length === 0) {
      return "";
    }
    const joined = sentences.join(" ");
    return sanitizeClientQuoteDescription(joined) ?? joined;
  });

  const result = lines.join("\n").replace(/^\n+|\n+$/g, "");
  return result.trim() ? result : null;
}

export function filterInternalLinesFromBlock(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) {
    return null;
  }

  const next = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      return !isInternalClientNarrative(line);
    })
    .join("\n")
    .trim();

  return next || null;
}
