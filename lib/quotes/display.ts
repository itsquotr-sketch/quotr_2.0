import type { CompanySettings } from "@/lib/settings/types";

export function getCompanyDisplayName(
  settings: CompanySettings | null
): string {
  if (!settings) return "";
  return (
    settings.tradingName?.trim() ||
    settings.legalName?.trim() ||
    settings.organisationName
  );
}

export function formatCompanyAddress(
  settings: CompanySettings
): string | null {
  const cityRegion = [settings.city, settings.region]
    .filter((part) => part?.trim())
    .join(", ");

  const parts = [
    settings.addressLine1?.trim(),
    settings.addressLine2?.trim(),
    cityRegion || null,
    settings.postcode?.trim(),
    settings.addressCountry !== "New Zealand"
      ? settings.addressCountry
      : null,
  ].filter(Boolean) as string[];

  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatQuoteDocumentTitle(quote: {
  title: string;
  quote_number: string | null;
}): string {
  if (quote.quote_number?.trim()) {
    return `Quote ${quote.quote_number}`;
  }
  return `Quote — ${quote.title}`;
}
