"use server";

import { cache } from "react";
import { z } from "zod";
import {
  MAX_MARGIN_PERCENT,
  MIN_MARGIN_PERCENT,
  validateMarginPercent,
} from "@/lib/security/margin-validation";
import { loadOrganisationName } from "@/lib/org/organisation-name-reader";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import { loadOrganisationSettingsRow } from "@/lib/settings/organisation-settings-reader";
import {
  getRequestMembershipRole,
  permissionDeniedError,
} from "@/lib/team/permission-server";
import type { MembershipRole } from "@/lib/team/roles";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import type { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  ActionResult,
  CompanyBasicsInput,
  CompanyDefaultsInput,
  SetupState,
  StarterRateInput,
  WorkAreaSelection,
} from "@/components/setup/types";
import {
  getCountryOption,
  isSupportedCountryCode,
  isSupportedCurrencyCode,
  normalizeCountryCode,
  normalizeCurrencyCode,
} from "@/lib/setup/locale-catalogue";
import { defaultTimezoneForCountry, isCatalogueTimezone } from "@/lib/org/timezone";
import {
  ONBOARDING_LABOUR_RATE,
  parseOptionalLabourCost,
  parseOptionalTargetMargin,
  parseRequiredTargetMargin,
} from "@/lib/setup/pricing-basics";
import {
  onboardingMutationIsTenantScoped,
  resolveFirstRunStage,
  type FirstRunStage,
} from "@/lib/setup/first-run-stage";
import {
  assessRequiredOnboarding,
  deriveIncompleteSetup,
  gstRegistrationPersistence,
  isCanonicalOnboardingComplete,
  resolveLabourOnboardingWrite,
  type LabourOnboardingChoice,
  type OnboardingAuthoritySnapshot,
} from "@/lib/setup/onboarding-authority";
import {
  CARPENTER_LABOUR_RATE_KEY,
  LABOURER_LABOUR_RATE_KEY,
} from "@/lib/estimate/labour-trade-mapping";
import { parseRequiredCompanyProfile } from "@/lib/setup/tax-identifier";
import { hasEnabledPrimaryWorkArea } from "@/lib/setup/first-run-work-areas";
import { toUserError } from "@/lib/errors/user-message";

function setupDbError(error: unknown): ActionResult {
  return { error: toUserError(error, "setup") };
}

type SetupAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  orgId: string;
  organisationName: string;
};

const MISSING_ORG_ERROR: ActionResult = {
  error:
    "Your company profile could not be loaded. Try signing out and back in, or contact support.",
};

async function getSetupAuthContext(): Promise<SetupAuthContext | null> {
  const context = await getAuthOrgContext();
  if (!context) {
    return null;
  }

  const organisationName =
    (await loadOrganisationName(context.orgId)) ?? "Your company";

  return {
    ...context,
    organisationName,
  };
}

function normalizeSettings(
  settings: Record<string, unknown>
): SetupState["settings"] {
  return {
    ...(settings as SetupState["settings"] & Record<string, unknown>),
    default_margin_percent: Number(settings.default_margin_percent),
    default_contingency_percent: Number(settings.default_contingency_percent),
    default_gst_rate: Number(settings.default_gst_rate ?? 15),
    budget_rate_factor: Number(settings.budget_rate_factor ?? 0.9),
    premium_rate_factor: Number(settings.premium_rate_factor ?? 1.15),
  };
}

