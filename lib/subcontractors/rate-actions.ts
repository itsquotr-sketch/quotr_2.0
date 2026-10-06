"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  draftRateFromRfqResponse,
  isSubcontractorRateUnit,
  type StoredRateVersion,
} from "@/lib/subcontractors/rate-book";
import { isSubcontractorWorkAreaType } from "@/lib/subcontractors/work-areas";
import { permissionDeniedError } from "@/lib/team/permission-server";

const FAILED = "Could not save that rate. Nothing was changed.";

type Fail = { ok: false; error: string };
type VersionRow = {
  id: string;
  rate_id: string;
  version_number: number;
  work_area_type: string;
  scope: string;
  unit: string;
  cost_ex_gst: number;
  currency: string;
  minimum_charge: number | null;
  quantity_band_min: number | null;
  quantity_band_max: number | null;
  inclusions: string;
  exclusions: string;
  effective_from: string;
  effective_until: string | null;
  last_confirmed_on: string | null;
  source: string;
  origin_response_id: string | null;
  informing_response_id: string | null;
  source_amount_ex_gst: number | null;
  internal_notes: string;
};

export type SubcontractorRateRecord = StoredRateVersion;

function moneyError(code: string | undefined): string {
  switch (code) {
    case "CONFIRM":
      return "Confirm the scope, unit, ex-GST amount, and validity before saving.";
    case "LUMP_SUM_UNIT":
      return "A lump-sum offer can only be saved as a lump sum. It cannot become a per-unit rate.";
    case "SOURCE_AMOUNT":
      return "The originating amount is kept as the response recorded it.";
    case "NOT_SUBMITTED":
      return "Only a submitted response can be saved as a rate.";
    case "WORK_AREA":
      return "Choose a work area this business already offers.";
    case "ARCHIVED":
      return "Archived businesses cannot gain a new rate.";
    case "DATES":
      return "Enter a valid effective period.";
    case "FORBIDDEN":
      return "You do not have permission to change rates.";
    case "SCOPE":
      return "Enter the precise scope this rate covers.";
    case "UNIT":
      return "Choose a unit.";
    case "AMOUNT":
      return "Enter a cost ex GST of zero or more.";
    default:
      return FAILED;
  }
}

