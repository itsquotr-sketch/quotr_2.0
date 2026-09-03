"use server";

import {
  MAX_MARGIN_PERCENT,
  MIN_MARGIN_PERCENT,
  validateMarginPercent,
} from "@/lib/security/margin-validation";
import {
  MAX_MARKUP_PERCENT,
  validateMarkupPercent,
} from "@/lib/security/markup-validation";
import {
  ALL_RATE_CATALOGUE,
} from "@/lib/rates/catalogue";
import type {
  RateInput,
  RateSettingsInput,
  RatesActionResult,
  RatesPageRate,
  RatesPageState,
  SetRateActiveInput,
} from "@/lib/rates/types";
import { getAuthOrgContext } from "@/lib/security/auth-org-context";
import type { AuthOrgContext } from "@/lib/security/auth-org-context";
import { permissionDeniedError } from "@/lib/team/permission-server";
import { z } from "zod";

const MISSING_ORG_ERROR: RatesActionResult = {
  error:
    "Your organisation profile could not be loaded. Try signing out and back in, or contact support.",
};

async function requireRatesWriteContext(): Promise<
  { ok: true; context: AuthOrgContext } | { ok: false; error: RatesActionResult }
> {
  const context = await getAuthOrgContext();
  if (!context) {
    return { ok: false, error: MISSING_ORG_ERROR };
  }
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "company.rates.manage",
    entitlement: "company_rates.basic",
  });
  if (denied) return { ok: false, error: denied };
  return { ok: true, context };
}

const VALID_RATE_TYPES = [
  "labour",
  "material",
  "subcontractor",
  "scope",
  "package",
  "allowance",
  "productivity",
] as const;

function normalizeRate(rate: Record<string, unknown>): RatesPageRate {
  return {
    id: String(rate.id),
    rate_type: String(rate.rate_type),
    trade: rate.trade != null ? String(rate.trade) : null,
    work_area_type:
      rate.work_area_type != null ? String(rate.work_area_type) : null,
    item_key: String(rate.item_key),
    label: String(rate.label),
    unit: String(rate.unit),
    cost_rate: rate.cost_rate != null ? Number(rate.cost_rate) : null,
    sell_rate: rate.sell_rate != null ? Number(rate.sell_rate) : null,
    markup_percent:
      rate.markup_percent != null ? Number(rate.markup_percent) : null,
    active: Boolean(rate.active),
    source:
      rate.source === "calibrated_productivity"
        ? "calibrated_productivity"
        : rate.source === "explicit_company"
          ? "explicit_company"
          : null,
    source_calibration_id:
      rate.source_calibration_id != null
        ? String(rate.source_calibration_id)
        : null,
    updated_at:
      rate.updated_at != null ? String(rate.updated_at) : null,
  };
}

