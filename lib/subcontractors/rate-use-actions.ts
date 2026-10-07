"use server";

import { revalidatePath } from "next/cache";
import { getAuthOrgContext } from "@/lib/assistant/state";
import {
  coercePersistedGstRate,
  resolveStoredPricingDocumentGstRate,
} from "@/lib/pricing/gst-source";
import { persistPricingDocumentTotals } from "@/lib/pricing/actions";
import {
  buildRfqSellChoices,
  type RfqPricingMoneyView,
  type RfqSellChoice,
  type RfqSellTreatment,
} from "@/lib/rfqs/pricing-preview";
import { validateMarginPercent } from "@/lib/security/margin-validation";
import {
  rateScopeConflictsWithResponse,
  supplierCostFromRate,
  unitsAreCompatible,
} from "@/lib/subcontractors/rate-use";
import type { StoredRateVersion } from "@/lib/subcontractors/rate-book";
import { permissionDeniedError } from "@/lib/team/permission-server";

const FAILED = "Could not use that rate on this job. Nothing was changed.";

type Fail = { ok: false; error: string };

export type JobRatePricingLine = {
  id: string;
  label: string;
  workAreaId: string | null;
  unit: string | null;
  quantity: number | null;
  totalCost: number;
  totalSell: number;
};

export type JobRatePricingContext = {
  documentId: string;
  status: string;
  gstRate: number;
  quoteIssued: boolean;
  targetMarginPercent: number | null;
  targetMarginSource: "job" | "pricing" | null;
  items: JobRatePricingLine[];
  responses: Array<{ id: string; workAreaId: string; scopeLabel: string; includedScope: string; allowanceItemId: string }>;
  uses: Array<{ id: string; rateId: string; rateVersionId: string; allowanceItemId: string; scope: string; reconciliationStatus: string | null }>;
};

export type RateUsePreview = {
  ok: true;
  supplierCost: number;
  quantityUsed: number | null;
  minimumApplied: boolean;
  minimumCharge: number | null;
  versionNumber: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  exclusions: string;
  scope: string;
  unit: string;
  jobScope: string;
  targetLabel: string;
  conflict: { applicationId: string; scopeLabel: string } | null;
  before: RfqPricingMoneyView;
  choices: RfqSellChoice[];
  targetMarginPercent: number | null;
  targetMarginSource: "job" | "pricing" | null;
};

function moneyError(code: string | undefined): string {
  switch (code) {
    case "EXPIRED":
      return "This rate version has expired.";
    case "NOT_CURRENT":
      return "This rate version has not started.";
    case "RETIRED":
      return "This rate has been retired.";
    case "CURRENCY":
      return "This rate is not in New Zealand dollars.";
    case "UNIT":
      return "This rate's unit does not match that item.";
    case "QUANTITY":
      return "Enter a measured quantity greater than zero.";
    case "AMBIGUOUS":
      return "Choose the one item to replace, or add a new item.";
    case "CONFIRM_SCOPE":
      return "Confirm the supplier scope matches this job.";
    case "CONFIRM_QUANTITY":
      return "Confirm the measured quantity. A lump sum is used once.";
    case "SOURCE":
      return "A response already covers this scope. Choose one source.";
    case "QUOTE_ISSUED":
      return "An issued quote stays as it was. This rate was not applied.";
    case "PRICING_CLOSED":
      return "That pricing document can no longer be changed.";
    case "LOSS_ACK":
      return "Confirm that this cost is higher than the sell before using it.";
    case "SELL_UNKNOWN":
      return "The current sell is unknown. Choose another sell treatment.";
    case "SELL_TREATMENT":
      return "Choose how the sell should be set before using this rate.";
    case "COST":
      return "The supplier cost did not match the rate, quantity, and minimum charge.";
    case "FORBIDDEN":
      return "You do not have permission to change pricing.";
    case "ARCHIVED":
      return "An archived business cannot be used on a job.";
    case "WORK_AREA":
      return "This rate is for a different work area.";
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
    permission: "pricing.edit",
    entitlement: "pricing.access",
  });
  if (denied) return { ok: false as const, error: denied.error };
  return { ok: true as const, context };
}

