import type { CompanySettings } from "@/lib/settings/types";

export function stripLeadingQuotePrefix(value: string): string {
  return value.replace(/^quote\s*[—–:\-]\s*/i, "").trim();
}

export function formatQuoteReference(quote: {
  title: string;
  quote_number: string | null;
}): string {
  if (quote.quote_number?.trim()) {
    return quote.quote_number.trim();
  }
  const stripped = stripLeadingQuotePrefix(quote.title);
  return stripped || quote.title;
}

export function getQuoteCurrency(
  settings: CompanySettings | null
): "NZD" | "AUD" | null {
  const country = settings?.addressCountry?.trim().toLowerCase();
  if (!country) return null;
  if (country === "new zealand" || country === "nz") return "NZD";
  if (country === "australia" || country === "au") return "AUD";
  return null;
}

export function formatGstTreatmentNote(
  settings: CompanySettings | null
): string {
  const currency = getQuoteCurrency(settings);
  const currencyPart = currency ? ` in ${currency}` : "";
  return `All amounts${currencyPart} are GST exclusive unless stated otherwise.`;
}

export function formatRegistrationLines(
  settings: CompanySettings | null
): string[] {
  if (!settings) return [];

  const country = settings.addressCountry?.trim().toLowerCase();
  const lines: string[] = [];

  if (settings.gstNumber?.trim()) {
    lines.push(`GST ${settings.gstNumber.trim()}`);
  }
  if (settings.nzbn?.trim()) {
    if (country === "australia" || country === "au") {
      lines.push(`ABN ${settings.nzbn.trim()}`);
    } else {
      lines.push(`NZBN ${settings.nzbn.trim()}`);
    }
  }

  return lines;
}

export const DEFAULT_VARIATION_WORDING =
  "Variations to the agreed scope of work will be quoted separately and must be approved in writing before commencement.";


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
  return `Quote: ${formatQuoteReference(quote)}`;
}

export function formatQuoteWorkspaceTitle(title: string): string {
  const stripped = stripLeadingQuotePrefix(title);
  return stripped ? `Quote — ${stripped}` : "Quote";
}

export function formatQuoteNumberRevision(quote: {
  quote_number: string | null;
  revision_number: number;
}): string {
  const number = quote.quote_number?.trim();
  if (number) {
    return `${number} · Revision ${quote.revision_number}`;
  }
  return `Revision ${quote.revision_number}`;
}

export function formatQuoteDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