function normalizeSettings(
  settings: Record<string, unknown>
): RatesPageState["settings"] {
  return {
    ...(settings as NonNullable<RatesPageState["settings"]>),
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

export async function getRatesPageState(): Promise<RatesPageState> {
  const context = await getAuthOrgContext();

  if (!context) {
    return {
      settings: null,
      rates: [],
      preferredWorkAreaTypes: [],
      canManageRates: false,
      canCalibrate: false,
    };
  }

  const { supabase, orgId } = context;
  const settingsRow = await ensureDefaultSettings(supabase, orgId);

  const [{ data: rates }, { data: preferredRows }, ratesDenied, calibrateDenied] =
    await Promise.all([
      supabase
        .from("rates")
        .select(
          "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, source, source_calibration_id, updated_at"
        )
        .eq("org_id", orgId)
        .order("rate_type")
        .order("label"),
      supabase
        .from("organisation_work_areas")
        .select("work_area_type")
        .eq("org_id", orgId)
        .eq("enabled", true),
      permissionDeniedError({
        orgId,
        userId: context.user.id,
        permission: "company.rates.manage",
        entitlement: "company_rates.basic",
      }),
      permissionDeniedError({
        orgId,
        userId: context.user.id,
        permission: "company.calibration.manage",
        entitlement: "calibration.basic",
      }),
    ]);

  return {
    settings: settingsRow ? normalizeSettings(settingsRow) : null,
    rates: (rates ?? []).map((rate) => normalizeRate(rate)),
    preferredWorkAreaTypes: (preferredRows ?? []).map(
      (row) => row.work_area_type as string
    ),
    canManageRates: ratesDenied == null,
    canCalibrate: calibrateDenied == null,
  };
}

const rateSettingsSchema = z.object({
  default_margin_percent: z
    .number()
    .min(MIN_MARGIN_PERCENT, `Gross margin must be at least ${MIN_MARGIN_PERCENT}%`)
    .max(
      MAX_MARGIN_PERCENT,
      `Gross margin must be at most ${MAX_MARGIN_PERCENT}%`
    )
    .refine(
      (value) => validateMarginPercent(value).ok,
      "Gross margin must be a finite value between 0% and 95%."
    ),
  default_contingency_percent: z
    .number()
    .min(0, "Contingency must be at least 0%")
    .max(30, "Contingency must be at most 30%"),
  budget_rate_factor: z
    .number()
    .min(0.5, "Budget factor must be at least 0.5")
    .max(1, "Budget factor must be at most 1"),
  premium_rate_factor: z
    .number()
    .min(1, "Premium factor must be at least 1")
    .max(2, "Premium factor must be at most 2"),
  prefer_user_rates: z.boolean(),
  allow_benchmark_rates: z.boolean(),
  show_profit_in_estimates: z.boolean(),
});

export async function saveRateSettings(
  input: RateSettingsInput
): Promise<RatesActionResult> {
  const parsed = rateSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;

  await ensureDefaultSettings(supabase, orgId);

  const { error } = await supabase
    .from("organisation_settings")
    .update(parsed.data)
    .eq("org_id", orgId);

  if (error) {
    return { error: "Could not save company defaults. Please try again." };
  }

  return { success: true };
}

const rateInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    item_key: z.string().trim().min(1, "Item key is required"),
    rate_type: z.enum(VALID_RATE_TYPES),
    trade: z.string().optional(),
    work_area_type: z.string().optional(),
    label: z.string().trim().min(1, "Label is required"),
    unit: z.string().trim().min(1, "Unit is required"),
    cost_rate: z.number().min(0, "Cost rate must be non-negative").nullable().optional(),
    sell_rate: z.number().min(0, "Sell rate must be non-negative").nullable().optional(),
    markup_percent: z
      .number()
      .min(0, "Markup must be non-negative")
      .max(MAX_MARKUP_PERCENT, `Markup must be at most ${MAX_MARKUP_PERCENT}%`)
      .refine(
        (value) => validateMarkupPercent(value).ok,
        "Markup must be a finite value between 0% and 1000%."
      )
      .nullable()
      .optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rate_type !== "productivity") return;
    if (
      data.cost_rate == null ||
      !Number.isFinite(data.cost_rate) ||
      !(data.cost_rate > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["cost_rate"],
        message: "Hours must be greater than zero.",
      });
    }
  });

async function verifyRateOwnership(
  supabase: AuthOrgContext["supabase"],
  orgId: string,
  rateId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("rates")
    .select("id")
    .eq("id", rateId)
    .eq("org_id", orgId)
    .maybeSingle();

  return Boolean(data);
}

export async function createRate(input: RateInput): Promise<RatesActionResult> {
  const parsed = rateInputSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;
  const data = parsed.data;

  const { data: created, error } = await supabase
    .from("rates")
    .insert({
      org_id: orgId,
      item_key: data.item_key,
      rate_type: data.rate_type,
      trade: data.trade ?? null,
      work_area_type: data.work_area_type ?? null,
      label: data.label,
      unit: data.unit,
      cost_rate: data.cost_rate ?? null,
      sell_rate: data.sell_rate ?? null,
      markup_percent: data.markup_percent ?? null,
      active: data.active ?? true,
      source: "explicit_company",
      source_calibration_id: null,
      updated_by: loaded.context.user.id,
    })
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "A rate with this item key already exists. Edit the existing rate instead.",
      };
    }
    return { error: error.message };
  }

  return { success: true, rate: normalizeRate(created) };
}

