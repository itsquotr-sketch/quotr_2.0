import "server-only";

import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import type { CompanySettings } from "@/lib/settings/types";

const COMPANY_SETTINGS_SELECT =
  "trading_name, legal_name, contact_email, contact_phone, website, address_line_1, address_line_2, city, region, postcode, address_country, nzbn, gst_number, default_gst_rate, default_quote_validity_days, default_payment_terms, default_quote_terms, default_quote_exclusions, default_quote_assumptions, logo_url, brand_primary_colour, brand_accent_colour, default_material_wastage_percent, decking_wastage_percent, sheet_material_wastage_percent, flooring_wastage_percent, paint_wastage_percent, timber_framing_wastage_percent";

export async function ensureCompanySettingsRow(
  supabase: AuthOrgContext["supabase"],
  orgId: string
) {
  const { data: existing } = await supabase
    .from("organisation_settings")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("organisation_settings")
    .insert({ org_id: orgId })
    .select("id")
    .single();

  if (error || !created) {
    return null;
  }

  return created;
}

export function mapCompanySettingsRow(
  organisationName: string,
  row: Record<string, unknown>
): CompanySettings {
  return {
    organisationName,
    tradingName: (row.trading_name as string | null) ?? null,
    legalName: (row.legal_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    addressCountry: (row.address_country as string) ?? "New Zealand",
    nzbn: (row.nzbn as string | null) ?? null,
    gstNumber: (row.gst_number as string | null) ?? null,
    defaultGstRate: Number(row.default_gst_rate ?? 15),
    defaultQuoteValidityDays: Number(row.default_quote_validity_days ?? 30),
    defaultPaymentTerms: (row.default_payment_terms as string | null) ?? null,
    defaultQuoteTerms: (row.default_quote_terms as string | null) ?? null,
    defaultQuoteExclusions:
      (row.default_quote_exclusions as string | null) ?? null,
    defaultQuoteAssumptions:
      (row.default_quote_assumptions as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    brandPrimaryColour: (row.brand_primary_colour as string | null) ?? null,
    brandAccentColour: (row.brand_accent_colour as string | null) ?? null,
    defaultMaterialWastagePercent: Number(
      row.default_material_wastage_percent ?? 10
    ),
    deckingWastagePercent:
      row.decking_wastage_percent != null
        ? Number(row.decking_wastage_percent)
        : null,
    sheetMaterialWastagePercent:
      row.sheet_material_wastage_percent != null
        ? Number(row.sheet_material_wastage_percent)
        : null,
    flooringWastagePercent:
      row.flooring_wastage_percent != null
        ? Number(row.flooring_wastage_percent)
        : null,
    paintWastagePercent:
      row.paint_wastage_percent != null
        ? Number(row.paint_wastage_percent)
        : null,
    timberFramingWastagePercent:
      row.timber_framing_wastage_percent != null
        ? Number(row.timber_framing_wastage_percent)
        : null,
  };
}

/**
 * Company settings are organisation data, not identity authority.
 * Request-scoped reuse only — never cache globally.
 */
export async function getCompanySettingsWithContext(
  context: AuthOrgContext
): Promise<CompanySettings | null> {
  await ensureCompanySettingsRow(context.supabase, context.orgId);

  const [{ data: organisation }, { data: row, error }] = await Promise.all([
    context.supabase
      .from("organisations")
      .select("name")
      .eq("id", context.orgId)
      .maybeSingle(),
    context.supabase
      .from("organisation_settings")
      .select(COMPANY_SETTINGS_SELECT)
      .eq("org_id", context.orgId)
      .maybeSingle(),
  ]);

  if (error || !row) {
    return null;
  }

  return mapCompanySettingsRow(
    organisation?.name ?? "Your company",
    row
  );
}

export async function loadCompanySettingsForRequest(): Promise<CompanySettings | null> {
  const context = await getAuthOrgContext();
  if (!context) {
    return null;
  }
  return getCompanySettingsWithContext(context);
}
