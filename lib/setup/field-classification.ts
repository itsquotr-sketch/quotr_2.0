/**
 * Canonical classification of company/setup fields for Stage 3.1C.3.
 * Derived from existing schema — no invented mandatory fields.
 */

export type SetupFieldClass =
  | "REQUIRED_BEFORE_FIRST_PROJECT"
  | "RECOMMENDED_BEFORE_FIRST_ESTIMATE"
  | "RECOMMENDED_BEFORE_FINAL_PRICING"
  | "REQUIRED_BEFORE_ISSUING_QUOTE"
  | "OPTIONAL_LATER";

export type ClassifiedSetupField = {
  id: string;
  label: string;
  source:
    | "organisations"
    | "organisation_settings"
    | "rates"
    | "organisation_work_areas";
  classification: SetupFieldClass;
  notes: string;
};

/**
 * Every relevant company/setup field currently in the product, classified.
 * Account/profile fields are intentionally excluded (Profile surface).
 */
export const COMPANY_SETUP_FIELD_CLASSIFICATION: readonly ClassifiedSetupField[] =
  [
    {
      id: "organisations.name",
      label: "Company name",
      source: "organisations",
      classification: "REQUIRED_BEFORE_FIRST_PROJECT",
      notes: "Set at signup / setup-required provisioning; never blank for a valid org.",
    },
    {
      id: "organisation_settings.currency",
      label: "Currency",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_FIRST_PROJECT",
      notes: "DB default NZD; confirmed on first-run company basics.",
    },
    {
      id: "organisation_settings.country",
      label: "Country / region context",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_FIRST_PROJECT",
      notes: "ISO country (default NZ); region optional refinement.",
    },
    {
      id: "organisation_settings.region",
      label: "Region",
      source: "organisation_settings",
      classification: "RECOMMENDED_BEFORE_FIRST_ESTIMATE",
      notes: "Optional; improves local rate context when present.",
    },
    {
      id: "organisation_settings.timezone",
      label: "Timezone",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_FIRST_PROJECT",
      notes:
        "IANA identifier required on new first-run. Existing NULL uses Auckland display fallback and is not a gate.",
    },
    {
      id: "organisation_settings.default_gst_rate",
      label: "Default GST / tax rate",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_FIRST_PROJECT",
      notes: "DB/app default 15%; confirmed on first-run; used for pricing/quotes.",
    },
    {
      id: "organisation_settings.default_margin_percent",
      label: "Default gross margin",
      source: "organisation_settings",
      classification: "RECOMMENDED_BEFORE_FINAL_PRICING",
      notes: "App/DB default 20% (max 95%); transparent fallback if unset.",
    },
    {
      id: "organisation_settings.default_contingency_percent",
      label: "Default contingency",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Default 10%; not required for first estimate.",
    },
    {
      id: "rates.labour.carpenter",
      label: "Builder / carpenter hourly rate",
      source: "rates",
      classification: "RECOMMENDED_BEFORE_FIRST_ESTIMATE",
      notes: "Estimates may use benchmarks when allow_benchmark_rates; warn when missing.",
    },
    {
      id: "rates.labour.other",
      label: "Other labour / trade rates",
      source: "rates",
      classification: "OPTIONAL_LATER",
      notes: "Not required before first estimate.",
    },
    {
      id: "rates.material",
      label: "Material rates",
      source: "rates",
      classification: "OPTIONAL_LATER",
      notes: "Can be entered at pricing time.",
    },
    {
      id: "organisation_work_areas",
      label: "Preferred work types",
      source: "organisation_work_areas",
      classification: "OPTIONAL_LATER",
      notes:
        "Company preference for personalisation only. Full SCOPE_CATALOGUE remains Analyse Job / confirmation capability.",
    },
    {
      id: "organisation_settings.trading_name",
      label: "Trading name",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_ISSUING_QUOTE",
      notes: "Falls back to organisations.name when blank.",
    },
    {
      id: "organisation_settings.contact_email",
      label: "Company contact email",
      source: "organisation_settings",
      classification: "REQUIRED_BEFORE_ISSUING_QUOTE",
      notes: "Required before Mark sent / issue; drafting allowed without it.",
    },
    {
      id: "organisation_settings.contact_phone",
      label: "Company phone",
      source: "organisation_settings",
      classification: "RECOMMENDED_BEFORE_FINAL_PRICING",
      notes: "Recommended on quotes; email alone can satisfy issue contact.",
    },
    {
      id: "organisation_settings.address",
      label: "Company address",
      source: "organisation_settings",
      classification: "RECOMMENDED_BEFORE_FINAL_PRICING",
      notes: "Recommended before professional issue; not required to draft.",
    },
    {
      id: "organisation_settings.default_payment_terms",
      label: "Payment terms",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "App defaults exist; defer until quote polish.",
    },
    {
      id: "organisation_settings.default_quote_terms",
      label: "Quote terms / exclusions / assumptions",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Defer until quote; boilerplate defaults available.",
    },
    {
      id: "organisation_settings.logo_url",
      label: "Logo / branding colours",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Skip freely.",
    },
    {
      id: "organisation_settings.gst_number",
      label: "GST number / NZBN",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Registration display on quotes; not a hard gate.",
    },
    {
      id: "organisation_settings.wastage",
      label: "Material wastage defaults",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Defaults exist (10%).",
    },
    {
      id: "organisation_settings.rate_factors",
      label: "Budget / premium rate factors",
      source: "organisation_settings",
      classification: "OPTIONAL_LATER",
      notes: "Defaults 0.9 / 1.15.",
    },
  ] as const;

export const SKIP_DEFER_RULES = [
  {
    id: "logo",
    mayDefer: true,
    rule: "Logo and brand colours may be skipped until quote polish.",
  },
  {
    id: "quote_terms",
    mayDefer: true,
    rule: "Quote/payment terms may be skipped until issuing; app boilerplate applies.",
  },
  {
    id: "rates",
    mayDefer: true,
    rule: "Rates may be deferred when benchmark/fallback assumptions are allowed and disclosed.",
  },
  {
    id: "company_contact",
    mayDefer: true,
    rule: "Company contact/address may defer until quote issue (hard-required only at Mark sent).",
  },
  {
    id: "commercial_defaults",
    mayDefer: true,
    rule: "Margin/contingency may defer when transparent app defaults (20% / 10%) are used.",
  },
  {
    id: "company_basics",
    mayDefer: false,
    rule: "Currency/country/GST confirmation is the minimum first-run gate after provisioning.",
  },
] as const;
