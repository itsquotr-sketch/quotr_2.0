import { textListToArray } from "@/lib/pricing/calculations";
import {
  DEFAULT_PAYMENT_TERMS,
  DEFAULT_QUOTE_ASSUMPTIONS,
  DEFAULT_QUOTE_EXCLUSIONS,
  DEFAULT_QUOTE_TERMS,
} from "@/lib/settings/defaults";
import type { OrgQuoteDefaults } from "@/lib/settings/types";

function nonEmptyText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildTermsFromOrgDefaults(
  defaults: OrgQuoteDefaults
): string {
  const quoteTerms =
    nonEmptyText(defaults.defaultQuoteTerms) ?? DEFAULT_QUOTE_TERMS;
  const paymentTerms =
    nonEmptyText(defaults.defaultPaymentTerms) ?? DEFAULT_PAYMENT_TERMS;

  if (quoteTerms.toLowerCase().includes("payment terms")) {
    return quoteTerms;
  }

  return `${quoteTerms}\n\n${paymentTerms}`;
}

export function resolveAssumptionsForSnapshot(
  projectValues: string[],
  defaults: OrgQuoteDefaults
): string[] {
  if (projectValues.length > 0) {
    return projectValues;
  }

  const text =
    nonEmptyText(defaults.defaultQuoteAssumptions) ??
    DEFAULT_QUOTE_ASSUMPTIONS;
  return textListToArray(text);
}

export function resolveExclusionsForSnapshot(
  projectValues: string[],
  defaults: OrgQuoteDefaults
): string[] {
  if (projectValues.length > 0) {
    return projectValues;
  }

  const text =
    nonEmptyText(defaults.defaultQuoteExclusions) ?? DEFAULT_QUOTE_EXCLUSIONS;
  return textListToArray(text);
}

export function resolveTermsForSnapshot(
  existingTerms: string | null | undefined,
  defaults: OrgQuoteDefaults
): string {
  const trimmed = existingTerms?.trim();
  if (trimmed) {
    return trimmed;
  }
  return buildTermsFromOrgDefaults(defaults);
}
