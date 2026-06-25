"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { USER_ERRORS, toUserError } from "@/lib/errors/user-message";
import { createClient } from "@/lib/supabase/server";
import type {
  CompanySettings,
  CompanySettingsActionResult,
  CompanySettingsInput,
  OrgQuoteDefaults,
} from "@/lib/settings/types";

const COMPANY_SETTINGS_PATH = "/app/settings/company";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const companySettingsSchema = z.object({
  tradingName: optionalText,
  legalName: optionalText,
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value)),
  contactPhone: optionalText,
  website: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  region: optionalText,
  postcode: optionalText,
  addressCountry: z
    .string()
    .trim()
    .min(1, "Country is required.")
    .optional(),
  nzbn: optionalText,
  gstNumber: optionalText,
  defaultGstRate: z
    .number()
    .min(0, "GST rate must be at least 0.")
    .max(100, "GST rate cannot exceed 100.")
    .optional(),
  defaultQuoteValidityDays: z
    .number()
    .int("Validity days must be a whole number.")
    .min(1, "Validity must be at least 1 day.")
    .max(365, "Validity cannot exceed 365 days.")
    .optional(),
  defaultPaymentTerms: optionalText,
  defaultQuoteTerms: optionalText,
  defaultQuoteExclusions: optionalText,
  defaultQuoteAssumptions: optionalText,
  logoUrl: optionalText,
  brandPrimaryColour: optionalText,
  brandAccentColour: optionalText,
  defaultMaterialWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .optional(),
  deckingWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .nullable()
    .optional(),
  sheetMaterialWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .nullable()
    .optional(),
  flooringWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .nullable()
    .optional(),
  paintWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .nullable()
    .optional(),
  timberFramingWastagePercent: z
    .number()
    .min(0, "Wastage must be at least 0%.")
    .max(50, "Wastage cannot exceed 50%.")
    .nullable()
    .optional(),
});

type AuthOrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  organisationName: string;
};

async function getAuthOrgContext(): Promise<AuthOrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.org_id) {
    return null;
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("name")
    .eq("id", profile.org_id)
    .maybeSingle();

  return {
    supabase,
    orgId: profile.org_id,
    organisationName: organisation?.name ?? "Your company",
  };
}

async function ensureSettingsRow(
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

function mapSettingsRow(
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

function mapQuoteDefaultsRow(row: Record<string, unknown>): OrgQuoteDefaults {
  return {
    defaultGstRate: Number(row.default_gst_rate ?? 15),
    defaultQuoteValidityDays: Number(row.default_quote_validity_days ?? 30),
    defaultPaymentTerms: (row.default_payment_terms as string | null) ?? null,
    defaultQuoteTerms: (row.default_quote_terms as string | null) ?? null,
    defaultQuoteExclusions:
      (row.default_quote_exclusions as string | null) ?? null,
    defaultQuoteAssumptions:
      (row.default_quote_assumptions as string | null) ?? null,
  };
}

const QUOTE_DEFAULTS_SELECT =
  "default_gst_rate, default_quote_validity_days, default_payment_terms, default_quote_terms, default_quote_exclusions, default_quote_assumptions";

export async function getOrgQuoteDefaultsForOrg(
  supabase: AuthOrgContext["supabase"],
  orgId: string
): Promise<OrgQuoteDefaults> {
  const { data: row } = await supabase
    .from("organisation_settings")
    .select(QUOTE_DEFAULTS_SELECT)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!row) {
    return mapQuoteDefaultsRow({});
  }

  return mapQuoteDefaultsRow(row);
}

const COMPANY_SETTINGS_SELECT =
  "trading_name, legal_name, contact_email, contact_phone, website, address_line_1, address_line_2, city, region, postcode, address_country, nzbn, gst_number, default_gst_rate, default_quote_validity_days, default_payment_terms, default_quote_terms, default_quote_exclusions, default_quote_assumptions, logo_url, brand_primary_colour, brand_accent_colour, default_material_wastage_percent, decking_wastage_percent, sheet_material_wastage_percent, flooring_wastage_percent, paint_wastage_percent, timber_framing_wastage_percent";

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const context = await getAuthOrgContext();
  if (!context) {
    return null;
  }

  await ensureSettingsRow(context.supabase, context.orgId);

  const { data: row, error } = await context.supabase
    .from("organisation_settings")
    .select(COMPANY_SETTINGS_SELECT)
    .eq("org_id", context.orgId)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  return mapSettingsRow(context.organisationName, row);
}