async function loadTargetMargin(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  projectId: string
): Promise<{ percent: number; source: "job" | "pricing" } | null> {
  const estimate = await supabase
    .from("estimates")
    .select("target_margin_percent")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .not("target_margin_percent", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const jobMargin = estimate.data?.target_margin_percent == null ? null : Number(estimate.data.target_margin_percent);
  if (jobMargin != null && validateMarginPercent(jobMargin).ok) return { percent: jobMargin, source: "job" };
  const settings = await supabase
    .from("organisation_settings")
    .select("default_margin_percent")
    .eq("org_id", orgId)
    .maybeSingle();
  const pricingMargin = settings.data?.default_margin_percent == null ? null : Number(settings.data.default_margin_percent);
  if (pricingMargin != null && validateMarginPercent(pricingMargin).ok) return { percent: pricingMargin, source: "pricing" };
  return null;
}

export async function loadJobPricingForRates(projectId: string): Promise<JobRatePricingContext | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;
  const document = await context.supabase
    .from("pricing_documents")
    .select("id, status, gst_rate, project_id")
    .eq("project_id", projectId)
    .eq("org_id", context.orgId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!document.data) return null;
  const [items, quotes, responses, uses, target] = await Promise.all([
    context.supabase
      .from("pricing_items")
      .select("id, client_label, work_area_id, unit, quantity, total_cost, total_sell, visible_on_quote")
      .eq("pricing_document_id", document.data.id)
      .order("sort_order"),
    context.supabase
      .from("quotes")
      .select("id, status")
      .eq("pricing_document_id", document.data.id)
      .neq("status", "draft")
      .neq("status", "archived")
      .limit(1),
    context.supabase
      .from("rfq_pricing_applications")
      .select("id, work_area_id, scope_label, included_scope, allowance_item_id")
      .eq("pricing_document_id", document.data.id)
      .is("superseded_at", null),
    context.supabase
      .from("subcontractor_rate_applications")
      .select("id, rate_id, rate_version_id, allowance_item_id, scope, reconciliation_status")
      .eq("pricing_document_id", document.data.id)
      .is("superseded_at", null),
    loadTargetMargin(context.supabase, context.orgId, projectId),
  ]);
  return {
    documentId: document.data.id,
    status: document.data.status,
    gstRate: resolveStoredPricingDocumentGstRate(coercePersistedGstRate(document.data.gst_rate)).rate,
    quoteIssued: document.data.status === "converted_to_quote" || (quotes.data ?? []).length > 0,
    targetMarginPercent: target?.percent ?? null,
    targetMarginSource: target?.source ?? null,
    items: (items.data ?? []).filter((item) => item.visible_on_quote !== false).map((item) => ({
      id: item.id,
      label: item.client_label,
      workAreaId: item.work_area_id,
      unit: item.unit,
      quantity: item.quantity == null ? null : Number(item.quantity),
      totalCost: Number(item.total_cost ?? 0),
      totalSell: Number(item.total_sell ?? 0),
    })),
    responses: (responses.data ?? []).map((row) => ({
      id: row.id,
      workAreaId: row.work_area_id,
      scopeLabel: row.scope_label,
      includedScope: row.included_scope ?? "",
      allowanceItemId: row.allowance_item_id,
    })),
    uses: (uses.data ?? []).map((row) => ({
      id: row.id,
      rateId: row.rate_id,
      rateVersionId: row.rate_version_id,
      allowanceItemId: row.allowance_item_id,
      scope: row.scope,
      reconciliationStatus: row.reconciliation_status,
    })),
  };
}

export async function loadPendingRateReconciliations(pricingDocumentId: string): Promise<Array<{
  id: string;
  scope: string;
  allowanceLabel: string;
}>> {
  const context = await getAuthOrgContext();
  if (!context) return [];
  const rows = await context.supabase
    .from("subcontractor_rate_applications")
    .select("id, scope, allowance_item_id")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", context.orgId)
    .is("superseded_at", null)
    .eq("reconciliation_status", "pending");
  const ids = (rows.data ?? []).map((row) => row.allowance_item_id);
  const labels = ids.length === 0
    ? { data: [] as Array<{ id: string; client_label: string }> }
    : await context.supabase.from("pricing_items").select("id, client_label").in("id", ids);
  const byId = new Map((labels.data ?? []).map((item) => [item.id, item.client_label]));
  return (rows.data ?? []).map((row) => ({
    id: row.id,
    scope: row.scope,
    allowanceLabel: byId.get(row.allowance_item_id) || row.scope,
  }));
}

type PreviewInput = {
  projectId: string;
  pricingDocumentId: string;
  workAreaId: string;
  rateVersionId: string;
  targetMode: "add" | "replace";
  targetItemId?: string | null;
  quantity: number | null;
  manualSell?: number | null;
};