async function ensureDefaultSettings(
  supabase: SetupAuthContext["supabase"],
  orgId: string
) {
  const { data: existing } = await supabase
    .from("organisation_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("organisation_settings")
    .insert({ org_id: orgId })
    .select("*")
    .single();

  if (error || !created) {
    return null;
  }

  return created;
}

/**
 * Sidebar "Incomplete" badge authority (R2A).
 * True only while company basics are not confirmed.
 * Does NOT use onboarding_status === completed (Review/Mark complete).
 */
export async function isSetupIncomplete(): Promise<boolean> {
  return needsCompanyBasics();
}

/**
 * First-run company basics still need confirmation (Stage 3.1C.3-R2A).
 * True only while first-run stage is Company Basics (see getFirstRunStage).
 * Company save must not be treated as total onboarding completion.
 */
export async function needsCompanyBasics(): Promise<boolean> {
  const stage = await getFirstRunStage();
  return stage === "basics";
}

export type OnboardingAccessState = {
  stage: FirstRunStage;
  /** Derived for the later incomplete-setup notice. Does not lock navigation. */
  incompleteSetupNotice: boolean;
  role: MembershipRole | null;
};

export async function getFirstRunStage(): Promise<FirstRunStage> {
  return (await getOnboardingAccessCached()).stage;
}

export async function getOnboardingAccess(): Promise<OnboardingAccessState> {
  return getOnboardingAccessCached();
}

function readLabourChoice(value: unknown): LabourOnboardingChoice | null {
  return value === "company" || value === "quotr_benchmark" ? value : null;
}

function positiveLabourCost(
  rows: Array<{ item_key?: string | null; cost_rate?: number | null; active?: boolean | null }>,
  itemKey: string
): boolean {
  return rows.some(
    (row) =>
      row.item_key === itemKey &&
      row.active !== false &&
      row.cost_rate != null &&
      Number(row.cost_rate) > 0
  );
}

function authorityFromSettings(
  settings: Record<string, unknown> | null,
  hasPrimaryWorkAreas: boolean,
  labourRates: Array<{ item_key?: string | null; cost_rate?: number | null; active?: boolean | null }>
): OnboardingAuthoritySnapshot {
  const margin = Number(settings?.default_margin_percent);
  const gstRate = Number(settings?.default_gst_rate);
  return {
    tradingName: typeof settings?.trading_name === "string" ? settings.trading_name : null,
    country: typeof settings?.country === "string" ? settings.country : null,
    addressLine1: typeof settings?.address_line_1 === "string" ? settings.address_line_1 : null,
    city: typeof settings?.city === "string" ? settings.city : null,
    postcode: typeof settings?.postcode === "string" ? settings.postcode : null,
    gstRegistered:
      settings?.gst_registered === true || settings?.gst_registered === false
        ? settings.gst_registered
        : null,
    gstNumber: typeof settings?.gst_number === "string" ? settings.gst_number : null,
    abn: typeof settings?.abn === "string" ? settings.abn : null,
    nzbn: typeof settings?.nzbn === "string" ? settings.nzbn : null,
    defaultGstRate: Number.isFinite(gstRate) ? gstRate : null,
    hasPrimaryWorkAreas,
    carpenterChoice: readLabourChoice(settings?.carpenter_onboarding_choice),
    carpenterHasPositiveCost: positiveLabourCost(labourRates, CARPENTER_LABOUR_RATE_KEY),
    labourerChoice: readLabourChoice(settings?.labourer_onboarding_choice),
    labourerHasPositiveCost: positiveLabourCost(labourRates, LABOURER_LABOUR_RATE_KEY),
    marginPercent: Number.isFinite(margin) ? margin : null,
  };
}

async function loadOnboardingAccessUncached(): Promise<OnboardingAccessState> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { stage: "basics", incompleteSetupNotice: false, role: null };
  }

  const [settings, preferredWorkAreas, labourRates, role] = await Promise.all([
    loadOrganisationSettingsRow(context.orgId),
    context.supabase
      .from("organisation_work_areas")
      .select("work_area_type, enabled")
      .eq("org_id", context.orgId)
      .eq("enabled", true)
      .limit(1),
    context.supabase
      .from("rates")
      .select("item_key, cost_rate, active")
      .eq("org_id", context.orgId)
      .eq("rate_type", "labour")
      .in("item_key", [CARPENTER_LABOUR_RATE_KEY, LABOURER_LABOUR_RATE_KEY]),
    getRequestMembershipRole({ orgId: context.orgId, userId: context.user.id }),
  ]);

  const hasPrimaryWorkAreas = (preferredWorkAreas.data?.length ?? 0) > 0;
  const authority = authorityFromSettings(
    settings,
    hasPrimaryWorkAreas,
    labourRates.data ?? []
  );
  const onboardingStatus = settings?.onboarding_status as string | null | undefined;
  const onboardingStep = settings?.onboarding_step as string | null | undefined;

  return {
    stage: resolveFirstRunStage({
      onboardingStatus,
      onboardingStep,
      hasPrimaryWorkAreas,
      authority,
    }),
    incompleteSetupNotice: deriveIncompleteSetup(authority),
    role,
  };
}

