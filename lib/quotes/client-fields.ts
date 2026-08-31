import { filterClientFacingNarrative } from "@/lib/quotes/client-narrative";
import {
  resolveAssumptionsForSnapshot,
  resolveExclusionsForSnapshot,
  resolveTermsForSnapshot,
} from "@/lib/settings/snapshot";
import type { OrgQuoteDefaults } from "@/lib/settings/types";

/**
 * STRUCTURAL client-field authority for Quote snapshots.
 *
 * Client Quote may only be seeded from builder-owned Pricing client fields
 * or organisation quote defaults. Estimate narrative is not a client source.
 *
 * Phrase / regex filtering in client-narrative.ts is a last defensive guard
 * on those already-client fields — not the primary boundary.
 */
export function resolveClientQuoteAssumptions(input: {
  pricingClientAssumptions: readonly string[];
  orgDefaults: OrgQuoteDefaults;
}): string[] {
  return filterClientFacingNarrative(
    resolveAssumptionsForSnapshot(
      [...input.pricingClientAssumptions],
      input.orgDefaults
    )
  );
}

export function resolveClientQuoteExclusions(input: {
  pricingClientExclusions: readonly string[];
  orgDefaults: OrgQuoteDefaults;
}): string[] {
  return filterClientFacingNarrative(
    resolveExclusionsForSnapshot(
      [...input.pricingClientExclusions],
      input.orgDefaults
    )
  );
}

export function resolveClientQuoteTerms(input: {
  pricingClientTerms: string | null | undefined;
  orgDefaults: OrgQuoteDefaults;
}): string {
  return resolveTermsForSnapshot(input.pricingClientTerms, input.orgDefaults);
}

export function formatEstimateNarrativeForInternalNotes(input: {
  assumptions: readonly string[];
  exclusions: readonly string[];
}): string | null {
  const parts: string[] = [];
  if (input.assumptions.length > 0) {
    parts.push(
      [
        "Estimate assumptions (internal — not client Quote copy):",
        ...input.assumptions.map((line) => `- ${line}`),
      ].join("\n")
    );
  }
  if (input.exclusions.length > 0) {
    parts.push(
      [
        "Estimate exclusions (internal — not client Quote copy):",
        ...input.exclusions.map((line) => `- ${line}`),
      ].join("\n")
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}
