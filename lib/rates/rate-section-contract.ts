/**
 * DECK-MATURITY-2D — semantic Rates section membership.
 *
 * A rate row belongs to exactly one contractor-facing Rates section.
 * Filter by rate_type (and labour $/hr), never by hiding named Deck keys.
 */

export type RatesSemanticSection = "material" | "labour" | "productivity";

export function isProductivityRateType(rateType: string): boolean {
  return rateType === "productivity";
}

export function isLabourHourRateType(rateType: string): boolean {
  return rateType === "labour";
}

export function isMaterialCommercialRateType(rateType: string): boolean {
  return (
    rateType === "material" ||
    rateType === "package" ||
    rateType === "allowance" ||
    rateType === "scope" ||
    rateType === "subcontractor"
  );
}

export function ratesSemanticSectionForRateType(
  rateType: string
): RatesSemanticSection | null {
  if (isProductivityRateType(rateType)) return "productivity";
  if (isLabourHourRateType(rateType)) return "labour";
  if (isMaterialCommercialRateType(rateType)) return "material";
  return null;
}

export function isMaterialRatesCatalogueEntry(entry: {
  rate_type: string;
}): boolean {
  return isMaterialCommercialRateType(entry.rate_type);
}

export function isProductivityRatesCatalogueEntry(entry: {
  rate_type: string;
}): boolean {
  return isProductivityRateType(entry.rate_type);
}

export function isLabourHourRatesCatalogueEntry(entry: {
  rate_type: string;
}): boolean {
  return isLabourHourRateType(entry.rate_type);
}

export function catalogueEntriesForRatesSection<
  T extends { rate_type: string },
>(entries: readonly T[], section: RatesSemanticSection): T[] {
  return entries.filter(
    (entry) => ratesSemanticSectionForRateType(entry.rate_type) === section
  );
}