const getOnboardingAccessCached: () => Promise<OnboardingAccessState> = cache(
  loadOnboardingAccessUncached
);

async function loadFreshOnboardingAuthority(): Promise<{
  status: string | null;
  step: string | null;
  authority: OnboardingAuthoritySnapshot;
} | null> {
  const context = await getSetupAuthContext();
  if (!context) return null;
  const [settingsResult, workResult, labourResult] = await Promise.all([
    context.supabase
      .from("organisation_settings")
      .select(
        "onboarding_status, onboarding_step, trading_name, country, address_line_1, city, postcode, gst_registered, gst_number, abn, nzbn, default_gst_rate, default_margin_percent, carpenter_onboarding_choice, labourer_onboarding_choice"
      )
      .eq("org_id", context.orgId)
      .maybeSingle(),
    context.supabase
      .from("organisation_work_areas")
      .select("work_area_type")
      .eq("org_id", context.orgId)
      .eq("enabled", true)
      .limit(1),
    context.supabase
      .from("rates")
      .select("item_key, cost_rate, active")
      .eq("org_id", context.orgId)
      .eq("rate_type", "labour")
      .in("item_key", [CARPENTER_LABOUR_RATE_KEY, LABOURER_LABOUR_RATE_KEY]),
  ]);
  const settings = (settingsResult.data ?? null) as Record<string, unknown> | null;
  return {
    status: (settings?.onboarding_status as string | null | undefined) ?? null,
    step: (settings?.onboarding_step as string | null | undefined) ?? null,
    authority: authorityFromSettings(
      settings,
      (workResult.data?.length ?? 0) > 0,
      labourResult.data ?? []
    ),
  };
}

const companyBasicsSchema = z.object({
  currency: z
    .string()
    .trim()
    .min(1, "Currency is required")
    .max(16, "Currency code is too long"),
  country: z
    .string()
    .trim()
    .min(1, "Country is required")
    .max(64, "Country is too long"),
  region: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(64).optional(),
  contact_email: z
    .string()
    .trim()
    .min(1, "Company email is required")
    .email("Enter a valid company email.")
    .max(254, "Email is too long"),
  contact_phone: z
    .string()
    .trim()
    .max(40, "Phone number is too long")
    .optional(),
  default_gst_rate: z
    .number()
    .min(0, "GST rate must be at least 0")
    .max(100, "GST rate cannot exceed 100"),
});

/**
 * Confirm minimum company basics.
 * Sets onboarding_step to work_areas (existing enum) meaning Your Work
 * is next. Does not skip the user to Dashboard.
 */
export async function saveCompanyBasics(
  input: CompanyBasicsInput
): Promise<ActionResult> {
  const parsed = companyBasicsSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const countryCode = normalizeCountryCode(parsed.data.country);
  const currencyCode = normalizeCurrencyCode(parsed.data.currency);

  if (!countryCode || !isSupportedCountryCode(countryCode)) {
    return {
      fieldErrors: {
        country: ["Select a supported country."],
      },
    };
  }
  if (!currencyCode || !isSupportedCurrencyCode(currencyCode)) {
    return {
      fieldErrors: {
        currency: ["Select a supported currency."],
      },
    };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;
  const data = parsed.data;

  const { data: existing } = await supabase
    .from("organisation_settings")
    .select("id, onboarding_status, onboarding_step")
    .eq("org_id", orgId)
    .maybeSingle();

  const alreadyCompleted = existing?.onboarding_status === "completed";
  const currentStep = existing?.onboarding_step ?? "company";
  // Advance only from company; do not rewind work/pricing-visited or later.
  const shouldMarkWorkNext =
    !alreadyCompleted && (!existing || currentStep === "company");

  const timezone = data.timezone?.trim() || "";
  if (shouldMarkWorkNext && !isCatalogueTimezone(timezone)) {
    return {
      fieldErrors: {
        timezone: ["Select the timezone your company works in."],
      },
    };
  }
  if (timezone && !isCatalogueTimezone(timezone)) {
    return {
      fieldErrors: {
        timezone: ["Select a valid timezone."],
      },
    };
  }

  const payload = {
    org_id: orgId,
    currency: currencyCode,
    country: countryCode,
    region: data.region?.trim() || null,
    ...(timezone ? { timezone } : {}),
    contact_email: data.contact_email.trim(),
    contact_phone: data.contact_phone?.trim() || null,
    default_gst_rate: data.default_gst_rate,
    ...(shouldMarkWorkNext
      ? {
          onboarding_status: "in_progress" as const,
          // work_areas = company basics saved; Your Work not completed yet.
          onboarding_step: "work_areas" as const,
        }
      : {}),
  };

  const { error } = await supabase
    .from("organisation_settings")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    return { error: "Could not save company basics. Please try again." };
  }

  revalidatePath("/app/dashboard");
  revalidatePath("/app/setup");
  revalidatePath("/app/settings/company");
  revalidatePath("/app/rates");

  return { success: true };
}