async function buildPreview(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  orgId: string,
  input: PreviewInput
): Promise<RateUsePreview | Fail> {
  const version = await supabase
    .from("subcontractor_rate_versions")
    .select("id, rate_id, version_number, scope, exclusions, unit, cost_ex_gst, currency, minimum_charge, effective_from, effective_until, work_area_type")
    .eq("id", input.rateVersionId)
    .maybeSingle();
  if (!version.data) return { ok: false, error: moneyError("NOT_FOUND") };
  const rate = await supabase
    .from("subcontractor_rates")
    .select("id, retired_at, subcontractor_id")
    .eq("id", version.data.rate_id)
    .maybeSingle();
  if (!rate.data || rate.data.retired_at) return { ok: false, error: moneyError(rate.data ? "RETIRED" : "NOT_FOUND") };
  if (version.data.currency !== "NZD") return { ok: false, error: moneyError("CURRENCY") };
  const area = await supabase
    .from("work_areas")
    .select("id, type, summary")
    .eq("id", input.workAreaId)
    .maybeSingle();
  if (!area.data || area.data.type !== version.data.work_area_type) return { ok: false, error: moneyError("WORK_AREA") };
  const document = await supabase
    .from("pricing_documents")
    .select("id, project_id, gst_rate, status")
    .eq("id", input.pricingDocumentId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!document.data) return { ok: false, error: FAILED };
  const items = await supabase
    .from("pricing_items")
    .select("id, client_label, total_cost, total_sell, work_area_id, unit")
    .eq("pricing_document_id", document.data.id);
  const active = await supabase
    .from("subcontractor_rate_applications")
    .select("id, allowance_item_id, before_lines, target_item_id")
    .eq("pricing_document_id", document.data.id)
    .eq("rate_id", rate.data.id)
    .is("superseded_at", null)
    .maybeSingle();
  const responses = await supabase
    .from("rfq_pricing_applications")
    .select("id, scope_label, included_scope")
    .eq("pricing_document_id", document.data.id)
    .eq("work_area_id", input.workAreaId)
    .is("superseded_at", null)
    .maybeSingle();
  const cost = supplierCostFromRate({
    unit: version.data.unit,
    unitCostExGst: Number(version.data.cost_ex_gst),
    minimumCharge: version.data.minimum_charge == null ? null : Number(version.data.minimum_charge),
    quantity: input.quantity,
  });
  if (!cost.ok) return { ok: false, error: moneyError(cost.code) };
  if (input.targetMode === "replace") {
    const target = (items.data ?? []).find((item) => item.id === input.targetItemId);
    if (!target || target.work_area_id !== input.workAreaId) return { ok: false, error: moneyError("AMBIGUOUS") };
    if (!unitsAreCompatible(version.data.unit, target.unit)) return { ok: false, error: moneyError("UNIT") };
  } else if (input.targetItemId) {
    return { ok: false, error: moneyError("AMBIGUOUS") };
  }
  const replacedIds = active.data
    ? [active.data.allowance_item_id]
    : input.targetMode === "replace" && input.targetItemId
      ? [input.targetItemId]
      : [];
  const target = await loadTargetMargin(supabase, orgId, document.data.project_id);
  const gstRate = resolveStoredPricingDocumentGstRate(coercePersistedGstRate(document.data.gst_rate)).rate;
  const priced = buildRfqSellChoices({
    responseId: version.data.id,
    priceExGst: cost.costExGst,
    gstRate,
    items: (items.data ?? []).map((item) => ({
      id: item.id,
      totalCost: Number(item.total_cost ?? 0),
      totalSell: Number(item.total_sell ?? 0),
    })),
    replacedIds,
    existingAllowanceId: active.data?.allowance_item_id ?? null,
    targetMarginPercent: target?.percent ?? null,
    manualSell: input.manualSell ?? null,
  });
  if (!priced.ok) return priced;
  const conflict = responses.data && rateScopeConflictsWithResponse(version.data.scope, responses.data.included_scope, responses.data.scope_label)
    ? { applicationId: responses.data.id, scopeLabel: responses.data.scope_label }
    : null;
  const targetRow = (items.data ?? []).find((item) => item.id === input.targetItemId);
  return {
    ok: true,
    supplierCost: cost.costExGst,
    quantityUsed: cost.quantityUsed,
    minimumApplied: cost.minimumApplied,
    minimumCharge: version.data.minimum_charge == null ? null : Number(version.data.minimum_charge),
    versionNumber: version.data.version_number,
    effectiveFrom: version.data.effective_from,
    effectiveUntil: version.data.effective_until,
    exclusions: version.data.exclusions ?? "",
    scope: version.data.scope,
    unit: version.data.unit,
    jobScope: area.data.summary?.trim() ? area.data.summary : "No specification is recorded for this work area.",
    targetLabel: input.targetMode === "add" ? "Add a new pricing item" : (targetRow?.client_label || "Selected item"),
    conflict,
    before: priced.preview.before,
    choices: priced.preview.choices,
    targetMarginPercent: target?.percent ?? null,
    targetMarginSource: target?.source ?? null,
  };
}