export async function updateRate(input: RateInput): Promise<RatesActionResult> {
  if (!input.id) {
    return { error: "Rate ID is required for updates." };
  }

  const parsed = rateInputSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;
  const data = parsed.data;

  const owned = await verifyRateOwnership(supabase, orgId, data.id!);
  if (!owned) {
    return { error: "Rate not found." };
  }

  const { data: updated, error } = await supabase
    .from("rates")
    .update({
      item_key: data.item_key,
      rate_type: data.rate_type,
      trade: data.trade ?? null,
      work_area_type: data.work_area_type ?? null,
      label: data.label,
      unit: data.unit,
      cost_rate: data.cost_rate ?? null,
      sell_rate: data.sell_rate ?? null,
      markup_percent: data.markup_percent ?? null,
      active: data.active ?? true,
      source: "explicit_company",
      source_calibration_id: null,
      updated_by: loaded.context.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("org_id", orgId)
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, rate: normalizeRate(updated) };
}

export async function upsertRate(input: RateInput): Promise<RatesActionResult> {
  if (input.id) {
    return updateRate(input);
  }

  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }

  const parsed = rateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, orgId } = loaded.context;
  const data = parsed.data;

  const { data: upserted, error } = await supabase
    .from("rates")
    .upsert(
      {
        org_id: orgId,
        item_key: data.item_key,
        rate_type: data.rate_type,
        trade: data.trade ?? null,
        work_area_type: data.work_area_type ?? null,
        label: data.label,
        unit: data.unit,
        cost_rate: data.cost_rate ?? null,
        sell_rate: data.sell_rate ?? null,
        markup_percent: data.markup_percent ?? null,
        active: data.active ?? true,
        source: "explicit_company",
        source_calibration_id: null,
        updated_by: loaded.context.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,rate_type,item_key" }
    )
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, rate: normalizeRate(upserted) };
}

export async function deactivateRate(rateId: string): Promise<RatesActionResult> {
  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;

  const owned = await verifyRateOwnership(supabase, orgId, rateId);
  if (!owned) {
    return { error: "Rate not found." };
  }

  const { data: updated, error } = await supabase
    .from("rates")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", rateId)
    .eq("org_id", orgId)
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, rate: normalizeRate(updated) };
}

export async function reactivateRate(rateId: string): Promise<RatesActionResult> {
  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;

  const owned = await verifyRateOwnership(supabase, orgId, rateId);
  if (!owned) {
    return { error: "Rate not found." };
  }

  const { data: updated, error } = await supabase
    .from("rates")
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq("id", rateId)
    .eq("org_id", orgId)
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active"
    )
    .single();

  if (error) {
    return { error: error.message };
  }

  return { success: true, rate: normalizeRate(updated) };
}

export async function setRateActive(
  input: SetRateActiveInput
): Promise<RatesActionResult> {
  if (input.active) {
    return reactivateRate(input.rateId);
  }
  return deactivateRate(input.rateId);
}

/**
 * Create empty company rate shells for core labour keys only.
 * Does NOT copy catalogue benchmarks into cost/sell — that would falsely
 * present Quotr benchmarks as "Your company rate" (R2C).
 */
export async function createStarterRates(): Promise<RatesActionResult> {
  const loaded = await requireRatesWriteContext();
  if (!loaded.ok) {
    return loaded.error;
  }
  const { supabase, orgId } = loaded.context;

  const coreKeys = [
    "labour.carpenter.hour",
    "labour.labourer.hour",
  ] as const;

  const rows = ALL_RATE_CATALOGUE.filter((entry) =>
    coreKeys.includes(entry.item_key as (typeof coreKeys)[number])
  ).map((entry) => ({
    org_id: orgId,
    item_key: entry.item_key,
    rate_type: entry.rate_type,
    trade: entry.trade ?? null,
    work_area_type: entry.work_area_type ?? null,
    label: entry.label,
    unit: entry.unit,
    cost_rate: null,
    sell_rate: null,
    markup_percent: null,
    active: true,
  }));

  if (rows.length === 0) {
    return { error: "No starter rates defined." };
  }

  const { error } = await supabase.from("rates").upsert(rows, {
    onConflict: "org_id,rate_type,item_key",
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
