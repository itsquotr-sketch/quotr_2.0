"use server";

import { z } from "zod";
import {
  ALL_RATE_CATALOGUE,
  STARTER_RATE_ITEM_KEYS,
} from "@/lib/rates/catalogue";
import type {
  RateInput,
  RateSettingsInput,
  RatesActionResult,
  RatesPageRate,
  RatesPageState,
  SetRateActiveInput,
} from "@/lib/rates/types";
import { createClient } from "@/lib/supabase/server";

type AuthOrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  orgId: string;
};

const MISSING_ORG_ERROR: RatesActionResult = {
  error:
    "Your organisation profile could not be loaded. Try signing out and back in, or contact support.",
};

const VALID_RATE_TYPES = [
  "labour",
  "material",
  "subcontractor",
  "scope",
  "package",
  "allowance",
] as const;

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

  return { supabase, user, orgId: profile.org_id };
}

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
    return { settings: null, rates: [] };
  }

  const { supabase, orgId } = context;
  const settingsRow = await ensureDefaultSettings(supabase, orgId);

  const { data: rates } = await supabase
    .from("rates")
    .select(
      "id, rate_type, trade, work_area_type, item_key, label, unit, cost_rate, sell_rate, markup_percent, active, updated_at"
    )
    .eq("org_id", orgId)
    .order("rate_type")
    .order("label");

  return {
    settings: settingsRow ? normalizeSettings(settingsRow) : null,
    rates: (rates ?? []).map((rate) => normalizeRate(rate)),
  };
}

const rateSettingsSchema = z.object({
  default_margin_percent: z
    .number()
    .min(1, "Margin must be at least 1%")
    .max(70, "Margin must be at most 70%"),
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

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

  await ensureDefaultSettings(supabase, orgId);

  const { error } = await supabase
    .from("organisation_settings")
    .update(parsed.data)
    .eq("org_id", orgId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

const rateInputSchema = z.object({
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
    .nullable()
    .optional(),
  active: z.boolean().optional(),
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

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;
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

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;
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

  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const parsed = rateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { supabase, orgId } = context;
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
  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

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
  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

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

export async function createStarterRates(): Promise<RatesActionResult> {
  const context = await getAuthOrgContext();
  if (!context) {
    return MISSING_ORG_ERROR;
  }

  const { supabase, orgId } = context;

  const rows = ALL_RATE_CATALOGUE.filter((entry) =>
    STARTER_RATE_ITEM_KEYS.includes(
      entry.item_key as (typeof STARTER_RATE_ITEM_KEYS)[number]
    )
  ).map((entry) => ({
    org_id: orgId,
    item_key: entry.item_key,
    rate_type: entry.rate_type,
    trade: entry.trade ?? null,
    work_area_type: entry.work_area_type ?? null,
    label: entry.label,
    unit: entry.unit,
    cost_rate: entry.defaultCostRate ?? null,
    sell_rate: entry.defaultSellRate ?? null,
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