export async function previewSubcontractorRateUse(input: PreviewInput): Promise<RateUsePreview | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  return buildPreview(loaded.context.supabase, loaded.context.orgId, input);
}

export async function applySubcontractorRateUse(input: PreviewInput & {
  sellTreatment: RfqSellTreatment;
  acknowledgeLoss?: boolean;
  confirmScope: boolean;
  confirmQuantity: boolean;
  sourceChoice?: "rate" | "response" | null;
}): Promise<{ ok: true; alreadyApplied: boolean } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  if (!input.confirmScope) return { ok: false, error: moneyError("CONFIRM_SCOPE") };
  if (!input.confirmQuantity) return { ok: false, error: moneyError("CONFIRM_QUANTITY") };
  if (input.sourceChoice === "response") return { ok: false, error: moneyError("SOURCE") };
  const preview = await buildPreview(loaded.context.supabase, loaded.context.orgId, input);
  if (!preview.ok) return preview;
  if (preview.conflict && input.sourceChoice !== "rate") return { ok: false, error: moneyError("SOURCE") };
  const choice = preview.choices.find((item) => item.treatment === input.sellTreatment);
  if (!choice?.available || !choice.allowance || choice.sell == null) {
    return { ok: false, error: choice?.unavailableReason ?? moneyError("SELL_TREATMENT") };
  }
  if (choice.loss && input.acknowledgeLoss !== true) return { ok: false, error: moneyError("LOSS_ACK") };
  const applied = await loaded.context.supabase.rpc("apply_subcontractor_rate_to_pricing_v1", {
    p_payload: {
      rate_version_id: input.rateVersionId,
      pricing_document_id: input.pricingDocumentId,
      work_area_id: input.workAreaId,
      target_mode: input.targetMode,
      target_item_id: input.targetMode === "replace" ? input.targetItemId : null,
      quantity: preview.quantityUsed,
      total_cost: choice.allowance.totalCost,
      total_sell: choice.allowance.totalSell,
      gross_profit: choice.allowance.grossProfit,
      margin_percent: choice.allowance.marginPercent,
      markup_percent: choice.allowance.markupPercent,
      sell_treatment: input.sellTreatment,
      acknowledge_loss: choice.loss ? "true" : "false",
      confirm_scope: "true",
      confirm_quantity: "true",
      source_choice: input.sourceChoice ?? null,
      target_margin_percent: input.sellTreatment === "target_margin" ? preview.targetMarginPercent : null,
    },
  });
  const body = (applied.data ?? {}) as { ok?: boolean; error?: string; alreadyApplied?: boolean };
  if (applied.error) {
    const message = applied.error.message ?? "";
    if (message.includes("RATE_USE_FORCED")) return { ok: false, error: "The pricing update was rolled back." };
    return { ok: false, error: FAILED };
  }
  if (body.ok !== true) return { ok: false, error: moneyError(body.error) };
  if (body.alreadyApplied) return { ok: true, alreadyApplied: true };
  try {
    await persistPricingDocumentTotals(
      loaded.context.supabase,
      loaded.context.orgId,
      input.pricingDocumentId,
      resolveStoredPricingDocumentGstRate(coercePersistedGstRate(
        (await loaded.context.supabase.from("pricing_documents").select("gst_rate").eq("id", input.pricingDocumentId).single()).data?.gst_rate
      )).rate,
      true
    );
  } catch {
    return { ok: false, error: "The supplier cost was saved, but the pricing totals need another save." };
  }
  revalidatePath(`/app/projects/${input.projectId}/requests`);
  revalidatePath(`/app/projects/${input.projectId}`);
  return { ok: true, alreadyApplied: false };
}

