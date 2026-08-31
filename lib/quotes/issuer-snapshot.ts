import type { Quote, QuoteIssuerSnapshot } from "@/lib/quotes/types";
import type { CompanySettings } from "@/lib/settings/types";

export function captureQuoteIssuerSnapshot(
  settings: CompanySettings | null
): QuoteIssuerSnapshot | null {
  if (!settings) return null;
  return {
    organisationName: settings.organisationName,
    tradingName: settings.tradingName,
    legalName: settings.legalName,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    website: settings.website,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    city: settings.city,
    region: settings.region,
    postcode: settings.postcode,
    addressCountry: settings.addressCountry,
    nzbn: settings.nzbn,
    gstNumber: settings.gstNumber,
    logoUrl: settings.logoUrl,
    brandPrimaryColour: settings.brandPrimaryColour,
    brandAccentColour: settings.brandAccentColour,
    defaultPaymentTerms: settings.defaultPaymentTerms,
    source: "send",
  };
}

export function parseQuoteIssuerSnapshot(
  value: unknown
): QuoteIssuerSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const organisationName =
    typeof row.organisationName === "string" ? row.organisationName : "";
  if (!organisationName.trim() && typeof row.legalName !== "string") {
    return null;
  }
  const text = (key: string): string | null =>
    typeof row[key] === "string" ? (row[key] as string) : null;

  return {
    organisationName,
    tradingName: text("tradingName"),
    legalName: text("legalName"),
    contactEmail: text("contactEmail"),
    contactPhone: text("contactPhone"),
    website: text("website"),
    addressLine1: text("addressLine1"),
    addressLine2: text("addressLine2"),
    city: text("city"),
    region: text("region"),
    postcode: text("postcode"),
    addressCountry:
      typeof row.addressCountry === "string" && row.addressCountry.trim()
        ? row.addressCountry
        : "New Zealand",
    nzbn: text("nzbn"),
    gstNumber: text("gstNumber"),
    logoUrl: text("logoUrl"),
    brandPrimaryColour: text("brandPrimaryColour"),
    brandAccentColour: text("brandAccentColour"),
    defaultPaymentTerms: text("defaultPaymentTerms"),
    source:
      row.source === "migration_041_current_org" || row.source === "send"
        ? row.source
        : undefined,
  };
}

/**
 * Sent revisions render from issuer_snapshot. Drafts and pre-041 historical
 * rows fall back to live Company settings (documented LIVE/UNSAFE gap).
 */
export function resolveQuoteIssuerSettings(
  quote: Pick<Quote, "issuer_snapshot">,
  liveSettings: CompanySettings | null
): CompanySettings | null {
  const snapshot = quote.issuer_snapshot;
  if (!snapshot) return liveSettings;
  return {
    organisationName: snapshot.organisationName,
    tradingName: snapshot.tradingName,
    legalName: snapshot.legalName,
    contactEmail: snapshot.contactEmail,
    contactPhone: snapshot.contactPhone,
    website: snapshot.website,
    addressLine1: snapshot.addressLine1,
    addressLine2: snapshot.addressLine2,
    city: snapshot.city,
    region: snapshot.region,
    postcode: snapshot.postcode,
    addressCountry: snapshot.addressCountry,
    nzbn: snapshot.nzbn,
    gstNumber: snapshot.gstNumber,
    defaultGstRate: liveSettings?.defaultGstRate ?? 15,
    defaultQuoteValidityDays: liveSettings?.defaultQuoteValidityDays ?? 30,
    defaultPaymentTerms: snapshot.defaultPaymentTerms,
    defaultQuoteTerms: liveSettings?.defaultQuoteTerms ?? null,
    defaultQuoteExclusions: liveSettings?.defaultQuoteExclusions ?? null,
    defaultQuoteAssumptions: liveSettings?.defaultQuoteAssumptions ?? null,
    logoUrl: snapshot.logoUrl,
    brandPrimaryColour: snapshot.brandPrimaryColour,
    brandAccentColour: snapshot.brandAccentColour,
    defaultMaterialWastagePercent:
      liveSettings?.defaultMaterialWastagePercent ?? 0,
    deckingWastagePercent: liveSettings?.deckingWastagePercent ?? null,
    sheetMaterialWastagePercent:
      liveSettings?.sheetMaterialWastagePercent ?? null,
    flooringWastagePercent: liveSettings?.flooringWastagePercent ?? null,
    paintWastagePercent: liveSettings?.paintWastagePercent ?? null,
    timberFramingWastagePercent:
      liveSettings?.timberFramingWastagePercent ?? null,
  };
}