/**
 * Required first-run company profile.
 * Writes trading name, manual address, GST status and tax identifier into
 * the existing organisation_settings columns used by Quote and Variation
 * documents. Does not mark onboarding complete.
 */
export async function saveRequiredCompanyProfile(
  input: CompanyBasicsInput
): Promise<ActionResult> {
  const countryCode = normalizeCountryCode(input.country);
  const suggested =
    getCountryOption(countryCode ?? "")?.suggestedGstPercent ?? 15;
  const parsed = parseRequiredCompanyProfile(
    {
      tradingName: input.trading_name ?? "",
      country: countryCode ?? input.country,
      addressLine1: input.address_line_1 ?? "",
      addressLine2: input.address_line_2,
      city: input.city ?? "",
      postcode: input.postcode ?? "",
      region: input.region,
      gstRegistered: input.gst_registered ?? "",
      taxIdentifier: input.tax_identifier,
    },
    suggested
  );
  if (!parsed.ok) {
    return { fieldErrors: parsed.fieldErrors };
  }

  const context = await getSetupAuthContext();
  if (!context) return MISSING_ORG_ERROR;

  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  const { supabase, orgId, user } = context;
  const value = parsed.value;
  const { data: existing } = await supabase
    .from("organisation_settings")
    .select("id, onboarding_status, onboarding_step, contact_email, timezone")
    .eq("org_id", orgId)
    .maybeSingle();

  const alreadyCompleted = existing?.onboarding_status === "completed";
  const currentStep = existing?.onboarding_step ?? "company";
  const shouldAdvance =
    !alreadyCompleted &&
    (!existing || currentStep === "company" || currentStep === "not_started");

  const timezone =
    (typeof existing?.timezone === "string" && existing.timezone) ||
    defaultTimezoneForCountry({
      country: value.countryCode,
      region: value.region,
    }) ||
    "";

  const contactEmail =
    input.contact_email?.trim() ||
    (typeof existing?.contact_email === "string" ? existing.contact_email : "") ||
    user.email ||
    null;

  const registration = gstRegistrationPersistence({
    registered: value.gstRegistered,
    countryCode: value.countryCode,
    gstNumber: value.gstNumber,
    abn: value.abn,
    suggestedRate: value.defaultGstRate,
  });

  const payload: Record<string, unknown> = {
    org_id: orgId,
    trading_name: value.tradingName,
    country: value.countryCode,
    currency: value.currency,
    address_line_1: value.addressLine1,
    address_line_2: value.addressLine2,
    city: value.city,
    postcode: value.postcode,
    region: value.region,
    address_country: value.addressCountry,
    gst_registered: registration.gst_registered,
    default_gst_rate: registration.default_gst_rate,
    gst_number: registration.gst_number,
    abn: registration.abn,
    contact_email: contactEmail,
    ...(timezone ? { timezone } : {}),
    ...(shouldAdvance
      ? {
          onboarding_status: "in_progress" as const,
          onboarding_step: "work_areas" as const,
        }
      : {}),
  };

  const { error } = await supabase
    .from("organisation_settings")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    return { error: "Could not save company details. Please try again." };
  }

  revalidatePath("/app/dashboard");
  revalidatePath("/app/setup");
  revalidatePath("/app/settings/company");
  revalidatePath("/app/rates");
  return { success: true };
}

const pricingBasicsSchema = z.object({
  labourCost: z.union([z.string(), z.number()]).nullable().optional(),
  targetMarginPercent: z.union([z.string(), z.number()]).nullable().optional(),
  skipLabour: z.boolean().optional(),
  skipMargin: z.boolean().optional(),
});