export async function updateCompanySettings(
  input: CompanySettingsInput
): Promise<CompanySettingsActionResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return {
      error:
        "Your organisation profile could not be loaded. Try signing out and back in.",
    };
  }

  const parsed = companySettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { fieldErrors };
  }

  const data = parsed.data;
  await ensureSettingsRow(context.supabase, context.orgId);

  const update: Record<string, unknown> = {};

  if (data.tradingName !== undefined) update.trading_name = data.tradingName;
  if (data.legalName !== undefined) update.legal_name = data.legalName;
  if (data.contactEmail !== undefined) update.contact_email = data.contactEmail;
  if (data.contactPhone !== undefined) update.contact_phone = data.contactPhone;
  if (data.website !== undefined) update.website = data.website;
  if (data.addressLine1 !== undefined) update.address_line_1 = data.addressLine1;
  if (data.addressLine2 !== undefined) update.address_line_2 = data.addressLine2;
  if (data.city !== undefined) update.city = data.city;
  if (data.region !== undefined) update.region = data.region;
  if (data.postcode !== undefined) update.postcode = data.postcode;
  if (data.addressCountry !== undefined) {
    update.address_country = data.addressCountry;
  }
  if (data.nzbn !== undefined) update.nzbn = data.nzbn;
  if (data.gstNumber !== undefined) update.gst_number = data.gstNumber;
  if (data.defaultGstRate !== undefined) {
    update.default_gst_rate = data.defaultGstRate;
  }
  if (data.defaultQuoteValidityDays !== undefined) {
    update.default_quote_validity_days = data.defaultQuoteValidityDays;
  }
  if (data.defaultPaymentTerms !== undefined) {
    update.default_payment_terms = data.defaultPaymentTerms;
  }
  if (data.defaultQuoteTerms !== undefined) {
    update.default_quote_terms = data.defaultQuoteTerms;
  }
  if (data.defaultQuoteExclusions !== undefined) {
    update.default_quote_exclusions = data.defaultQuoteExclusions;
  }
  if (data.defaultQuoteAssumptions !== undefined) {
    update.default_quote_assumptions = data.defaultQuoteAssumptions;
  }
  if (data.logoUrl !== undefined) update.logo_url = data.logoUrl;
  if (data.brandPrimaryColour !== undefined) {
    update.brand_primary_colour = data.brandPrimaryColour;
  }
  if (data.brandAccentColour !== undefined) {
    update.brand_accent_colour = data.brandAccentColour;
  }
  if (data.defaultMaterialWastagePercent !== undefined) {
    update.default_material_wastage_percent = data.defaultMaterialWastagePercent;
  }
  if (data.deckingWastagePercent !== undefined) {
    update.decking_wastage_percent = data.deckingWastagePercent;
  }
  if (data.sheetMaterialWastagePercent !== undefined) {
    update.sheet_material_wastage_percent = data.sheetMaterialWastagePercent;
  }
  if (data.flooringWastagePercent !== undefined) {
    update.flooring_wastage_percent = data.flooringWastagePercent;
  }
  if (data.paintWastagePercent !== undefined) {
    update.paint_wastage_percent = data.paintWastagePercent;
  }
  if (data.timberFramingWastagePercent !== undefined) {
    update.timber_framing_wastage_percent = data.timberFramingWastagePercent;
  }

  if (Object.keys(update).length === 0) {
    const settings = await getCompanySettings();
    return settings ? { settings } : { error: "Nothing to update." };
  }

  const { data: updated, error } = await context.supabase
    .from("organisation_settings")
    .update(update)
    .eq("org_id", context.orgId)
    .select(COMPANY_SETTINGS_SELECT)
    .single();

  if (error || !updated) {
    return {
      error: toUserError(
        error,
        "updateCompanySettings",
        USER_ERRORS.companySettingsSaveFailed
      ),
    };
  }

  revalidatePath(COMPANY_SETTINGS_PATH);

  return {
    settings: mapSettingsRow(context.organisationName, updated),
  };
}
