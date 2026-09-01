import {
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_TERMS,
} from "@/lib/settings/defaults";

function normalizeBlock(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripMatchingParagraph(haystack: string, needle: string): string {
  const needleNorm = normalizeBlock(needle);
  const kept = splitParagraphs(haystack).filter(
    (part) => normalizeBlock(part) !== needleNorm
  );
  if (kept.length === splitParagraphs(haystack).length) {
    return haystack.trim();
  }
  return kept.join("\n\n").trim();
}

function containsBlock(haystack: string, needle: string): boolean {
  return normalizeBlock(haystack).includes(normalizeBlock(needle));
}

/**
 * Quote terms snapshots often concatenate org payment terms into `quote.terms`.
 * The document also renders a dedicated Payment terms section from the issuer
 * snapshot. Strip only exact system/default duplicates — never distinct
 * builder-authored clauses.
 */
export function resolveClientFacingTermsSections(input: {
  quoteTerms: string | null | undefined;
  issuerPaymentTerms: string | null | undefined;
  hasValiditySection: boolean;
}): {
  paymentTerms: string | null;
  terms: string | null;
} {
  const issuerPayment = input.issuerPaymentTerms?.trim() || null;
  let terms = input.quoteTerms?.trim() || null;
  let paymentTerms = issuerPayment;

  if (terms && issuerPayment && containsBlock(terms, issuerPayment)) {
    terms = stripMatchingParagraph(terms, issuerPayment) || null;
    paymentTerms = issuerPayment;
  } else if (terms && containsBlock(terms, DEFAULT_PAYMENT_TERMS)) {
    terms = stripMatchingParagraph(terms, DEFAULT_PAYMENT_TERMS) || null;
    paymentTerms = paymentTerms ?? DEFAULT_PAYMENT_TERMS;
  }

  if (
    terms &&
    normalizeBlock(terms) === normalizeBlock(DEFAULT_QUOTE_TERMS) &&
    input.hasValiditySection
  ) {
    terms = null;
  }

  return {
    paymentTerms,
    terms: terms?.trim() || null,
  };
}