export async function reconcileSubcontractorRateUse(input: {
  projectId: string;
  pricingDocumentId: string;
  applicationId: string;
  decision: "keep" | "drop";
}): Promise<{ ok: true } | Fail> {
  const loaded = await writer();
  if (!loaded.ok) return loaded;
  const result = await loaded.context.supabase.rpc("reconcile_subcontractor_rate_v1", {
    p_payload: { application_id: input.applicationId, decision: input.decision },
  });
  const body = (result.data ?? {}) as { ok?: boolean; error?: string };
  if (result.error || body.ok !== true) return { ok: false, error: moneyError(body.error) };
  const gst = await loaded.context.supabase.from("pricing_documents").select("gst_rate").eq("id", input.pricingDocumentId).single();
  try {
    await persistPricingDocumentTotals(
      loaded.context.supabase,
      loaded.context.orgId,
      input.pricingDocumentId,
      resolveStoredPricingDocumentGstRate(coercePersistedGstRate(gst.data?.gst_rate)).rate,
      true
    );
  } catch {
    return { ok: false, error: "The supplier choice was saved, but the pricing totals need another save." };
  }
  revalidatePath(`/app/projects/${input.projectId}/pricing/${input.pricingDocumentId}`);
  revalidatePath(`/app/projects/${input.projectId}`);
  return { ok: true };
}

export type SupplierPriceLine = {
  versionNumber: number;
  scope: string;
  exclusions: string;
  unit: string;
  quantity: number | null;
  supplierCost: number;
  clientSell: number;
  sellTreatment: string;
  minimumApplied: boolean;
  rate?: StoredRateVersion;
  schedule?: { projectId: string; rfqId: string; responseId: string; scheduleItemId: string; versionNumber: number };
  replaces?: Array<{ id: string; label: string; cost: number; sell: number }>;
  area: { id: string; name: string; summary: string | null };
};

export type SupplierPriceReview = {
  projectId: string;
  pricing: JobRatePricingContext;
  byItemId: Record<string, SupplierPriceLine>;
};

