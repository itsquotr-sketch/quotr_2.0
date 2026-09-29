import {
  formatCompanyAddress,
  formatQuoteDateTime,
  formatRegistrationLines,
  getCompanyDisplayName,
} from "@/lib/quotes/display";
import { formatPricingDate } from "@/lib/pricing/format";
import { resolveDisplayTimezone } from "@/lib/org/timezone";
import type { CompanySettings } from "@/lib/settings/types";

export const VARIATION_MASTER_QUOTE_CLAUSE =
  "This Variation forms part of accepted Quote {quote}, Revision {revision}. Except as expressly changed by this Variation, the terms of trade, conditions, inclusions and exclusions of that accepted Quote remain unchanged and continue to apply.";

export const VARIATION_QUOTE_REFERENCE_UNAVAILABLE =
  "Accepted Quote reference unavailable";

export const VARIATION_IDENTITY_SEND_BLOCK =
  "This Variation can’t be sent until the accepted Quote reference and client name are recorded.";

export function variationMasterQuoteClause(quoteNumber: string, revisionNumber: number): string {
  return VARIATION_MASTER_QUOTE_CLAUSE
    .replace("{quote}", quoteNumber)
    .replace("{revision}", String(revisionNumber));
}

export function presentVariationIssueDate(
  value: string | null | undefined,
  timeZone?: string | null
): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatPricingDate(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: resolveDisplayTimezone(timeZone),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export type VariationDocumentIdentity = {
  companyName: string;
  legalName: string | null;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  registrationLines: string[];
  brandPrimary: string | null;
  clientName: string | null;
  projectTitle: string;
  siteAddress: string | null;
  quoteNumber: string | null;
  quoteRevision: number | null;
  acceptedOnLabel: string | null;
  available: boolean;
  timezone: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseVariationDocumentIdentity(value: unknown): VariationDocumentIdentity | null {
  const row = asRecord(value);
  if (Object.keys(row).length === 0) return null;
  const contractor = asRecord(row.contractor);
  const client = asRecord(row.client);
  const project = asRecord(row.project);
  const quote = asRecord(row.masterQuote);
  const settings: CompanySettings = {
    organisationName: text(contractor.organisationName) ?? "",
    tradingName: text(contractor.tradingName),
    legalName: text(contractor.legalName),
    contactEmail: text(contractor.email),
    contactPhone: text(contractor.phone),
    website: text(contractor.website),
    addressLine1: text(contractor.addressLine1),
    addressLine2: text(contractor.addressLine2),
    city: text(contractor.city),
    region: text(contractor.region),
    timezone: text(contractor.timezone),
    postcode: text(contractor.postcode),
    addressCountry: text(contractor.addressCountry) ?? "New Zealand",
    nzbn: text(contractor.nzbn),
    abn: text(contractor.abn),
    gstNumber: text(contractor.gstNumber),
    defaultGstRate: 15,
    defaultQuoteValidityDays: 30,
    defaultPaymentTerms: null,
    defaultQuoteTerms: null,
    defaultQuoteExclusions: null,
    defaultQuoteAssumptions: null,
    logoUrl: text(contractor.logoUrl),
    brandPrimaryColour: text(contractor.brandPrimaryColour),
    brandAccentColour: text(contractor.brandAccentColour),
    defaultMaterialWastagePercent: 0,
    deckingWastagePercent: null,
    sheetMaterialWastagePercent: null,
    flooringWastagePercent: null,
    paintWastagePercent: null,
    timberFramingWastagePercent: null,
  };
  const quoteNumber = text(quote.quoteNumber);
  const quoteRevision = typeof quote.revisionNumber === "number" ? quote.revisionNumber : Number(quote.revisionNumber);
  const acceptedAt = text(quote.acceptedAt);
  const timezone = settings.timezone;
  return {
    companyName: getCompanyDisplayName(settings),
    legalName: settings.legalName,
    logoUrl: settings.logoUrl,
    email: settings.contactEmail,
    phone: settings.contactPhone,
    website: settings.website,
    address: formatCompanyAddress(settings),
    registrationLines: formatRegistrationLines(settings),
    brandPrimary: settings.brandPrimaryColour,
    clientName: text(client.name),
    projectTitle: text(project.title) ?? "",
    siteAddress: text(project.siteAddress),
    quoteNumber,
    quoteRevision: Number.isFinite(quoteRevision) ? quoteRevision : null,
    acceptedOnLabel: acceptedAt
      ? presentVariationIssueDate(acceptedAt, timezone) ?? formatQuoteDateTime(acceptedAt, timezone ?? undefined)
      : null,
    available: quote.available === true && Boolean(quoteNumber) && Boolean(text(client.name)),
    timezone: timezone ?? null,
  };
}
