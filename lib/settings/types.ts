export type CompanySettings = {
  organisationName: string;
  tradingName: string | null;
  legalName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  addressCountry: string;
  nzbn: string | null;
  gstNumber: string | null;
  defaultGstRate: number;
  defaultQuoteValidityDays: number;
  defaultPaymentTerms: string | null;
  defaultQuoteTerms: string | null;
  defaultQuoteExclusions: string | null;
  defaultQuoteAssumptions: string | null;
  logoUrl: string | null;
  brandPrimaryColour: string | null;
  brandAccentColour: string | null;
};

export type CompanySettingsInput = {
  tradingName?: string;
  legalName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  addressCountry?: string;
  nzbn?: string;
  gstNumber?: string;
  defaultGstRate?: number;
  defaultQuoteValidityDays?: number;
  defaultPaymentTerms?: string;
  defaultQuoteTerms?: string;
  defaultQuoteExclusions?: string;
  defaultQuoteAssumptions?: string;
  logoUrl?: string;
  brandPrimaryColour?: string;
  brandAccentColour?: string;
};

export type CompanySettingsActionResult = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  settings?: CompanySettings;
};

/** Subset loaded when snapshotting pricing/quote defaults — not full company profile. */
export type OrgQuoteDefaults = {
  defaultGstRate: number;
  defaultQuoteValidityDays: number;
  defaultPaymentTerms: string | null;
  defaultQuoteTerms: string | null;
  defaultQuoteExclusions: string | null;
  defaultQuoteAssumptions: string | null;
};