export async function loadSupplierPriceReview(
  projectId: string,
  pricingDocumentId: string
): Promise<SupplierPriceReview | null> {
  const context = await getAuthOrgContext();
  if (!context) return null;
  const pricing = await loadJobPricingForRates(projectId);
  if (!pricing || pricing.documentId !== pricingDocumentId) return null;
  const applications = await context.supabase
    .from("subcontractor_rate_applications")
    .select("allowance_item_id, rate_id, rate_version_id, version_number, scope, exclusions, unit, quantity, cost_ex_gst, sell_ex_gst, sell_treatment, minimum_applied, work_area_id")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", context.orgId)
    .is("superseded_at", null);
  const rows = applications.data ?? [];
  const scheduleApplications = await context.supabase
    .from("rfq_schedule_pricing_applications")
    .select("allowance_item_id, response_id, response_version, rfq_id, schedule_item_id, scope, excluded_scope, unit, quantity, cost_ex_gst, sell_ex_gst, sell_treatment, work_area_id, replaced_item_ids, before_lines")
    .eq("pricing_document_id", pricingDocumentId)
    .eq("org_id", context.orgId)
    .is("superseded_at", null);
  if (rows.length === 0 && (scheduleApplications.data ?? []).length === 0) return { projectId, pricing, byItemId: {} };
  if (rows.length === 0) {
    const byItemId: Record<string, SupplierPriceLine> = {};
    const scheduleRows = scheduleApplications.data ?? [];
    const scheduleAreas = await context.supabase
      .from("work_areas")
      .select("id, name, summary")
      .in("id", scheduleRows.map((row) => row.work_area_id));
    const scheduleAreaById = new Map((scheduleAreas.data ?? []).map((row) => [row.id, row]));
    for (const row of scheduleRows) {
      const area = scheduleAreaById.get(row.work_area_id);
      if (!area) continue;
      byItemId[row.allowance_item_id] = {
        versionNumber: row.response_version,
        scope: row.scope,
        exclusions: row.excluded_scope ?? "",
        unit: row.unit,
        quantity: row.quantity == null ? null : Number(row.quantity),
        supplierCost: Number(row.cost_ex_gst),
        clientSell: Number(row.sell_ex_gst),
        sellTreatment: row.sell_treatment,
        minimumApplied: false,
        schedule: {
          projectId,
          rfqId: row.rfq_id,
          responseId: row.response_id,
          scheduleItemId: row.schedule_item_id,
          versionNumber: row.response_version,
        },
        area: { id: area.id, name: area.name, summary: area.summary },
      };
    }
    await attachScheduleReplacements(context.supabase, byItemId, scheduleRows);
    return { projectId, pricing, byItemId };
  }
  const versionIds = rows.map((row) => row.rate_version_id);
  const areaIds = rows.map((row) => row.work_area_id);
  const [versions, areas, rates, businesses] = await Promise.all([
    context.supabase.from("subcontractor_rate_versions").select("*").in("id", versionIds),
    context.supabase.from("work_areas").select("id, name, summary").in("id", areaIds),
    context.supabase.from("subcontractor_rates").select("id, subcontractor_id, retired_at").in("id", rows.map((row) => row.rate_id)),
    context.supabase.from("subcontractors").select("id, trading_name, archived_at").eq("org_id", context.orgId),
  ]);
  const versionById = new Map((versions.data ?? []).map((row) => [row.id, row]));
  const areaById = new Map((areas.data ?? []).map((row) => [row.id, row]));
  const rateById = new Map((rates.data ?? []).map((row) => [row.id, row]));
  const businessById = new Map((businesses.data ?? []).map((row) => [row.id, row]));
  const byItemId: Record<string, SupplierPriceLine> = {};
  for (const row of rows) {
    const version = versionById.get(row.rate_version_id);
    const area = areaById.get(row.work_area_id);
    const rate = rateById.get(row.rate_id);
    const business = rate ? businessById.get(rate.subcontractor_id) : null;
    if (!version || !area || !rate || !business) continue;
    const stored: StoredRateVersion = {
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
    };
    byItemId[row.allowance_item_id] = {
      versionNumber: row.version_number,
      scope: row.scope,
      exclusions: row.exclusions ?? "",
      unit: row.unit,
      quantity: row.quantity == null ? null : Number(row.quantity),
      supplierCost: Number(row.cost_ex_gst),
      clientSell: Number(row.sell_ex_gst),
      sellTreatment: row.sell_treatment,
      minimumApplied: row.minimum_applied === true,
      rate: stored,
      area: { id: area.id, name: area.name, summary: area.summary },
    };
  }
  const scheduleRows = scheduleApplications.data ?? [];
  if (scheduleRows.length > 0) {
    const scheduleAreas = await context.supabase
      .from("work_areas")
      .select("id, name, summary")
      .in("id", scheduleRows.map((row) => row.work_area_id));
    const scheduleAreaById = new Map((scheduleAreas.data ?? []).map((row) => [row.id, row]));
    for (const row of scheduleRows) {
      const area = scheduleAreaById.get(row.work_area_id);
      if (!area || byItemId[row.allowance_item_id]) continue;
      byItemId[row.allowance_item_id] = {
        versionNumber: row.response_version,
        scope: row.scope,
        exclusions: row.excluded_scope ?? "",
        unit: row.unit,
        quantity: row.quantity == null ? null : Number(row.quantity),
        supplierCost: Number(row.cost_ex_gst),
        clientSell: Number(row.sell_ex_gst),
        sellTreatment: row.sell_treatment,
        minimumApplied: false,
        schedule: {
          projectId,
          rfqId: row.rfq_id,
          responseId: row.response_id,
          scheduleItemId: row.schedule_item_id,
          versionNumber: row.response_version,
        },
        area: { id: area.id, name: area.name, summary: area.summary },
      };
    }
  }
  await attachScheduleReplacements(context.supabase, byItemId, scheduleRows);
  return { projectId, pricing, byItemId };
}

async function attachScheduleReplacements(
  supabase: NonNullable<Awaited<ReturnType<typeof getAuthOrgContext>>>["supabase"],
  byItemId: Record<string, SupplierPriceLine>,
  rows: Array<{ allowance_item_id: string; schedule_item_id: string; replaced_item_ids: string[] | null; before_lines: Array<{ id?: string; total_cost?: number; total_sell?: number }> | null }>
) {
  const ids = [...new Set(rows.flatMap((row) => row.replaced_item_ids ?? []))];
  const labels = ids.length === 0
    ? { data: [] as Array<{ id: string; client_label: string | null }> }
    : await supabase.from("pricing_items").select("id, client_label").in("id", ids);
  const labelById = new Map((labels.data ?? []).map((row) => [row.id, row.client_label || "Original item"]));
  for (const row of rows) {
    const line = byItemId[row.allowance_item_id];
    if (!line) continue;
    line.replaces = (row.replaced_item_ids ?? []).map((id) => {
      const before = (row.before_lines ?? []).find((item) => item.id === id);
      return {
        id,
        label: labelById.get(id) || "Original item",
        cost: Number(before?.total_cost ?? 0),
        sell: Number(before?.total_sell ?? 0),
      };
    });
  }
}
