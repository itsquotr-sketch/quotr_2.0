export const SUBCONTRACTOR_PRICING_METHODS = [
  "hourly",
  "fixed",
  "unit_rate",
  "schedule_of_rates",
  "quoted",
] as const;

export type SubcontractorPricingMethod =
  (typeof SUBCONTRACTOR_PRICING_METHODS)[number];

export const SUBCONTRACTOR_PRICING_LABELS: Record<
  SubcontractorPricingMethod,
  string
> = {
  hourly: "Hourly",
  fixed: "Fixed price",
  unit_rate: "Unit rate",
  schedule_of_rates: "Schedule of rates",
  quoted: "Quoted per job",
};

export const PREFERRED_CONTACT_METHODS = ["email", "phone", "either"] as const;

export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHODS)[number];

export const DOCUMENT_KINDS = [
  "licence",
  "insurance",
  "capability_statement",
  "rate_schedule",
  "other",
] as const;

export type SubcontractorDocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<SubcontractorDocumentKind, string> = {
  licence: "Licence",
  insurance: "Insurance",
  capability_statement: "Capability statement",
  rate_schedule: "Rate schedule",
  other: "Other",
};

export const GST_REGISTRATIONS = ["yes", "no", "unknown"] as const;

export type GstRegistration = (typeof GST_REGISTRATIONS)[number];

export const SUBCONTRACTOR_COUNTRY_CODES = ["NZ", "AU"] as const;

export type SubcontractorCountryCode = (typeof SUBCONTRACTOR_COUNTRY_CODES)[number];

export const SUBCONTRACTOR_COUNTRY_LABELS: Record<SubcontractorCountryCode, string> = {
  NZ: "New Zealand",
  AU: "Australia",
};

export type SubcontractorContact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  preferred_contact: PreferredContactMethod | null;
};

export type SubcontractorDocument = {
  id: string;
  document_kind: SubcontractorDocumentKind;
  title: string;
  reference: string | null;
  expires_on: string | null;
  notes: string | null;
  original_filename: string | null;
  upload_status: "pending" | "ready" | "failed" | null;
};

export type Subcontractor = {
  id: string;
  trading_name: string;
  legal_name: string | null;
  website: string | null;
  country: string | null;
  country_code: SubcontractorCountryCode | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_city: string | null;
  address_region: string | null;
  address_postcode: string | null;
  service_regions: string[];
  service_region_other_labels: string[];
  work_area_types: string[];
  specialties: string | null;
  internal_notes: string | null;
  preferred_pricing_method: SubcontractorPricingMethod | null;
  currency: string | null;
  abn: string | null;
  nzbn: string | null;
  gst_registration: GstRegistration | null;
  gst_number: string | null;
  minimum_charge_notes: string | null;
  travel_notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  contacts: SubcontractorContact[];
  documents: SubcontractorDocument[];
};

export type SubcontractorActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  id?: string;
};