/**
 * Optional first-run pricing basics.
 * Labour writes labour.carpenter.hour cost_rate (sell left unset so margin applies).
 * Margin writes organisation_settings.default_margin_percent.
 * Skip leaves benchmarks allowed and the stored margin untouched.
 * It does not write a completion step.
 */
export async function savePricingBasics(input: {
  labourCost?: string | number | null;
  targetMarginPercent?: string | number | null;
  skipLabour?: boolean;
  skipMargin?: boolean;
}): Promise<ActionResult> {
  const parsed = pricingBasicsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Could not save pricing basics. Please try again." };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.rates.manage",
    entitlement: "company_rates.basic",
  });
  if (denied) {
    return denied;
  }

  const { supabase, orgId } = context;

  const labour = parsed.data.skipLabour
    ? ({ skip: true } as const)
    : parseOptionalLabourCost(parsed.data.labourCost);
  if ("error" in labour) {
    return { fieldErrors: { labourCost: [labour.error] } };
  }

  const margin = parsed.data.skipMargin
    ? ({ skip: true } as const)
    : parseOptionalTargetMargin(parsed.data.targetMarginPercent);
  if ("error" in margin) {
    return { fieldErrors: { targetMarginPercent: [margin.error] } };
  }

  if (!labour.skip) {
    const row = ONBOARDING_LABOUR_RATE;
    const { error } = await supabase.from("rates").upsert(
      {
        org_id: orgId,
        rate_type: row.rate_type,
        trade: row.trade ?? null,
        work_area_type: row.work_area_type ?? null,
        item_key: row.item_key,
        label: row.label,
        unit: row.unit,
        cost_rate: labour.costRate,
        sell_rate: null,
        markup_percent: null,
        active: true,
      },
      { onConflict: "org_id,rate_type,item_key" }
    );
    if (error) {
      return { error: "Could not save your labour cost. Please try again." };
    }
  }

  if (!margin.skip) {
    const { error } = await supabase
      .from("organisation_settings")
      .update({ default_margin_percent: margin.marginPercent })
      .eq("org_id", orgId);
    if (error) {
      return { error: "Could not save your target margin. Please try again." };
    }
  }

  revalidatePath("/app/setup");
  revalidatePath("/app/rates");
  revalidatePath("/app/dashboard");

  return { success: true };
}

export async function getSetupState(): Promise<SetupState> {
  const context = await getSetupAuthContext();

  if (!context) {
    return {
      organisationName: "Your company",
      settings: null,
      workAreas: [],
      rates: [],
    };
  }

  const { supabase, orgId, organisationName } = context;
  const cachedSettings = await loadOrganisationSettingsRow(orgId);
  const settingsRow = cachedSettings ?? (await ensureDefaultSettings(supabase, orgId));

  const [{ data: workAreas }, { data: rates }] = await Promise.all([
    supabase
      .from("organisation_work_areas")
      .select(
        "id, work_area_type, label, category, description, estimate_support, enabled, sort_order"
      )
      .eq("org_id", orgId)
      .order("sort_order"),
    supabase
      .from("rates")
      .select(
        "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
      )
      .eq("org_id", orgId)
      .eq("active", true),
  ]);

  return {
    organisationName,
    settings: settingsRow ? normalizeSettings(settingsRow) : null,
    workAreas: workAreas ?? [],
    rates: (rates ?? []).map((rate) => ({
      ...rate,
      cost_rate: rate.cost_rate != null ? Number(rate.cost_rate) : null,
      sell_rate: rate.sell_rate != null ? Number(rate.sell_rate) : null,
      markup_percent:
        rate.markup_percent != null ? Number(rate.markup_percent) : null,
    })),
  };
}

