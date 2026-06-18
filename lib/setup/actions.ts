"use server";

import { z } from "zod";
import { SCOPE_CATALOGUE } from "@/lib/scopes/catalogue";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  CompanyDefaultsInput,
  SetupState,
  StarterRateInput,
  WorkAreaSelection,
} from "@/components/setup/types";

type AuthOrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  orgId: string;
  organisationName: string;
};

const MISSING_ORG_ERROR: ActionResult = {
  error:
    "Your organisation profile could not be loaded. Try signing out and back in, or contact support.",
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
    .select("org_id, full_name")
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
    user,
    orgId: profile.org_id,
    organisationName: organisation?.name ?? "Your company",
  };
}

function normalizeSettings(
  settings: Record<string, unknown>
): SetupState["settings"] {
  return {
    ...(settings as SetupState["settings"] & Record<string, unknown>),
    default_margin_percent: Number(settings.default_margin_percent),
    default_contingency_percent: Number(settings.default_contingency_percent),
    budget_rate_factor: Number(settings.budget_rate_factor ?? 0.9),
    premium_rate_factor: Number(settings.premium_rate_factor ?? 1.15),
  };
}

async function ensureDefaultSettings(
  supabase: AuthOrgContext["supabase"],
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

export async function isSetupIncomplete(): Promise<boolean> {
  const context = await getAuthOrgContext();
  if (!context) {
    return true;
  }

  const { data: settings } = await context.supabase
    .from("organisation_settings")
    .select("onboarding_status")
    .eq("org_id", context.orgId)
    .maybeSingle();

  return !settings || settings.onboarding_status !== "completed";
}

export async function getSetupState(): Promise<SetupState> {
  const context = await getAuthOrgContext();

  if (!context) {
    return {
      organisationName: "Your company",
      settings: null,
      workAreas: [],
      rates: [],
    };
  }

  const { supabase, orgId, organisationName } = context;
  const settingsRow = await ensureDefaultSettings(supabase, orgId);

  const { data: workAreas } = await supabase
    .from("organisation_work_areas")
    .select(
      "id, work_area_type, label, category, description, estimate_support, enabled, sort_order"
    )
    .eq("org_id", orgId)
    .order("sort_order");

  const { data: rates } = await supabase
    .from("rates")
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .eq("org_id", orgId)
    .eq("active", true);

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
    .min(0, "Margin must be at least 0")
    .max(100, "Margin must be at most 100"),
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

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;
  const data = parsed.data;

  const { data: existing } = await supabase
    .from("organisation_settings")
    .select("id, onboarding_status")
    .eq("org_id", orgId)
    .maybeSingle();

  const isCompleted = existing?.onboarding_status === "completed";

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
    ...(isCompleted
      ? {}
      : {
          onboarding_status: "in_progress" as const,
          onboarding_step: "work_areas" as const,
        }),
  };

  const { error } = await supabase
    .from("organisation_settings")
    .upsert(payload, { onConflict: "org_id" });

  if (error) {
    return { error: error.message };
  }

  return {};
}

const workAreasSchema = z.object({
  selections: z
    .array(
      z.object({
        work_area_type: z.string(),
        enabled: z.boolean(),
      })
    )
    .refine((items) => items.some((item) => item.enabled), {
      message: "Select at least one work area",
      path: ["selections"],
    }),
});

export async function saveOrganisationWorkAreas(input: {
  selections: WorkAreaSelection[];
}): Promise<ActionResult> {
  const parsed = workAreasSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: fieldErrors.selections?.[0],
      fieldErrors,
    };
  }

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

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
    enabled: selectionMap.get(item.type) ?? item.defaultEnabled,
    sort_order: index,
  }));

  const { error: upsertError } = await supabase
    .from("organisation_work_areas")
    .upsert(rows, { onConflict: "org_id,work_area_type" });

  if (upsertError) {
    return { error: upsertError.message };
  }

  const { data: settings } = await supabase
    .from("organisation_settings")
    .select("onboarding_status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settings?.onboarding_status !== "completed") {
    const { error: settingsError } = await supabase
      .from("organisation_settings")
      .update({
        onboarding_status: "in_progress",
        onboarding_step: "rates",
      })
      .eq("org_id", orgId);

    if (settingsError) {
      return { error: settingsError.message };
    }
  }

  return {};
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

  const context = await getAuthOrgContext();
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
        return { error: error.message };
      }
    }
  }

  const { data: settings } = await supabase
    .from("organisation_settings")
    .select("onboarding_status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (settings?.onboarding_status !== "completed") {
    const { error: settingsError } = await supabase
      .from("organisation_settings")
      .update({ onboarding_step: "review" })
      .eq("org_id", orgId);

    if (settingsError) {
      return { error: settingsError.message };
    }
  }

  return {};
}

export async function completeSetup(): Promise<ActionResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

  const { error } = await supabase
    .from("organisation_settings")
    .update({
      onboarding_status: "completed",
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