async function writer() {
  const context = await getAuthOrgContext();
  if (!context) return { ok: false as const, error: "You need to be signed in." };
  const denied = await permissionDeniedError({
    orgId: context.orgId,
    userId: context.user.id,
    permission: "subcontractors.edit",
    entitlement: "projects.create",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

function num(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "" : String(value);
}

export async function listSubcontractorRates(subcontractorId: string): Promise<SubcontractorRateRecord[]> {
  const context = await getAuthOrgContext();
  if (!context) return [];
  return loadRates(context.supabase, context.orgId, { subcontractorId });
}

export async function loadJobRateBook(projectId: string): Promise<{
  areas: Array<{ id: string; type: string; name: string; summary: string | null }>;
  rates: SubcontractorRateRecord[];
  today: string;
}> {
  const context = await getAuthOrgContext();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
  if (!context) return { areas: [], rates: [], today };
  const areas = await context.supabase
    .from("work_areas")
    .select("id, type, name, summary, status")
    .eq("project_id", projectId)
    .eq("org_id", context.orgId)
    .eq("status", "confirmed")
    .order("sort_order");
  const rates = await loadRates(context.supabase, context.orgId, {});
  return {
    areas: (areas.data ?? []).map((area) => ({
      id: area.id,
      type: area.type,
      name: area.name,
      summary: area.summary,
    })),
    rates,
    today,
  };
}

async function loadRates(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  filter: { subcontractorId?: string }
): Promise<SubcontractorRateRecord[]> {
  let rateQuery = supabase
    .from("subcontractor_rates")
    .select("id, subcontractor_id, retired_at")
    .eq("org_id", orgId);
  if (filter.subcontractorId) rateQuery = rateQuery.eq("subcontractor_id", filter.subcontractorId);
  const rates = await rateQuery;
  const rows = rates.data ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const businessIds = [...new Set(rows.map((row) => row.subcontractor_id))];
  const [versions, businesses] = await Promise.all([
    supabase.from("subcontractor_rate_versions").select("*").in("rate_id", ids),
    supabase.from("subcontractors").select("id, trading_name, archived_at").in("id", businessIds),
  ]);
  const names = new Map((businesses.data ?? []).map((row) => [row.id, row]));
  const identity = new Map(rows.map((row) => [row.id, row]));
  return ((versions.data ?? []) as VersionRow[]).flatMap((version) => {
    const rate = identity.get(version.rate_id);
    const business = rate ? names.get(rate.subcontractor_id) : null;
    if (!rate || !business) return [];
    return [{
      rateId: rate.id,
      versionId: version.id,
      versionNumber: version.version_number,
      subcontractorId: rate.subcontractor_id,
      tradingName: business.trading_name,
      subcontractorArchived: business.archived_at != null,
      retired: rate.retired_at != null,
      workAreaType: version.work_area_type,
      scope: version.scope,
      unit: version.unit,
      costExGst: Number(version.cost_ex_gst),
      currency: version.currency,
      minimumCharge: version.minimum_charge == null ? null : Number(version.minimum_charge),
      quantityBandMin: version.quantity_band_min == null ? null : Number(version.quantity_band_min),
      quantityBandMax: version.quantity_band_max == null ? null : Number(version.quantity_band_max),
      inclusions: version.inclusions ?? "",
      exclusions: version.exclusions ?? "",
      effectiveFrom: version.effective_from,
      effectiveUntil: version.effective_until,
      lastConfirmedOn: version.last_confirmed_on,
      source: version.source,
      originResponseId: version.origin_response_id,
      informingResponseId: version.informing_response_id,
      sourceAmountExGst: version.source_amount_ex_gst == null ? null : Number(version.source_amount_ex_gst),
      internalNotes: version.internal_notes ?? "",
    }];
  });
}

export type RateWriteInput = {
  subcontractorId?: string;
  rateId?: string;
  responseId?: string;
  workAreaType: string;
  scope: string;
  unit: string;
  costExGst: number;
  minimumCharge: number | null;
  quantityBandMin: number | null;
  quantityBandMax: number | null;
  inclusions: string;
  exclusions: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  lastConfirmedOn: string | null;
  internalNotes: string;
  source: "builder" | "rfq_response" | "rate_schedule_document";
  sourceDocumentId?: string | null;
  confirmScope: boolean;
  confirmUnit: boolean;
  confirmAmount: boolean;
  confirmValidity: boolean;
};

export async function saveSubcontractorRate(input: RateWriteInput): Promise<{ ok: true; rateId: string } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  if (!isSubcontractorWorkAreaType(input.workAreaType) || !isSubcontractorRateUnit(input.unit)) {
    return { ok: false, error: moneyError(!isSubcontractorRateUnit(input.unit) ? "UNIT" : "WORK_AREA") };
  }
  let rateId = input.rateId ?? null;
  let sourceAmount: number | null = null;
  if (input.source === "rfq_response" && input.responseId) {
    const response = await loaded.context.supabase
      .from("rfq_responses")
      .select("id, recipient_id, price_ex_gst, pricing_structure, status")
      .eq("id", input.responseId)
      .maybeSingle();
    if (!response.data || response.data.status !== "submitted" || response.data.price_ex_gst == null) {
      return { ok: false, error: moneyError("NOT_SUBMITTED") };
    }
    sourceAmount = Number(response.data.price_ex_gst);
    if (response.data.pricing_structure === "lump_sum" && input.unit !== "lump_sum") {
      return { ok: false, error: moneyError("LUMP_SUM_UNIT") };
    }
    if (!rateId) {
      const siblings = await loaded.context.supabase
        .from("rfq_responses")
        .select("id")
        .eq("recipient_id", response.data.recipient_id);
      const siblingIds = (siblings.data ?? []).map((row) => row.id);
      if (siblingIds.length > 0) {
        const existing = await loaded.context.supabase
          .from("subcontractor_rate_versions")
          .select("rate_id")
          .in("origin_response_id", siblingIds);
        const found = [...new Set((existing.data ?? []).map((row) => row.rate_id))];
        if (found.length === 1) rateId = found[0] ?? null;
        if (found.length > 1) {
          return { ok: false, error: "More than one rate already comes from this response. Edit the rate you want to update." };
        }
      }
    }
  }
  const saved = await loaded.context.supabase.rpc("save_subcontractor_rate_v1", {
    p_payload: {
      subcontractor_id: input.subcontractorId ?? null,
      rate_id: rateId,
      response_id: input.responseId ?? null,
      work_area_type: input.workAreaType,
      scope: input.scope,
      unit: input.unit,
      cost_ex_gst: input.costExGst,
      minimum_charge: num(input.minimumCharge),
      quantity_band_min: num(input.quantityBandMin),
      quantity_band_max: num(input.quantityBandMax),
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil ?? "",
      last_confirmed_on: input.lastConfirmedOn ?? "",
      internal_notes: input.internalNotes,
      source: input.source,
      source_document_id: input.sourceDocumentId ?? null,
      ...(rateId || sourceAmount == null ? {} : { source_amount_ex_gst: sourceAmount }),
      confirm_scope: input.confirmScope ? "true" : "false",
      confirm_unit: input.confirmUnit ? "true" : "false",
      confirm_amount: input.confirmAmount ? "true" : "false",
      confirm_validity: input.confirmValidity ? "true" : "false",
    },
  });
  const body = (saved.data ?? {}) as { ok?: boolean; error?: string; rateId?: string };
  if (saved.error || body.ok !== true || !body.rateId) {
    return { ok: false, error: moneyError(body.error) };
  }
  if (input.subcontractorId) revalidatePath(`/app/contacts/subcontractors/${input.subcontractorId}`);
  return { ok: true, rateId: body.rateId };
}

export async function retireSubcontractorRate(input: {
  subcontractorId: string;
  rateId: string;
}): Promise<{ ok: true } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const retired = await loaded.context.supabase.rpc("retire_subcontractor_rate_v1", { p_rate: input.rateId });
  const body = (retired.data ?? {}) as { ok?: boolean; error?: string };
  if (retired.error || body.ok !== true) return { ok: false, error: moneyError(body.error) };
  revalidatePath(`/app/contacts/subcontractors/${input.subcontractorId}`);
  return { ok: true };
}

export async function rateDraftForResponse(responseId: string): Promise<
  | { ok: true; draft: ReturnType<typeof draftRateFromRfqResponse>; subcontractorId: string; responseId: string }
  | Fail
> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const response = await loaded.context.supabase
    .from("rfq_responses")
    .select("id, recipient_id, status, price_ex_gst, pricing_structure, included_scope, excluded_scope, valid_until")
    .eq("id", responseId)
    .maybeSingle();
  if (!response.data || response.data.status !== "submitted") return { ok: false, error: moneyError("NOT_SUBMITTED") };
  const recipient = await loaded.context.supabase
    .from("rfq_recipients")
    .select("id, subcontractor_id, rfq_id")
    .eq("id", response.data.recipient_id)
    .maybeSingle();
  const rfq = recipient.data
    ? await loaded.context.supabase
        .from("rfqs")
        .select("scope_kind, work_area_type")
        .eq("id", recipient.data.rfq_id)
        .maybeSingle()
    : { data: null };
  if (!recipient.data) return { ok: false, error: FAILED };
  const draft = draftRateFromRfqResponse({
    pricingStructure: response.data.pricing_structure,
    priceExGst: response.data.price_ex_gst == null ? null : Number(response.data.price_ex_gst),
    includedScope: response.data.included_scope ?? "",
    excludedScope: response.data.excluded_scope ?? "",
    validUntil: response.data.valid_until,
    workAreaType: rfq.data?.scope_kind === "work_area" ? rfq.data.work_area_type : null,
  });
  return { ok: true, draft, subcontractorId: recipient.data.subcontractor_id, responseId };
}