const companyDefaultsSchema = z.object({
  currency: z.string().trim().min(1, "Currency is required"),
  country: z.string().trim().min(1, "Country is required"),
  region: z.string().trim().optional(),
  default_margin_percent: z
    .number()
    .min(MIN_MARGIN_PERCENT, `Gross margin must be at least ${MIN_MARGIN_PERCENT}%`)
    .max(MAX_MARGIN_PERCENT, `Gross margin must be at most ${MAX_MARGIN_PERCENT}%`)
    .refine(
      (value) => validateMarginPercent(value).ok,
      "Gross margin must be a finite value between 0% and 95%."
    ),
  default_contingency_percent: z
    .number()
    .min(0, "Contingency must be at least 0")
    .max(100, "Contingency must be at most 100"),
  budget_rate_factor: z
    .number()
    .gt(0, "Budget factor must be greater than 0")
    .max(1, "Budget factor must be at most 1"),
  premium_rate_factor: z
    .number()
    .min(1, "Premium factor must be at least 1")
    .max(2, "Premium factor must be at most 2"),
  prefer_user_rates: z.boolean(),
  allow_benchmark_rates: z.boolean(),
  show_profit_in_estimates: z.boolean(),
});

export async function saveCompanyDefaults(
  input: CompanyDefaultsInput
): Promise<ActionResult> {
  const parsed = companyDefaultsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.rates.manage",
    entitlement: "company_rates.basic",
  });
  if (denied) {
    return denied;
  }

  const { supabase, orgId } = context;
  const data = parsed.data;

  const payload = {
    org_id: orgId,
    currency: data.currency,
    country: data.country,
    region: data.region || null,
    default_margin_percent: data.default_margin_percent,
    default_contingency_percent: data.default_contingency_percent,
    budget_rate_factor: data.budget_rate_factor,
    premium_rate_factor: data.premium_rate_factor,
    prefer_user_rates: data.prefer_user_rates,
    allow_benchmark_rates: data.allow_benchmark_rates,
    show_profit_in_estimates: data.show_profit_in_estimates,
  };

  const { error } = await supabase
    .from("organisation_settings")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    return { error: "Could not save company defaults. Please try again." };
  }

  return {};
}

const workAreasSchema = z.object({
  selections: z.array(
    z.object({
      work_area_type: z.string(),
      enabled: z.boolean(),
    })
  ),
});

/**
 * Persist company work-type preferences (organisation_work_areas.enabled).
 * Preference only — does not restrict Analyse Job / Scope Discovery capability.
 * Empty selection is valid (no claimed preferences).
 */
export async function saveOrganisationWorkAreas(input: {
  selections: WorkAreaSelection[];
}): Promise<ActionResult> {
  const parsed = workAreasSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: fieldErrors.selections?.[0] ?? "Invalid work type selections.",
      fieldErrors,
    };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  const { supabase, orgId } = context;
  const selectionMap = new Map(
    parsed.data.selections.map((s) => [s.work_area_type, s.enabled])
  );

  const rows = SCOPE_CATALOGUE.map((item, index) => ({
    org_id: orgId,
    work_area_type: item.type,
    label: item.label,
    category: item.category,
    description: item.description,
    estimate_support: item.estimateSupport,
    // Preference = explicit user choice only (never catalogue defaultEnabled).
    enabled: selectionMap.get(item.type) === true,
    sort_order: index,
  }));

  const { error: upsertError } = await supabase
    .from("organisation_work_areas")
    .upsert(rows, { onConflict: "org_id,work_area_type" });

  if (upsertError) {
    return setupDbError(upsertError);
  }

  revalidatePath("/app/setup");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/rates");
  revalidatePath("/app/settings/company");

  return {};
}

/**
 * First-run primary Work Areas. Requires at least one selection.
 * Persists to organisation_work_areas.enabled and advances to labour
 * costs. Does not mark onboarding complete.
 */
export async function savePrimaryWorkAreas(input: {
  selections: WorkAreaSelection[];
}): Promise<ActionResult> {
  const parsed = workAreasSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid work type selections." };
  }

  if (!hasEnabledPrimaryWorkArea(parsed.data.selections)) {
    return {
      error: "Choose at least one kind of work you usually price.",
      fieldErrors: { selections: ["Select at least one work area."] },
    };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  const { supabase, orgId } = context;
  const selectionMap = new Map(
    parsed.data.selections.map((s) => [s.work_area_type, s.enabled])
  );

  const rows = SCOPE_CATALOGUE.map((item, index) => ({
    org_id: orgId,
    work_area_type: item.type,
    label: item.label,
    category: item.category,
    description: item.description,
    estimate_support: item.estimateSupport,
    enabled: selectionMap.get(item.type) === true,
    sort_order: index,
  }));

  const { error: upsertError } = await supabase
    .from("organisation_work_areas")
    .upsert(rows, { onConflict: "org_id,work_area_type" });

  if (upsertError) {
    return setupDbError(upsertError);
  }

  const { data: settings } = await supabase
    .from("organisation_settings")
    .select("onboarding_status, onboarding_step")
    .eq("org_id", orgId)
    .maybeSingle();

  if (
    settings?.onboarding_status !== "completed" &&
    (settings?.onboarding_step === "work_areas" ||
      settings?.onboarding_step === "company")
  ) {
    const { error: settingsError } = await supabase
      .from("organisation_settings")
      .update({
        onboarding_status: "in_progress",
        onboarding_step: "labour",
      })
      .eq("org_id", orgId);
    if (settingsError) return setupDbError(settingsError);
  }

  revalidatePath("/app/setup");
  revalidatePath("/app/dashboard");
  revalidatePath("/app/rates");

  return { success: true };
}

const rateValueSchema = z
  .number()
  .min(0, "Rate must be non-negative")
  .optional();

const starterRatesSchema = z.object({
  rates: z.array(
    z.object({
      item_key: z.string(),
      rate_type: z.string(),
      trade: z.string().optional(),
      work_area_type: z.string().optional(),
      label: z.string(),
      unit: z.string(),
      cost_rate: rateValueSchema,
      sell_rate: rateValueSchema,
      markup_percent: rateValueSchema,
    })
  ),
});

export async function saveStarterRates(input: {
  rates: StarterRateInput[];
  skip?: boolean;
}): Promise<ActionResult> {
  const parsed = starterRatesSchema.safeParse({ rates: input.rates });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const context = await getSetupAuthContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

  if (!input.skip) {
    const rowsToUpsert = parsed.data.rates
      .filter((rate) => {
        return (
          rate.cost_rate != null ||
          rate.sell_rate != null ||
          rate.markup_percent != null
        );
      })
      .map((rate) => ({
        org_id: orgId,
        rate_type: rate.rate_type,
        trade: rate.trade ?? null,
        work_area_type: rate.work_area_type ?? null,
        item_key: rate.item_key,
        label: rate.label,
        unit: rate.unit,
        cost_rate: rate.cost_rate ?? null,
        sell_rate: rate.sell_rate ?? null,
        markup_percent: rate.markup_percent ?? null,
        active: true,
      }));

    if (rowsToUpsert.length > 0) {
      const { error } = await supabase
        .from("rates")
        .upsert(rowsToUpsert, { onConflict: "org_id,rate_type,item_key" });

      if (error) {
        return setupDbError(error);
      }
    }
  }

  revalidatePath("/app/setup");
  revalidatePath("/app/rates");
  revalidatePath("/app/dashboard");

  return {};
}

async function writeCanonicalOnboardingCompletion(
  context: SetupAuthContext
): Promise<ActionResult> {
  const { error } = await context.supabase
    .from("organisation_settings")
    .update({
      onboarding_status: "completed",
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("org_id", context.orgId);

  if (error) {
    return setupDbError(error);
  }

  revalidatePath("/app/setup");
  revalidatePath("/app/dashboard");
  return { success: true };
}

/** Legacy entry. Completes only through completeRequiredOnboarding. */
export async function completeSetup(): Promise<ActionResult> {
  return completeRequiredOnboarding();
}

async function upsertInternalLabourCost(params: {
  supabase: SetupAuthContext["supabase"];
  orgId: string;
  itemKey: string;
  trade: string;
  label: string;
  costRate: number;
}): Promise<ActionResult | null> {
  const { error } = await params.supabase.from("rates").upsert(
    {
      org_id: params.orgId,
      rate_type: "labour",
      trade: params.trade,
      work_area_type: null,
      item_key: params.itemKey,
      label: params.label,
      unit: "hour",
      cost_rate: params.costRate,
      sell_rate: null,
      markup_percent: null,
      active: true,
    },
    { onConflict: "org_id,rate_type,item_key" }
  );
  if (error) {
    return { error: "Could not save your labour costs. Please try again." };
  }
  return null;
}

/**
 * Required carpenter and labourer internal hourly costs, plus the
 * organisation default gross margin (organisation_settings.default_margin_percent).
 * Sell stays unset so charge-out still comes from that margin.
 * Does not rewrite historical quote or variation amounts.
 */
export async function saveRequiredLabourCosts(input: {
  carpenterCost?: string | number | null;
  labourerCost?: string | number | null;
  carpenterChoice?: string | null;
  labourerChoice?: string | null;
  targetMarginPercent?: string | number | null;
}): Promise<ActionResult> {
  const carpenter = resolveLabourOnboardingWrite({
    choice: input.carpenterChoice,
    cost: input.carpenterCost,
    label: "carpenter",
  });
  const labourer = resolveLabourOnboardingWrite({
    choice: input.labourerChoice,
    cost: input.labourerCost,
    label: "labourer",
  });
  const margin = parseRequiredTargetMargin(input.targetMarginPercent);
  const fieldErrors: Record<string, string[]> = {};
  if (!carpenter.ok) fieldErrors.carpenterCost = [carpenter.error];
  if (!labourer.ok) fieldErrors.labourerCost = [labourer.error];
  if (!margin.ok) fieldErrors.targetMarginPercent = [margin.error];
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const context = await getSetupAuthContext();
  if (!context) return MISSING_ORG_ERROR;
  const orgId = context.orgId;
  if (!onboardingMutationIsTenantScoped(orgId, orgId)) {
    return MISSING_ORG_ERROR;
  }

  const denied = await permissionDeniedError({
    orgId,
    userId: context.user.id,
    permission: "company.rates.manage",
    entitlement: "company_rates.basic",
  });
  if (denied) return denied;

  if (!carpenter.ok || !labourer.ok || !margin.ok) return { fieldErrors };

  if (carpenter.writeRate) {
    const carpenterError = await upsertInternalLabourCost({
      supabase: context.supabase,
      orgId,
      itemKey: CARPENTER_LABOUR_RATE_KEY,
      trade: "carpenter",
      label: "Carpenter / builder",
      costRate: carpenter.costRate,
    });
    if (carpenterError) return carpenterError;
  }

  if (labourer.writeRate) {
    const labourerError = await upsertInternalLabourCost({
      supabase: context.supabase,
      orgId,
      itemKey: LABOURER_LABOUR_RATE_KEY,
      trade: "labourer",
      label: "Labourer",
      costRate: labourer.costRate,
    });
    if (labourerError) return labourerError;
  }

  const { data: settings } = await context.supabase
    .from("organisation_settings")
    .select("onboarding_status")
    .eq("org_id", orgId)
    .maybeSingle();

  const settingsUpdate: Record<string, unknown> = {
    default_margin_percent: margin.marginPercent,
    carpenter_onboarding_choice: carpenter.choice,
    labourer_onboarding_choice: labourer.choice,
  };
  if (settings?.onboarding_status !== "completed") {
    settingsUpdate.onboarding_status = "in_progress";
    settingsUpdate.onboarding_step = "ready";
  }
  const { error: marginError } = await context.supabase
    .from("organisation_settings")
    .update(settingsUpdate)
    .eq("org_id", orgId);
  if (marginError) return setupDbError(marginError);

  revalidatePath("/app/setup");
  revalidatePath("/app/rates");
  revalidatePath("/app/dashboard");
  return { success: true };
}

/** Single completion event. Safe to call again. Does not require marketing consent. */
export async function completeRequiredOnboarding(): Promise<ActionResult> {
  const context = await getSetupAuthContext();
  if (!context) return MISSING_ORG_ERROR;

  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.edit",
  });
  if (denied) return denied;

  const loaded = await loadFreshOnboardingAuthority();
  if (!loaded) return MISSING_ORG_ERROR;
  if (isCanonicalOnboardingComplete(loaded.status, loaded.step)) {
    return { success: true };
  }
  if (!assessRequiredOnboarding(loaded.authority).readyToComplete) {
    return { error: "Finish the required setup steps first." };
  }

  return writeCanonicalOnboardingCompletion(context);
}

export async function dismissOptionalPersonalisation(): Promise<ActionResult> {
  const context = await getSetupAuthContext();
  if (!context) return MISSING_ORG_ERROR;

  const { error } = await context.supabase
    .from("organisation_settings")
    .update({
      optional_personalisation_dismissed_at: new Date().toISOString(),
    })
    .eq("org_id", context.orgId);

  if (error) return setupDbError(error);
  revalidatePath("/app/dashboard");
  return { success: true };
}
